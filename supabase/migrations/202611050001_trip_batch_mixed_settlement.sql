-- Trip batch settlement: atomic proposals; independent whole-child confirmation and reversal.
-- No historical rewrites. Native debt and cash still use Issue08's existing readers and journals.
begin;
create table public.trip_settlement_batches(
 id uuid primary key default gen_random_uuid(), payer_participant_id uuid not null references public.participants(id),
 space_id uuid not null references public.spaces(id), client_request_id uuid not null, created_at timestamptz not null default now(),
 unique(payer_participant_id,client_request_id)
);
alter table public.trip_settlement_batches enable row level security;
revoke all on public.trip_settlement_batches from public,anon,authenticated;
grant select on public.trip_settlement_batches to authenticated;
create policy trip_batch_owner_read on public.trip_settlement_batches for select to authenticated using(payer_participant_id=(select public.current_participant_id()));
alter table public.settlement_fx_bundles add column batch_id uuid references public.trip_settlement_batches(id);
create index trip_batch_children on public.settlement_fx_bundles(batch_id) where batch_id is not null;
create table private.trip_batch_quotes(
 id uuid primary key default gen_random_uuid(),actor uuid not null references public.participants(id),space_id uuid not null references public.spaces(id),
 draft jsonb not null, review jsonb not null, expires_at timestamptz not null default(now()+interval '10 minutes'), created_at timestamptz not null default now()
);
create table private.trip_batch_cash(
 bundle_id uuid not null references public.settlement_fx_bundles(id),currency text not null,
 payment_id uuid not null unique references public.settlement_payments(id),primary key(bundle_id,currency)
);
revoke all on private.trip_batch_quotes,private.trip_batch_cash from public,anon,authenticated;
-- Shared Issue08 pair calculator. Financial readers, proportional coverage and rounding are unchanged.
create function private.fx_pair_quote(actor uuid,target_space_id uuid,counterparty_id uuid,target_currency text,rate_mode text,custom_rates jsonb,cash_minor bigint,batch boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare code text; you_owe bigint; they_owe bigint; legs jsonb:='[]'::jsonb; covered_rows jsonb:='[]'::jsonb; you_value bigint:=0; they_value bigint:=0; full_minor bigint; net bigint; row jsonb; covered bigint; remaining bigint; num numeric; den numeric; rates jsonb:='{}'::jsonb; snap jsonb; quote_row jsonb; expenses jsonb; scale_target numeric; scale_code numeric; submitted text:=pg_catalog.clock_timestamp()::text;
begin
  if rate_mode='system' or batch then
    select s.rates into snap from tabby_fx.snapshots s join tabby_fx.refresh_state r on r.snapshot_id=s.id;
    if snap is null and not batch then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
  elsif custom_rates is null or jsonb_typeof(custom_rates)<>'object' then raise exception using message='invalid_rate', errcode='P0001'; end if;
  for code in select distinct e.currency from public.expenses e where e.scope='space' and e.space_id=target_space_id and e.status='active' order by e.currency loop
    you_owe := private.space_signed_outstanding(target_space_id, actor, counterparty_id, code) - private.pending_pair_minor(target_space_id, actor, counterparty_id, code);
    they_owe := private.space_signed_outstanding(target_space_id, counterparty_id, actor, code) - private.pending_pair_minor(target_space_id, counterparty_id, actor, code);
    if you_owe>0 then legs:=legs||jsonb_build_array(jsonb_build_object('direction','payer_owes','currency',code,'remaining',you_owe)); end if;
    if they_owe>0 then legs:=legs||jsonb_build_array(jsonb_build_object('direction','counterparty_owes','currency',code,'remaining',they_owe)); end if;
  end loop;
  if jsonb_array_length(legs)=0 then raise exception using message='no_outstanding_debt', errcode='P0001'; end if;
  for leg_index in 0..jsonb_array_length(legs)-1 loop
    row:=legs->leg_index; code:=row->>'currency';
    scale_target:=10::numeric ^ private.currency_digits(target_currency); scale_code:=10::numeric ^ private.currency_digits(code);
    if code=pg_catalog.upper(target_currency) then
      num:=1; den:=1;
      quote_row:=jsonb_build_object('numerator','1','denominator','1','source','identity');
    elsif rate_mode='custom' and (not batch or custom_rates ? code) then
      if coalesce(custom_rates->>code,'') !~ '^[0-9]+(\.[0-9]+)?$' or (custom_rates->>code)::numeric<=0 then raise exception using message='invalid_rate', errcode='P0001'; end if;
      num:=(custom_rates->>code)::numeric; den:=1;
      quote_row:=jsonb_build_object('numerator',num::text,'denominator','1','source','custom','provider','Custom','submittedAt',submitted);
    else
      if pg_catalog.upper(target_currency)<>'MYR' and (snap->pg_catalog.upper(target_currency)->>'denominator') is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
      if code='MYR' then
        num:=1; den:=1;
        quote_row:=jsonb_build_object('provider',snap->pg_catalog.upper(target_currency)->>'provider','rateDate',snap->pg_catalog.upper(target_currency)->>'rateDate','source','system','identityBase',true);
      else
        if (snap->code->>'denominator') is null or (snap->code->>'provider') is null or (snap->code->>'rateDate') is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
        num:=(snap->code->>'denominator')::numeric; den:=(snap->code->>'numerator')::numeric;
        quote_row:=jsonb_build_object('provider',snap->code->>'provider','rateDate',snap->code->>'rateDate','source','system');
      end if;
      if pg_catalog.upper(target_currency)<>'MYR' then
        num:=num * (snap->pg_catalog.upper(target_currency)->>'numerator')::numeric;
        den:=den * (snap->pg_catalog.upper(target_currency)->>'denominator')::numeric;
        quote_row:=quote_row||jsonb_build_object('targetRateDate',snap->pg_catalog.upper(target_currency)->>'rateDate','targetProvider',snap->pg_catalog.upper(target_currency)->>'provider');
      end if;
      quote_row:=quote_row||jsonb_build_object('numerator',num::text,'denominator',den::text);
    end if;
    if num<=0 or den<=0 then raise exception using message='invalid_rate', errcode='P0001'; end if;
    rates:=rates||jsonb_build_object(code, quote_row);
    if row->>'direction'='payer_owes' then you_value:=you_value+private.fx_round_div((row->>'remaining')::numeric * scale_target * den, num * scale_code);
    else they_value:=they_value+private.fx_round_div((row->>'remaining')::numeric * scale_target * den, num * scale_code); end if;
  end loop;
  net:=you_value-they_value; full_minor:=abs(net);
  if net<0 then raise exception using message='not_net_payer', errcode='P0001'; end if;
  if full_minor=0 then
    if you_value<=0 or they_value<=0 then raise exception using message='amount_too_small',errcode='P0001';end if;
    if cash_minor<>0 then raise exception using message='invalid_amount', errcode='P0001'; end if;
  elsif cash_minor=0 or cash_minor>full_minor then raise exception using message='invalid_amount', errcode='P0001'; end if;
  expenses:=private.fx_pair_expense_versions(target_space_id,actor,counterparty_id);
  for leg_index in 0..jsonb_array_length(legs)-1 loop
    row:=legs->leg_index; remaining:=(row->>'remaining')::bigint; code:=row->>'currency';
    covered:=case when full_minor=0 or cash_minor=full_minor then remaining else least(remaining, private.fx_round_div(remaining::numeric*cash_minor, full_minor::numeric)) end;
    covered_rows:=covered_rows||jsonb_build_array(jsonb_build_object('direction',row->>'direction','currency',code,'covered',covered,'remaining',remaining-covered));
  end loop;
  if cash_minor>0 and not exists(select 1 from jsonb_array_elements(covered_rows) item where (item->>'covered')::bigint>0) then raise exception using message='amount_too_small', errcode='P0001'; end if;
  return jsonb_build_object('sourceVersion',2,'rates',rates,'expenses',expenses,'legs',legs,'coverages',covered_rows,'customRates',case when rate_mode='custom' then custom_rates else null end,'submittedAt',submitted,'cash_minor',cash_minor,'full_net_minor',full_minor);
end $$;
revoke all on function private.fx_pair_quote(uuid,uuid,uuid,text,text,jsonb,bigint,boolean) from public,anon,authenticated;

create or replace function public.propose_fx_settlement_bundle(request_id uuid, target_space_id uuid, counterparty_id uuid, target_currency text, rate_mode text, custom_rates jsonb, cash_minor bigint, payer_account_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();existing public.settlement_fx_bundles%rowtype;quote_row jsonb;rates jsonb;expenses jsonb;legs jsonb;covered_rows jsonb;full_minor bigint;submitted text;account public.personal_accounts%rowtype;new_bundle uuid;row jsonb;payment_id uuid;allocation_id uuid;
begin
  if request_id is null or counterparty_id is null or counterparty_id=actor or rate_mode not in ('system','custom') or cash_minor is null or cash_minor<0 then raise exception using message='invalid_amount', errcode='P0001'; end if;
  if private.currency_digits(target_currency) is null then raise exception using message='invalid_currency', errcode='P0001'; end if;
  if private.space_role(target_space_id, actor) is null or private.space_role(target_space_id, counterparty_id) is null then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into existing from public.settlement_fx_bundles where payer_participant_id=actor and client_request_id=request_id;
  if existing.id is not null then
    if existing.counterparty_participant_id is distinct from counterparty_id or existing.target_currency is distinct from pg_catalog.upper(target_currency) or existing.rate_mode is distinct from rate_mode or existing.cash_minor is distinct from cash_minor or existing.payer_account_id is distinct from payer_account_id or (rate_mode='custom' and existing.quote->'customRates' is distinct from custom_rates) then raise exception using message='idempotency_conflict', errcode='P0001'; end if;
    return jsonb_build_object('bundle_id', existing.id, 'status', existing.status, 'version', existing.version, 'cash_minor', existing.cash_minor, 'full_net_minor', existing.full_net_minor);
  end if;
  quote_row:=private.fx_pair_quote(actor,target_space_id,counterparty_id,target_currency,rate_mode,custom_rates,cash_minor);
  rates:=quote_row->'rates';expenses:=quote_row->'expenses';legs:=quote_row->'legs';covered_rows:=quote_row->'coverages';full_minor:=(quote_row->>'full_net_minor')::bigint;submitted:=quote_row->>'submittedAt';
  if cash_minor>0 then
    select * into account from public.personal_accounts where id=payer_account_id and owner_participant_id=actor and archived_at is null and account_class='asset' and currency=pg_catalog.upper(target_currency);
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
  end if;
  insert into public.settlement_fx_bundles(client_request_id,space_id,payer_participant_id,counterparty_participant_id,target_currency,cash_minor,full_net_minor,rate_mode,status,payer_account_id,quote)
    values(request_id,target_space_id,actor,counterparty_id,pg_catalog.upper(target_currency),cash_minor,full_minor,rate_mode,'pending',payer_account_id,jsonb_build_object('sourceVersion',2,'rates',rates,'expenses',expenses,'legs',legs,'coverages',covered_rows,'customRates',case when rate_mode='custom' then custom_rates else null end,'submittedAt',submitted))
    returning id into new_bundle;
  for leg_index in 0..jsonb_array_length(covered_rows)-1 loop
    row:=covered_rows->leg_index;
    insert into public.settlement_fx_coverages(bundle_id,direction,currency,covered_minor,remaining_minor,rate_numerator,rate_denominator)
      values(new_bundle,row->>'direction',row->>'currency',(row->>'covered')::bigint,(row->>'remaining')::bigint,rates->(row->>'currency')->>'numerator',rates->(row->>'currency')->>'denominator');
  end loop;
  if cash_minor>0 then
    insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
      values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', new_bundle::text||':cash'),'space',target_space_id,actor,pg_catalog.upper(target_currency),cash_minor,current_date,'pending','fx-cash',true,true)
      returning id into payment_id;
    insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state)
      values(payment_id,counterparty_id,cash_minor,'pending') returning id into allocation_id;
    insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
      values(actor,extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', new_bundle::text||':payer-leg'),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',allocation_id,'role','payer','account_id',account.id,'cash_amount_minor',cash_minor,'account_currency',account.currency,'shared_amount_minor',cash_minor,'gift_extra_minor',0)),payment_id,allocation_id,'payer',account.id,cash_minor,account.currency,cash_minor,0,'pending');
    update public.settlement_fx_bundles set cash_payment_id=payment_id where id=new_bundle;
  end if;
  return jsonb_build_object('bundle_id',new_bundle,'status','pending','version',1,'cash_minor',cash_minor,'full_net_minor',full_minor);
end $$;


-- Freeze only this caller's account authorization; it is never included in a counterparty bundle.
create function private.trip_batch_account(actor uuid,account_id uuid,code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.personal_accounts%rowtype; parent public.personal_accounts%rowtype;
begin
 select * into a from public.personal_accounts p where p.id=account_id and p.owner_participant_id=actor for share;
 select p.* into parent from public.personal_accounts p where p.id=coalesce((select c.parent_account_id from public.personal_account_currencies c where c.account_id=a.id),a.id) and p.owner_participant_id=actor for share;
 if a.id is null or parent.id is null or a.archived_at is not null or parent.archived_at is not null or a.account_class<>'asset' or a.currency<>code then
  raise exception using message='settlement_cash_account_invalid',errcode='P0001';end if;
 return jsonb_build_object('id',a.id,'version',a.version,'parent',parent.id,'parentVersion',parent.version);
end $$;
revoke all on function private.trip_batch_account(uuid,uuid,text) from public,anon,authenticated;

-- Same global mutex as legacy proposals/corrections. No writes to debt, reservations or cash here.
create function private.trip_batch_review(actor uuid,target_space_id uuid,rate_mode text,vnd_per_myr text,expected_snapshot_id uuid,recipients jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare recipient jsonb; cash jsonb; account_id uuid; other uuid; code text; minor bigint; myr bigint; vnd bigint; equivalent bigint; n numeric; d numeric;
 snap jsonb; snapshot uuid; snapshot_needed boolean:=false; vr jsonb; custom_rates jsonb:='{}'::jsonb; q jsonb; rows jsonb:='[]'::jsonb; cash_rows jsonb; accounts jsonb:='{}'::jsonb; authorizations jsonb:='{}'::jsonb; auth jsonb;
begin
 if rate_mode is null or rate_mode not in('system','custom') or jsonb_typeof(recipients) is distinct from 'array' or jsonb_array_length(recipients) not between 1 and 100 then raise exception using message='invalid_amount',errcode='P0001';end if;
 if not exists(select 1 from public.spaces s where s.id=target_space_id and s.type='trip' and s.status<>'voided') or private.space_role(target_space_id,actor) is null then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 if(select count(distinct r->>'participantId')from jsonb_array_elements(recipients)r)<>jsonb_array_length(recipients)then raise exception using message='duplicate_recipient',errcode='P0001';end if;
 select r.snapshot_id,s.rates into snapshot,snap from tabby_fx.refresh_state r join tabby_fx.snapshots s on s.id=r.snapshot_id where r.singleton for share of r,s;
 if rate_mode='custom' then
  custom_rates:=jsonb_build_object('VND',vnd_per_myr);
  if coalesce(vnd_per_myr,'')~'^[0-9]{1,12}(\.[0-9]{1,12})?$' and vnd_per_myr::numeric>0 then vr:=jsonb_build_object('numerator',vnd_per_myr,'denominator','1','source','custom','provider','Custom');end if;
 else
  if snap->'VND'->>'numerator' is not null and snap->'VND'->>'denominator' is not null then
   vr:=jsonb_build_object('numerator',snap->'VND'->>'denominator','denominator',snap->'VND'->>'numerator','source','system','provider',snap->'VND'->>'provider','rateDate',snap->'VND'->>'rateDate');
  end if;
 end if;
 for recipient in select r from jsonb_array_elements(recipients)r order by r->>'participantId' loop
  other:=(recipient->>'participantId')::uuid;
  if other is null or other=actor or private.space_role(target_space_id,other) is null then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
  -- Batch never hides a pending/reviewable pair. Legacy participates through the same reservation reader.
  if exists(select 1 from public.settlement_fx_bundles b where b.space_id=target_space_id and b.status='pending' and ((b.payer_participant_id=actor and b.counterparty_participant_id=other)or(b.payer_participant_id=other and b.counterparty_participant_id=actor)))
   or exists(select 1 from public.settlement_payments p join public.settlement_allocations a on a.settlement_payment_id=p.id where p.scope='space' and p.space_id=target_space_id and not p.fx_cash_only and a.state='pending' and ((p.debtor_participant_id=actor and a.creditor_participant_id=other)or(p.debtor_participant_id=other and a.creditor_participant_id=actor)))then raise exception using message='pending_pair',errcode='P0001';end if;
  if jsonb_typeof(recipient->'cash') is distinct from 'array' or jsonb_array_length(recipient->'cash') not between 1 and 2 then raise exception using message='invalid_amount',errcode='P0001';end if;
  if(select count(distinct r->>'currency')from jsonb_array_elements(recipient->'cash')r)<>jsonb_array_length(recipient->'cash')then raise exception using message='invalid_currency',errcode='P0001';end if;
  myr:=0;vnd:=0;cash_rows:='[]';
  for cash in select r from jsonb_array_elements(recipient->'cash')r order by r->>'currency' loop
   code:=cash->>'currency';
   if code is null or code not in('MYR','VND') or coalesce(cash->>'amountMinor','')!~'^[0-9]{1,16}$' or (cash->>'amountMinor')::numeric>9007199254740991 then raise exception using message='invalid_amount',errcode='P0001';end if;
   minor:=(cash->>'amountMinor')::bigint;if minor=0 then continue;end if;
   account_id:=nullif(cash->>'accountId','')::uuid;auth:=private.trip_batch_account(actor,account_id,code);
   if accounts ? code and accounts->>code is distinct from account_id::text then raise exception using message='one_account_per_currency',errcode='P0001';end if;
   accounts:=accounts||jsonb_build_object(code,account_id);authorizations:=authorizations||jsonb_build_object(code,auth);
   cash_rows:=cash_rows||jsonb_build_array(jsonb_build_object('currency',code,'amountMinor',minor));
   if code='MYR'then myr:=minor;else vnd:=minor;end if;
  end loop;
  equivalent:=myr;
  if vnd>0 then
   if vr is null or vr->>'provider' is null then raise exception using message='fx_rate_unavailable',errcode='P0001';end if;
   n:=(vr->>'numerator')::numeric;d:=(vr->>'denominator')::numeric;
   if n<=0 or d<=0 then raise exception using message='invalid_rate',errcode='P0001';end if;
   equivalent:=equivalent+private.fx_round_div(vnd::numeric*100*d,n);
   if rate_mode='system' then snapshot_needed:=true;end if;
  end if;
  if equivalent<=0 or equivalent>9007199254740991 then raise exception using message='invalid_amount',errcode='P0001';end if;
  q:=private.fx_pair_quote(actor,target_space_id,other,'MYR',rate_mode,custom_rates,equivalent,true);
  if(q->>'full_net_minor')::bigint<=0 then raise exception using message='not_net_payer',errcode='P0001';end if;
  if exists(select 1 from jsonb_each(q->'rates')r where r.value->>'source'='system')then snapshot_needed:=true;end if;
  q:=q||jsonb_build_object('batchVersion',1,'participantId',other,'cashLegs',cash_rows,'cashRate',case when vnd>0 then vr else null end,
    'intent',case when equivalent=(q->>'full_net_minor')::bigint then 'full' else 'partial'end,
    'rounding',case when vnd>0 then jsonb_build_object('numerator',(vnd::numeric*100*d-(equivalent-myr)::numeric*n)::text,'denominator',n::text,'unit','MYR minor')else null end);
  rows:=rows||jsonb_build_array(q);
 end loop;
 if snapshot_needed and(snapshot is null or snapshot is distinct from expected_snapshot_id)then raise exception using message='quote_changed',errcode='P0001';end if;
 return jsonb_build_object('children',rows,'accounts',authorizations,'snapshotId',case when snapshot_needed then snapshot else null end,'rateMode',rate_mode);
end $$;
revoke all on function private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb) from public,anon,authenticated;

create function public.quote_trip_settlement_batch(target_space_id uuid,rate_mode text,vnd_per_myr text,expected_snapshot_id uuid,recipients jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();review jsonb;quote_id uuid;expiry timestamptz;
begin
 perform private.lock_collect_pay_balance();
 review:=private.trip_batch_review(actor,target_space_id,rate_mode,vnd_per_myr,expected_snapshot_id,recipients);
 insert into private.trip_batch_quotes(actor,space_id,draft,review) values(actor,target_space_id,jsonb_build_object('rateMode',rate_mode,'vndPerMyr',vnd_per_myr,'snapshotId',expected_snapshot_id,'recipients',recipients),review) returning id,expires_at into quote_id,expiry;
 return jsonb_build_object('quoteId',quote_id,'expiresAt',expiry,'children',review->'children','snapshotId',review->'snapshotId','rateMode',rate_mode);
end $$;

create function public.submit_trip_settlement_batch(quote_id uuid,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare submit_actor uuid:=private.require_personal_actor();frozen private.trip_batch_quotes%rowtype;latest jsonb;receipt jsonb;batch uuid;child uuid;child_request uuid;q jsonb;c jsonb;coverage jsonb;payment uuid;allocation uuid;account uuid;children jsonb:='[]'::jsonb;
begin
 receipt:=private.begin_money_operation(submit_actor,request_id,'trip_batch_submit',jsonb_build_object('quoteId',quote_id));
 if receipt is not null then return receipt;end if;
 perform private.lock_collect_pay_balance();
 select * into frozen from private.trip_batch_quotes r where r.id=quote_id and r.actor=submit_actor for update;
 if frozen.id is null then raise exception using message='quote_not_found',errcode='P0001';end if;
 if frozen.expires_at<=clock_timestamp()then raise exception using message='quote_expired',errcode='P0001';end if;
 latest:=private.trip_batch_review(submit_actor,frozen.space_id,frozen.draft->>'rateMode',frozen.draft->>'vndPerMyr',(frozen.draft->>'snapshotId')::uuid,frozen.draft->'recipients');
 -- Time metadata is informational; all source revisions, rates, rounding, account versions and money must match.
 if latest->'accounts' is distinct from frozen.review->'accounts' or latest->'snapshotId' is distinct from frozen.review->'snapshotId'
  or (select jsonb_agg(entry.value-'submittedAt'-'rates' order by entry.value->>'participantId')from jsonb_array_elements(latest->'children')as entry(value)) is distinct from(select jsonb_agg(entry.value-'submittedAt'-'rates' order by entry.value->>'participantId')from jsonb_array_elements(frozen.review->'children')as entry(value))
  or (select jsonb_agg((select jsonb_object_agg(key,value-'submittedAt')from jsonb_each(entry.value->'rates'))order by entry.value->>'participantId')from jsonb_array_elements(latest->'children')as entry(value)) is distinct from(select jsonb_agg((select jsonb_object_agg(key,value-'submittedAt')from jsonb_each(entry.value->'rates'))order by entry.value->>'participantId')from jsonb_array_elements(frozen.review->'children')as entry(value))
 then raise exception using message='quote_changed',errcode='P0001';end if;
 insert into public.trip_settlement_batches(payer_participant_id,space_id,client_request_id)values(submit_actor,frozen.space_id,request_id)returning id into batch;
 for q in select r from jsonb_array_elements(frozen.review->'children')r order by r->>'participantId'loop
  child_request:=private.money_child_request(request_id,q->>'participantId');
  insert into public.settlement_fx_bundles(client_request_id,space_id,payer_participant_id,counterparty_participant_id,target_currency,cash_minor,full_net_minor,rate_mode,status,payer_account_id,quote,batch_id)
   values(child_request,frozen.space_id,submit_actor,(q->>'participantId')::uuid,'MYR',(q->>'cash_minor')::bigint,(q->>'full_net_minor')::bigint,frozen.draft->>'rateMode','pending',null,q,batch)returning id into child;
  for coverage in select r from jsonb_array_elements(q->'coverages')r loop
   insert into public.settlement_fx_coverages(bundle_id,direction,currency,covered_minor,remaining_minor,rate_numerator,rate_denominator)
    values(child,coverage->>'direction',coverage->>'currency',(coverage->>'covered')::bigint,(coverage->>'remaining')::bigint,q->'rates'->(coverage->>'currency')->>'numerator',q->'rates'->(coverage->>'currency')->>'denominator');
  end loop;
  for c in select r from jsonb_array_elements(q->'cashLegs')r order by r->>'currency'loop
   account:=(frozen.review->'accounts'->(c->>'currency')->>'id')::uuid;
   insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
    values(private.money_child_request(child_request,c->>'currency'),'space',frozen.space_id,submit_actor,c->>'currency',(c->>'amountMinor')::bigint,current_date,'pending','fx-cash',true,true)returning id into payment;
   insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state)values(payment,(q->>'participantId')::uuid,(c->>'amountMinor')::bigint,'pending')returning id into allocation;
   insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
    values(submit_actor,private.money_child_request(child_request,'payer:'||(c->>'currency')),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',allocation,'role','payer','account_id',account,'cash_amount_minor',(c->>'amountMinor')::bigint,'account_currency',c->>'currency','shared_amount_minor',(c->>'amountMinor')::bigint,'gift_extra_minor',0)),payment,allocation,'payer',account,(c->>'amountMinor')::bigint,c->>'currency',(c->>'amountMinor')::bigint,0,'pending');
   insert into private.trip_batch_cash(bundle_id,currency,payment_id)values(child,c->>'currency',payment);
  end loop;
  children:=children||jsonb_build_array(jsonb_build_object('bundleId',child,'participantId',q->>'participantId','status','pending','cashLegs',q->'cashLegs'));
 end loop;
 return private.finish_money_operation(submit_actor,request_id,jsonb_build_object('batchId',batch,'children',children,'status','pending'));
end $$;

create function private.fx_release_bundle_cash(bundle uuid,legacy_payment uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
 for p in select c.payment_id from private.trip_batch_cash c where c.bundle_id=bundle union select legacy_payment where legacy_payment is not null loop
  perform private.fx_release_cash(p);
 end loop;
end $$;
revoke all on function private.fx_release_bundle_cash(uuid,uuid) from public,anon,authenticated;
create function private.respond_fx_bundle(target_bundle_id uuid,response text,expected_version integer,receiver_accounts jsonb,allow_batch boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; expenses jsonb; payment_id uuid; debtor uuid; creditor uuid; allocation_id uuid; account public.personal_accounts%rowtype; payer_leg uuid; receiver_leg uuid; cash_row record; receiver_account_id uuid; frozen_leg jsonb;
begin
  if actor is null or response not in ('accepted','declined') then raise exception using message='invalid_amount', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null then raise exception using message='allocation_not_found', errcode='P0001'; end if;
  if actor is distinct from bundle.counterparty_participant_id then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if bundle.batch_id is not null and not allow_batch then raise exception using message='batch_review_required',errcode='P0001';end if;
  if bundle.status<>'pending' then return jsonb_build_object('bundle_id',bundle.id,'status',bundle.status,'version',bundle.version); end if;
  if expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  if bundle.quote->>'sourceVersion'='2' then
    expenses:=private.fx_pair_expense_versions(bundle.space_id,bundle.payer_participant_id,bundle.counterparty_participant_id);
  else
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version) order by e.id),'[]'::jsonb) into expenses from public.expenses e
    where e.scope='space' and e.space_id=bundle.space_id and e.status='active' and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id in (bundle.payer_participant_id,bundle.counterparty_participant_id));
  end if;
  if response<>'declined' and expenses is distinct from bundle.quote->'expenses' then raise exception using message='balance_changed', errcode='P0001'; end if;
  if response='declined' then
    perform private.fx_release_bundle_cash(bundle.id,bundle.cash_payment_id);
    update public.settlement_fx_bundles set status='declined', version=version+1 where id=bundle.id;
    return jsonb_build_object('bundle_id',bundle.id,'status','declined','version',bundle.version+1);
  end if;
  -- A prior settlement reversal can change the net direction without changing an expense revision.
  -- For a frozen batch child require the same native pair snapshot, not just sufficient coverage.
  if bundle.batch_id is not null then
    for frozen_leg in select r from jsonb_array_elements(bundle.quote->'legs')r loop
      debtor:=case when frozen_leg->>'direction'='payer_owes' then bundle.payer_participant_id else bundle.counterparty_participant_id end;
      creditor:=case when frozen_leg->>'direction'='payer_owes' then bundle.counterparty_participant_id else bundle.payer_participant_id end;
      if private.space_signed_outstanding(bundle.space_id,debtor,creditor,frozen_leg->>'currency') is distinct from (frozen_leg->>'remaining')::bigint then raise exception using message='balance_changed',errcode='P0001';end if;
    end loop;
  end if;
  -- A confirmed single-currency payment can change coverage without editing an expense version.
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and covered_minor>0 loop
    debtor:=case when coverage.direction='payer_owes' then bundle.payer_participant_id else bundle.counterparty_participant_id end;
    creditor:=case when coverage.direction='payer_owes' then bundle.counterparty_participant_id else bundle.payer_participant_id end;
    if private.space_signed_outstanding(bundle.space_id,debtor,creditor,coverage.currency)<coverage.covered_minor then
      raise exception using message='balance_changed',errcode='P0001';
    end if;
  end loop;
  for cash_row in
    select c.payment_id,p.currency,p.amount_minor from private.trip_batch_cash c join public.settlement_payments p on p.id=c.payment_id where c.bundle_id=bundle.id
    union all select bundle.cash_payment_id,bundle.target_currency,bundle.cash_minor where bundle.batch_id is null and bundle.cash_minor>0
    order by currency loop
    receiver_account_id:=nullif(receiver_accounts->>cash_row.currency,'')::uuid;
    if receiver_account_id is null or receiver_account_id=bundle.payer_account_id then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
    select * into account from public.personal_accounts where id=receiver_account_id and owner_participant_id=actor and archived_at is null and account_class='asset' and currency=cash_row.currency;
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
    if bundle.batch_id is not null then
      perform private.trip_batch_account(actor,receiver_account_id,cash_row.currency);
      perform private.trip_batch_account(bundle.payer_participant_id,(select l.account_id from public.personal_settlement_cash_legs l where l.settlement_payment_id=cash_row.payment_id and l.role='payer' and l.status='pending'),cash_row.currency);
    end if;
    select id into allocation_id from public.settlement_allocations where settlement_payment_id=cash_row.payment_id and state='pending';
    if allocation_id is null then raise exception using message='allocation_not_pending', errcode='P0001'; end if;
    insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
      values(actor,extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':receiver-leg:'||cash_row.currency),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',allocation_id,'role','receiver','account_id',account.id,'cash_amount_minor',cash_row.amount_minor,'account_currency',account.currency,'shared_amount_minor',cash_row.amount_minor,'gift_extra_minor',0)),cash_row.payment_id,allocation_id,'receiver',account.id,cash_row.amount_minor,account.currency,cash_row.amount_minor,0,'pending')
      returning id into receiver_leg;
    select id into payer_leg from public.personal_settlement_cash_legs where settlement_allocation_id=allocation_id and role='payer' and status='pending';
    if payer_leg is null then raise exception using message='payer_cash_authorization_required', errcode='P0001'; end if;
    perform private.post_personal_settlement_cash_leg(payer_leg);
    perform private.post_personal_settlement_cash_leg(receiver_leg);
    update public.settlement_allocations set state='accepted', responded_at=pg_catalog.now() where id=allocation_id;
    update public.settlement_payments set status='confirmed', version=version+1 where id=cash_row.payment_id;
  end loop;
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and covered_minor>0 order by currency, direction loop
    debtor:=case when coverage.direction='payer_owes' then bundle.payer_participant_id else bundle.counterparty_participant_id end;
    creditor:=case when coverage.direction='payer_owes' then bundle.counterparty_participant_id else bundle.payer_participant_id end;
    insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
      values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':coverage:'||coverage.id::text),'space',bundle.space_id,debtor,coverage.currency,coverage.covered_minor,current_date,'confirmed','fx-coverage',false,false)
      returning id into payment_id;
    insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)
      values(payment_id,creditor,coverage.covered_minor,'accepted',pg_catalog.now()) returning id into allocation_id;
    update public.settlement_fx_coverages set settlement_payment_id=payment_id where id=coverage.id;
    insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)
      values(actor,payment_id,'settlement.fx_coverage_accepted',jsonb_build_object('bundle_id',bundle.id,'allocation_id',allocation_id,'currency',coverage.currency,'amount_minor',coverage.covered_minor,'rate_numerator',coverage.rate_numerator,'rate_denominator',coverage.rate_denominator));
  end loop;
  update public.settlement_fx_bundles set status='accepted', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','accepted','version',bundle.version+1,'cash_minor',bundle.cash_minor);
end $$;

create or replace function public.cancel_fx_settlement_bundle(target_bundle_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype;
begin
  if actor is null then raise exception using message='not_authenticated', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null or bundle.payer_participant_id is distinct from actor then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if bundle.status<>'pending' then return jsonb_build_object('bundle_id',bundle.id,'status',bundle.status,'version',bundle.version); end if;
  if expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  perform private.fx_release_bundle_cash(bundle.id,bundle.cash_payment_id);
  update public.settlement_fx_bundles set status='cancelled', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','cancelled','version',bundle.version+1);
end $$;

create or replace function public.reverse_fx_settlement_bundle(reversal_request_id uuid, target_bundle_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; allocation public.settlement_allocations%rowtype; cash_payment uuid;
begin
  if actor is null or reversal_request_id is null then raise exception using message='invalid_request_id', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null or actor not in (bundle.payer_participant_id, bundle.counterparty_participant_id) then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if bundle.status='reversed' then return jsonb_build_object('bundle_id',bundle.id,'status','reversed','version',bundle.version); end if;
  if bundle.status<>'accepted' or expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  perform set_config('tabby.fx_bundle_reversal','on',true);
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and settlement_payment_id is not null loop
    select * into allocation from public.settlement_allocations where settlement_payment_id=coverage.settlement_payment_id;
    if not exists(select 1 from public.settlement_allocation_reversals where settlement_allocation_id=allocation.id) then
      insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)
        values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', reversal_request_id::text||':'||allocation.id::text),allocation.id,actor,allocation.amount_minor,'fx-bundle-reversal');
      perform public.recompute_settlement_status(coverage.settlement_payment_id);
    end if;
  end loop;
  for cash_payment in select c.payment_id from private.trip_batch_cash c where c.bundle_id=bundle.id
    union select bundle.cash_payment_id where bundle.cash_payment_id is not null
    union select p.id from public.settlement_payments p where bundle.batch_id is null and bundle.cash_payment_id is null and bundle.cash_minor>0
      and p.client_request_id=extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e',bundle.id::text||':cash') loop
    select * into allocation from public.settlement_allocations where settlement_payment_id=cash_payment;
    if allocation.id is not null and not exists(select 1 from public.settlement_allocation_reversals where settlement_allocation_id=allocation.id) then
      insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)
        values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e',reversal_request_id::text||':cash:'||allocation.id::text),allocation.id,actor,allocation.amount_minor,'fx-bundle-reversal');
      perform public.recompute_settlement_status(cash_payment);
    end if;
  end loop;
  update public.settlement_fx_bundles set status='reversed', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','reversed','version',bundle.version+1);
end $$;

revoke all on function private.respond_fx_bundle(uuid,text,integer,jsonb,boolean) from public,anon,authenticated;
create or replace function public.respond_fx_settlement_bundle(target_bundle_id uuid,response text,expected_version integer,receiver_account_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare code text;
begin
 select target_currency into code from public.settlement_fx_bundles where id=target_bundle_id;
 return private.respond_fx_bundle(target_bundle_id,response,expected_version,jsonb_build_object(coalesce(code,'MYR'),receiver_account_id),false);
end $$;
create function public.respond_trip_batch_child(target_bundle_id uuid,response text,expected_version integer,receiver_accounts jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if receiver_accounts is null or jsonb_typeof(receiver_accounts)<>'object'then raise exception using message='settlement_cash_account_invalid',errcode='P0001';end if;
 return private.respond_fx_bundle(target_bundle_id,response,expected_version,receiver_accounts,true);
end $$;
revoke all on function public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb),public.submit_trip_settlement_batch(uuid,uuid),public.respond_trip_batch_child(uuid,text,integer,jsonb) from public,anon;
grant execute on function public.quote_trip_settlement_batch(uuid,text,text,uuid,jsonb),public.submit_trip_settlement_batch(uuid,uuid),public.respond_trip_batch_child(uuid,text,integer,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
