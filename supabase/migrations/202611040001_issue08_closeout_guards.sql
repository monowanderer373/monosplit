-- Issue08 closeout. No bill rewrites, new balance engine, table or cash mechanism.
begin;
create function private.fx_pair_expense_versions(target_space uuid, first_participant uuid, second_participant uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version)order by e.id),'[]'::jsonb)
 from public.expenses e where e.scope='space'and e.space_id=target_space and e.status='active'
 and(private.shared_restart_amount(e.id,first_participant,second_participant,private.shared_raw_expense_obligation(e.id,first_participant,second_participant))>0
 or private.shared_restart_amount(e.id,second_participant,first_participant,private.shared_raw_expense_obligation(e.id,second_participant,first_participant))>0)
$$;
revoke all on function private.fx_pair_expense_versions(uuid,uuid,uuid)from public,anon,authenticated;

create or replace function public.propose_fx_settlement_bundle(request_id uuid, target_space_id uuid, counterparty_id uuid, target_currency text, rate_mode text, custom_rates jsonb, cash_minor bigint, payer_account_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); existing public.settlement_fx_bundles%rowtype; code text; you_owe bigint; they_owe bigint; legs jsonb:='[]'::jsonb; covered_rows jsonb:='[]'::jsonb; you_value bigint:=0; they_value bigint:=0; full_minor bigint; net bigint; row jsonb; covered bigint; remaining bigint; num numeric; den numeric; rates jsonb:='{}'::jsonb; snap jsonb; quote_row jsonb; expenses jsonb; new_bundle uuid; account public.personal_accounts%rowtype; scale_target numeric; scale_code numeric; payment_id uuid; allocation_id uuid; submitted text:=pg_catalog.clock_timestamp()::text;
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
  if rate_mode='system' then
    select s.rates into snap from tabby_fx.snapshots s join tabby_fx.refresh_state r on r.snapshot_id=s.id;
    if snap is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
  elsif custom_rates is null or jsonb_typeof(custom_rates)<>'object' then raise exception using message='invalid_rate', errcode='P0001'; end if;
  for code in select distinct e.currency from public.expenses e where e.scope='space' and e.space_id=target_space_id and e.status='active' loop
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
    elsif rate_mode='custom' then
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
  if cash_minor>0 then
    select * into account from public.personal_accounts where id=payer_account_id and owner_participant_id=actor and archived_at is null and account_class='asset' and currency=pg_catalog.upper(target_currency);
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
  end if;
  expenses:=private.fx_pair_expense_versions(target_space_id,actor,counterparty_id);
  for leg_index in 0..jsonb_array_length(legs)-1 loop
    row:=legs->leg_index; remaining:=(row->>'remaining')::bigint; code:=row->>'currency';
    covered:=case when full_minor=0 or cash_minor=full_minor then remaining else least(remaining, private.fx_round_div(remaining::numeric*cash_minor, full_minor::numeric)) end;
    covered_rows:=covered_rows||jsonb_build_array(jsonb_build_object('direction',row->>'direction','currency',code,'covered',covered,'remaining',remaining-covered));
  end loop;
  if cash_minor>0 and not exists(select 1 from jsonb_array_elements(covered_rows) item where (item->>'covered')::bigint>0) then raise exception using message='amount_too_small', errcode='P0001'; end if;
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

create or replace function public.respond_fx_settlement_bundle(target_bundle_id uuid, response text, expected_version integer, receiver_account_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; expenses jsonb; payment_id uuid; debtor uuid; creditor uuid; allocation_id uuid; account public.personal_accounts%rowtype; payer_leg uuid; receiver_leg uuid;
begin
  if actor is null or response not in ('accepted','declined') then raise exception using message='invalid_amount', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null then raise exception using message='allocation_not_found', errcode='P0001'; end if;
  if actor is distinct from bundle.counterparty_participant_id then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
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
    perform private.fx_release_cash(bundle.cash_payment_id);
    update public.settlement_fx_bundles set status='declined', version=version+1 where id=bundle.id;
    return jsonb_build_object('bundle_id',bundle.id,'status','declined','version',bundle.version+1);
  end if;
  -- A confirmed single-currency payment can change coverage without editing an expense version.
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and covered_minor>0 loop
    debtor:=case when coverage.direction='payer_owes' then bundle.payer_participant_id else bundle.counterparty_participant_id end;
    creditor:=case when coverage.direction='payer_owes' then bundle.counterparty_participant_id else bundle.payer_participant_id end;
    if private.space_signed_outstanding(bundle.space_id,debtor,creditor,coverage.currency)<coverage.covered_minor then
      raise exception using message='balance_changed',errcode='P0001';
    end if;
  end loop;
  if bundle.cash_minor>0 then
    if receiver_account_id is null or receiver_account_id=bundle.payer_account_id then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
    select * into account from public.personal_accounts where id=receiver_account_id and owner_participant_id=actor and archived_at is null and account_class='asset' and currency=bundle.target_currency;
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
    select id into allocation_id from public.settlement_allocations where settlement_payment_id=bundle.cash_payment_id and state='pending';
    if allocation_id is null then raise exception using message='allocation_not_pending', errcode='P0001'; end if;
    insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
      values(actor,extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':receiver-leg'),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',allocation_id,'role','receiver','account_id',account.id,'cash_amount_minor',bundle.cash_minor,'account_currency',account.currency,'shared_amount_minor',bundle.cash_minor,'gift_extra_minor',0)),bundle.cash_payment_id,allocation_id,'receiver',account.id,bundle.cash_minor,account.currency,bundle.cash_minor,0,'pending')
      returning id into receiver_leg;
    select id into payer_leg from public.personal_settlement_cash_legs where settlement_allocation_id=allocation_id and role='payer' and status='pending';
    if payer_leg is null then raise exception using message='payer_cash_authorization_required', errcode='P0001'; end if;
    perform private.post_personal_settlement_cash_leg(payer_leg);
    perform private.post_personal_settlement_cash_leg(receiver_leg);
    update public.settlement_allocations set state='accepted', responded_at=pg_catalog.now() where id=allocation_id;
    update public.settlement_payments set status='confirmed', version=version+1 where id=bundle.cash_payment_id;
  end if;
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

-- Required-argument overload: PostgREST distinguishes this from the unchanged 8-argument legacy command.
-- The original command computes/validates and writes in the same transaction; a mismatch rolls it all back.
create function public.propose_fx_settlement_bundle(
 request_id uuid,target_space_id uuid,counterparty_id uuid,target_currency text,rate_mode text,custom_rates jsonb,cash_minor bigint,payer_account_id uuid,
 expected_snapshot_id uuid,expected_expenses jsonb,expected_full_minor bigint,payment_intent text
)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();existing public.settlement_fx_bundles%rowtype;bundle public.settlement_fx_bundles%rowtype;result jsonb;current_snapshot uuid;
begin
 if payment_intent not in('full','partial')or expected_full_minor is null or expected_full_minor<0 or expected_expenses is null or jsonb_typeof(expected_expenses)<>'array' then
  raise exception using message='invalid_amount',errcode='P0001';
 end if;
 perform private.lock_collect_pay_balance();
 select * into existing from public.settlement_fx_bundles where payer_participant_id=actor and client_request_id=request_id;
 if existing.id is null and rate_mode='system' then
  select snapshot_id into current_snapshot from tabby_fx.refresh_state where singleton for share;
  if expected_snapshot_id is null or current_snapshot is distinct from expected_snapshot_id then raise exception using message='quote_changed',errcode='P0001';end if;
 end if;
 result:=public.propose_fx_settlement_bundle(request_id,target_space_id,counterparty_id,target_currency,rate_mode,custom_rates,cash_minor,payer_account_id);
 select * into bundle from public.settlement_fx_bundles where id=(result->>'bundle_id')::uuid;
 if bundle.full_net_minor is distinct from expected_full_minor or bundle.quote->'expenses' is distinct from expected_expenses
  or(payment_intent='full'and bundle.cash_minor<>bundle.full_net_minor)
  or(payment_intent='partial'and(bundle.cash_minor<=0 or bundle.cash_minor>=bundle.full_net_minor))then
  raise exception using message='quote_changed',errcode='P0001';
 end if;
 return result;
end $$;
revoke all on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid,uuid,jsonb,bigint,text)from public,anon;
grant execute on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid,uuid,jsonb,bigint,text)to authenticated;
notify pgrst,'reload schema';
commit;
