-- Issue 08 closeout: reuse private cash legs, and keep a bundle atomic.
begin;

alter table public.settlement_fx_bundles
  add column if not exists cash_payment_id uuid references public.settlement_payments(id);

create function private.fx_release_cash(target_payment uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if target_payment is null then return; end if;
  update public.personal_settlement_cash_legs
    set status='cancelled', cancelled_at=pg_catalog.now(), version=version+1
    where settlement_payment_id=target_payment and status='pending';
  update public.settlement_allocations set state='cancelled', responded_at=pg_catalog.now()
    where settlement_payment_id=target_payment and state='pending';
  update public.settlement_payments set status='cancelled', version=version+1
    where id=target_payment and status='pending';
end $$;
revoke all on function private.fx_release_cash(uuid) from public, anon, authenticated;

create function private.reject_split_fx_command()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('tabby.fx_bundle_reversal', true) = 'on' then return new; end if;
  if exists (
    select 1 from public.settlement_allocations allocation
    join public.settlement_payments payment on payment.id=allocation.settlement_payment_id
    where allocation.id=new.settlement_allocation_id
      and (payment.fx_cash_only or payment.note in ('fx-cash','fx-coverage')
        or exists (select 1 from public.settlement_fx_coverages coverage where coverage.settlement_payment_id=payment.id))
  ) then
    raise exception using message='fx_bundle_reversal_required', errcode='P0001';
  end if;
  return new;
end $$;
revoke all on function private.reject_split_fx_command() from public, anon, authenticated;
create trigger reject_split_fx_reversal before insert on public.settlement_allocation_reversals
  for each row execute function private.reject_split_fx_command();

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
      if (snap->code->>'denominator') is null or (snap->code->>'provider') is null or (snap->code->>'rateDate') is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
      num:=(snap->code->>'denominator')::numeric; den:=(snap->code->>'numerator')::numeric;
      quote_row:=jsonb_build_object('provider',snap->code->>'provider','rateDate',snap->code->>'rateDate','source','system');
      if pg_catalog.upper(target_currency)<>'MYR' then
        num:=num / den * (snap->pg_catalog.upper(target_currency)->>'numerator')::numeric;
        den:=(snap->pg_catalog.upper(target_currency)->>'denominator')::numeric;
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
    if cash_minor<>0 then raise exception using message='invalid_amount', errcode='P0001'; end if;
  elsif cash_minor=0 or cash_minor>full_minor then raise exception using message='invalid_amount', errcode='P0001'; end if;
  if cash_minor>0 then
    select * into account from public.personal_accounts where id=payer_account_id and owner_participant_id=actor and archived_at is null and account_class='asset' and currency=pg_catalog.upper(target_currency);
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version) order by e.id),'[]'::jsonb) into expenses from public.expenses e
    where e.scope='space' and e.space_id=target_space_id and e.status='active' and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id in (actor,counterparty_id));
  for leg_index in 0..jsonb_array_length(legs)-1 loop
    row:=legs->leg_index; remaining:=(row->>'remaining')::bigint; code:=row->>'currency';
    covered:=case when full_minor=0 or cash_minor=full_minor then remaining else least(remaining, private.fx_round_div(remaining::numeric*cash_minor, full_minor::numeric)) end;
    covered_rows:=covered_rows||jsonb_build_array(jsonb_build_object('direction',row->>'direction','currency',code,'covered',covered,'remaining',remaining-covered));
  end loop;
  if cash_minor>0 and not exists(select 1 from jsonb_array_elements(covered_rows) item where (item->>'covered')::bigint>0) then raise exception using message='amount_too_small', errcode='P0001'; end if;
  insert into public.settlement_fx_bundles(client_request_id,space_id,payer_participant_id,counterparty_participant_id,target_currency,cash_minor,full_net_minor,rate_mode,status,payer_account_id,quote)
    values(request_id,target_space_id,actor,counterparty_id,pg_catalog.upper(target_currency),cash_minor,full_minor,rate_mode,'pending',payer_account_id,jsonb_build_object('rates',rates,'expenses',expenses,'legs',legs,'coverages',covered_rows,'customRates',case when rate_mode='custom' then custom_rates else null end,'submittedAt',submitted))
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

drop function public.respond_fx_settlement_bundle(uuid,text,integer);
create function public.respond_fx_settlement_bundle(target_bundle_id uuid, response text, expected_version integer, receiver_account_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; expenses jsonb; payment_id uuid; debtor uuid; creditor uuid; allocation_id uuid; account public.personal_accounts%rowtype; payer_leg uuid; receiver_leg uuid;
begin
  if actor is null or response not in ('accepted','declined') then raise exception using message='invalid_amount', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null then raise exception using message='allocation_not_found', errcode='P0001'; end if;
  if bundle.status<>'pending' then return jsonb_build_object('bundle_id',bundle.id,'status',bundle.status,'version',bundle.version); end if;
  if actor is distinct from bundle.counterparty_participant_id then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version) order by e.id),'[]'::jsonb) into expenses from public.expenses e
    where e.scope='space' and e.space_id=bundle.space_id and e.status='active' and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id in (bundle.payer_participant_id,bundle.counterparty_participant_id));
  if response<>'declined' and expenses is distinct from bundle.quote->'expenses' then raise exception using message='balance_changed', errcode='P0001'; end if;
  if response='declined' then
    perform private.fx_release_cash(bundle.cash_payment_id);
    update public.settlement_fx_bundles set status='declined', version=version+1 where id=bundle.id;
    return jsonb_build_object('bundle_id',bundle.id,'status','declined','version',bundle.version+1);
  end if;
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
  perform private.fx_release_cash(bundle.cash_payment_id);
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
  cash_payment:=bundle.cash_payment_id;
  if cash_payment is null and bundle.cash_minor>0 then
    select id into cash_payment from public.settlement_payments where client_request_id=extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':cash');
  end if;
  if cash_payment is not null then
    select * into allocation from public.settlement_allocations where settlement_payment_id=cash_payment;
    if allocation.id is not null and not exists(select 1 from public.settlement_allocation_reversals where settlement_allocation_id=allocation.id) then
      insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)
        values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', reversal_request_id::text||':cash:'||allocation.id::text),allocation.id,actor,allocation.amount_minor,'fx-bundle-reversal');
      perform public.recompute_settlement_status(cash_payment);
    end if;
  end if;
  update public.settlement_fx_bundles set status='reversed', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','reversed','version',bundle.version+1);
end $$;

do $patch$
declare def text; patched text;
begin
  def := pg_catalog.pg_get_functiondef('public.respond_to_settlement(uuid,text,integer)'::regprocedure);
  patched := pg_catalog.replace(def,
    'select * into payment_row from public.settlement_payments where id = allocation_row.settlement_payment_id;',
    'select * into payment_row from public.settlement_payments where id = allocation_row.settlement_payment_id; if payment_row.fx_cash_only or payment_row.note in (''fx-cash'',''fx-coverage'') or exists (select 1 from public.settlement_fx_coverages coverage where coverage.settlement_payment_id=payment_row.id) then raise exception using message=''fx_bundle_command_required'', errcode=''P0001''; end if;');
  if patched = def then raise exception 'fx guard missed respond_to_settlement'; end if;
  execute patched;
  def := pg_catalog.pg_get_functiondef('public.cancel_pending_settlement_allocation(uuid,integer)'::regprocedure);
  patched := pg_catalog.replace(def,
    'result_payload := public.phase5_cancel_pending_settlement_allocation_without_cash(',
    'if exists (select 1 from public.settlement_allocations allocation join public.settlement_payments payment on payment.id=allocation.settlement_payment_id where allocation.id=target_allocation_id and (payment.fx_cash_only or payment.note in (''fx-cash'',''fx-coverage'') or exists (select 1 from public.settlement_fx_coverages coverage where coverage.settlement_payment_id=payment.id))) then raise exception using message=''fx_bundle_command_required'', errcode=''P0001''; end if; result_payload := public.phase5_cancel_pending_settlement_allocation_without_cash(');
  if patched = def then raise exception 'fx guard missed cancel_pending_settlement_allocation'; end if;
  execute patched;
  def := pg_catalog.pg_get_functiondef('public.reverse_settlement_allocation(uuid,uuid,integer,text)'::regprocedure);
  patched := pg_catalog.replace(def,
    'message = ''financial_invariant_violation''',
    'message = ''financial_invariant_violation''');
  patched := pg_catalog.replace(patched,
    'if allocation_row.id is null then',
    'if payment_row.fx_cash_only or payment_row.note in (''fx-cash'',''fx-coverage'') or exists (select 1 from public.settlement_fx_coverages coverage where coverage.settlement_payment_id=payment_row.id) then raise exception using message=''fx_bundle_reversal_required'', errcode=''P0001''; end if; if allocation_row.id is null then');
  if patched = def then raise exception 'fx guard missed reverse_settlement_allocation'; end if;
  execute patched;
end $patch$;

revoke all on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid), public.respond_fx_settlement_bundle(uuid,text,integer,uuid), public.cancel_fx_settlement_bundle(uuid,integer), public.reverse_fx_settlement_bundle(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid), public.respond_fx_settlement_bundle(uuid,text,integer,uuid), public.cancel_fx_settlement_bundle(uuid,integer), public.reverse_fx_settlement_bundle(uuid,uuid,integer) to authenticated;

commit;
