-- Issue 08: historical zero-share placeholders, and one atomic cross-currency settlement bundle.
begin;

alter table public.settlement_payments
  add column if not exists fx_cash_only boolean not null default false;

do $patch$
declare def text; patched text;
begin
  def := pg_catalog.pg_get_functiondef('public.correct_space_expense(uuid,uuid,integer,bigint,text,text,text,date,uuid[],bigint[],bigint[])'::regprocedure);
  patched := pg_catalog.replace(def, $old$from pg_catalog.unnest(participant_ids) as item(participant_id)
    where not exists (
      select 1
      from public.space_members as member
      where member.space_id = target_row.space_id
        and member.participant_id = item.participant_id
        and member.removed_at is null
    )$old$, $new$from pg_catalog.unnest(participant_ids) with ordinality as item(participant_id, ord)
    join pg_catalog.unnest(contribution_amounts) with ordinality as paid(amount_minor, ord) using (ord)
    join pg_catalog.unnest(share_amounts) with ordinality as share(amount_minor, ord) using (ord)
    where not exists (
      select 1
      from public.space_members as member
      where member.space_id = target_row.space_id
        and member.participant_id = item.participant_id
        and member.removed_at is null
    )
    and not (paid.amount_minor = 0 and share.amount_minor = 0 and exists (
      select 1 from public.expense_participations as prior
      where prior.expense_id = target_row.id and prior.participant_id = item.participant_id
    ))$new$);
  if patched = def then
    raise exception 'historical placeholder patch missed correct_space_expense';
  end if;
  execute patched;

  def := pg_catalog.pg_get_functiondef('public.save_trip_expense_editor(uuid,uuid,integer,uuid,text,boolean,jsonb,uuid[],text,jsonb,jsonb)'::regprocedure);
  patched := pg_catalog.replace(def,
    'unnest(ids)x where not exists(select 1 from public.space_members m where m.space_id=trip and m.participant_id=x and m.removed_at is null)',
    'pg_catalog.unnest(ids) with ordinality x(id,ord) join pg_catalog.unnest(paid) with ordinality p(paid,ord) using(ord) join pg_catalog.unnest(shares) with ordinality s(share,ord) using(ord) where not exists(select 1 from public.space_members m where m.space_id=trip and m.participant_id=x.id and m.removed_at is null) and not (p.paid=0 and s.share=0 and exists(select 1 from public.expense_participations prior where prior.expense_id=e.id and prior.participant_id=x.id))');
  if patched = def then
    raise exception 'historical placeholder patch missed save_trip_expense_editor';
  end if;
  execute patched;

  def := pg_catalog.pg_get_functiondef('private.space_signed_outstanding(uuid,uuid,uuid,text)'::regprocedure);
  if pg_catalog.strpos(def, 'fx_cash_only') = 0 then
    patched := pg_catalog.replace(def, 'and payment.currency = pg_catalog.upper(currency_code)', 'and payment.currency = pg_catalog.upper(currency_code) and payment.fx_cash_only = false');
    if patched = def then raise exception 'cash exclusion patch missed space_signed_outstanding'; end if;
    execute patched;
  end if;
end
$patch$;

create table public.settlement_fx_bundles (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  space_id uuid not null references public.spaces(id),
  payer_participant_id uuid not null references public.participants(id),
  counterparty_participant_id uuid not null references public.participants(id),
  target_currency text not null,
  cash_minor bigint not null check (cash_minor >= 0 and cash_minor <= 9007199254740991),
  full_net_minor bigint not null check (full_net_minor >= 0),
  rate_mode text not null check (rate_mode in ('system','custom')),
  status text not null check (status in ('pending','accepted','declined','cancelled','reversed')),
  payer_account_id uuid,
  version integer not null default 1 check (version > 0),
  quote jsonb not null,
  created_at timestamptz not null default now(),
  unique (payer_participant_id, client_request_id),
  check (payer_participant_id <> counterparty_participant_id)
);
create table public.settlement_fx_coverages (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.settlement_fx_bundles(id),
  direction text not null check (direction in ('payer_owes','counterparty_owes')),
  currency text not null,
  covered_minor bigint not null check (covered_minor >= 0),
  remaining_minor bigint not null check (remaining_minor >= 0),
  rate_numerator text not null,
  rate_denominator text not null,
  settlement_payment_id uuid,
  unique (bundle_id, direction, currency)
);
alter table public.settlement_fx_bundles enable row level security;
alter table public.settlement_fx_coverages enable row level security;
create policy settlement_fx_bundles_read on public.settlement_fx_bundles for select to authenticated
  using (payer_participant_id = public.current_participant_id() or counterparty_participant_id = public.current_participant_id());
create policy settlement_fx_coverages_read on public.settlement_fx_coverages for select to authenticated
  using (exists (select 1 from public.settlement_fx_bundles b where b.id = bundle_id and (b.payer_participant_id = public.current_participant_id() or b.counterparty_participant_id = public.current_participant_id())));
revoke all on public.settlement_fx_bundles, public.settlement_fx_coverages from public, anon, authenticated;
grant select on public.settlement_fx_bundles, public.settlement_fx_coverages to authenticated;

create function private.currency_digits(code text) returns integer language sql immutable set search_path='' as $$
  select case pg_catalog.upper(code) when 'JPY' then 0 when 'KRW' then 0 when 'VND' then 0
    when 'AUD' then 2 when 'CNY' then 2 when 'EUR' then 2 when 'GBP' then 2 when 'HKD' then 2
    when 'MYR' then 2 when 'SGD' then 2 when 'THB' then 2 when 'TWD' then 2 when 'USD' then 2 else null end $$;
revoke all on function private.currency_digits(text) from public, anon, authenticated;

create function private.fx_round_div(numerator numeric, denominator numeric) returns bigint language plpgsql immutable set search_path='' as $$
declare q numeric; r numeric;
begin
  if denominator is null or denominator <= 0 then raise exception using message='invalid_rate', errcode='P0001'; end if;
  q := trunc(numerator / denominator); r := numerator - q * denominator;
  if r * 2 >= denominator then q := q + 1; end if;
  return q::bigint;
end $$;
revoke all on function private.fx_round_div(numeric,numeric) from public, anon, authenticated;

create function private.pending_pair_minor(target_space uuid, debtor uuid, creditor uuid, code text) returns bigint language sql stable security definer set search_path='' as $$
  select coalesce((select sum(a.amount_minor) from public.settlement_allocations a join public.settlement_payments p on p.id=a.settlement_payment_id
    where p.scope='space' and p.space_id=target_space and p.currency=pg_catalog.upper(code) and p.fx_cash_only=false and a.state='pending'
      and p.debtor_participant_id=debtor and a.creditor_participant_id=creditor),0)
  + coalesce((select sum(c.covered_minor) from public.settlement_fx_coverages c join public.settlement_fx_bundles b on b.id=c.bundle_id
    where b.space_id=target_space and b.status='pending' and c.currency=pg_catalog.upper(code)
      and ((c.direction='payer_owes' and b.payer_participant_id=debtor and b.counterparty_participant_id=creditor)
        or (c.direction='counterparty_owes' and b.payer_participant_id=creditor and b.counterparty_participant_id=debtor))),0)
$$;
revoke all on function private.pending_pair_minor(uuid,uuid,uuid,text) from public, anon, authenticated;

create function public.propose_fx_settlement_bundle(request_id uuid, target_space_id uuid, counterparty_id uuid, target_currency text, rate_mode text, custom_rates jsonb, cash_minor bigint, payer_account_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); existing public.settlement_fx_bundles%rowtype; code text; you_owe bigint; they_owe bigint; legs jsonb:='[]'::jsonb; you_value bigint:=0; they_value bigint:=0; full_minor bigint; net bigint; row jsonb; covered bigint; remaining bigint; num numeric; den numeric; rates jsonb:='{}'::jsonb; snap jsonb; expenses jsonb; new_bundle uuid; account public.personal_accounts%rowtype; scale_target numeric; scale_code numeric;
begin
  if request_id is null or counterparty_id is null or counterparty_id=actor or rate_mode not in ('system','custom') or cash_minor is null or cash_minor<0 then raise exception using message='invalid_amount', errcode='P0001'; end if;
  if private.currency_digits(target_currency) is null then raise exception using message='invalid_currency', errcode='P0001'; end if;
  if private.space_role(target_space_id, actor) is null or private.space_role(target_space_id, counterparty_id) is null then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into existing from public.settlement_fx_bundles where payer_participant_id=actor and client_request_id=request_id;
  if existing.id is not null then
    if existing.counterparty_participant_id is distinct from counterparty_id or existing.target_currency is distinct from pg_catalog.upper(target_currency) or existing.rate_mode is distinct from rate_mode or existing.cash_minor is distinct from cash_minor then raise exception using message='idempotency_conflict', errcode='P0001'; end if;
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
    if code=pg_catalog.upper(target_currency) then num:=1; den:=1;
    elsif rate_mode='custom' then
      if coalesce(custom_rates->>code,'') !~ '^[0-9]+(\.[0-9]+)?$' or (custom_rates->>code)::numeric<=0 then raise exception using message='invalid_rate', errcode='P0001'; end if;
      num:=(custom_rates->>code)::numeric; den:=1;
    else
      if target_currency<>'MYR' and (snap->pg_catalog.upper(target_currency)->>'denominator') is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
      if (snap->code->>'denominator') is null then raise exception using message='fx_rate_unavailable', errcode='P0001'; end if;
      num:=(snap->code->>'denominator')::numeric; den:=(snap->code->>'numerator')::numeric;
      if pg_catalog.upper(target_currency)<>'MYR' then
        num:=num / den * (snap->pg_catalog.upper(target_currency)->>'numerator')::numeric;
        den:=(snap->pg_catalog.upper(target_currency)->>'denominator')::numeric;
      end if;
    end if;
    if num<=0 or den<=0 then raise exception using message='invalid_rate', errcode='P0001'; end if;
    rates:=rates||jsonb_build_object(code, jsonb_build_object('numerator',num::text,'denominator',den::text));
    if row->>'direction'='payer_owes' then you_value:=you_value+private.fx_round_div((row->>'remaining')::numeric * scale_target * den, num * scale_code);
    else they_value:=they_value+private.fx_round_div((row->>'remaining')::numeric * scale_target * den, num * scale_code); end if;
  end loop;
  net:=you_value-they_value; full_minor:=abs(net);
  if net<0 then raise exception using message='not_net_payer', errcode='P0001'; end if;
  if full_minor=0 then
    if cash_minor<>0 then raise exception using message='invalid_amount', errcode='P0001'; end if;
  elsif cash_minor=0 or cash_minor>full_minor then raise exception using message='invalid_amount', errcode='P0001'; end if;
  if cash_minor>0 then
    select * into account from public.personal_accounts where id=payer_account_id and owner_participant_id=actor and archived_at is null and currency=pg_catalog.upper(target_currency);
    if account.id is null then raise exception using message='settlement_cash_account_invalid', errcode='P0001'; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version) order by e.id),'[]'::jsonb) into expenses from public.expenses e
    where e.scope='space' and e.space_id=target_space_id and e.status='active' and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id in (actor,counterparty_id));
  insert into public.settlement_fx_bundles(client_request_id,space_id,payer_participant_id,counterparty_participant_id,target_currency,cash_minor,full_net_minor,rate_mode,status,payer_account_id,quote)
    values(request_id,target_space_id,actor,counterparty_id,pg_catalog.upper(target_currency),cash_minor,full_minor,rate_mode,'pending',payer_account_id,jsonb_build_object('rates',rates,'expenses',expenses,'legs',legs))
    returning id into new_bundle;
  for leg_index in 0..jsonb_array_length(legs)-1 loop
    row:=legs->leg_index; remaining:=(row->>'remaining')::bigint;
    covered:=case when full_minor=0 or cash_minor=full_minor then remaining else least(remaining, private.fx_round_div(remaining::numeric*cash_minor, full_minor::numeric)) end;
    if cash_minor>0 and covered=0 and jsonb_array_length(legs)=1 then raise exception using message='amount_too_small', errcode='P0001'; end if;
    insert into public.settlement_fx_coverages(bundle_id,direction,currency,covered_minor,remaining_minor,rate_numerator,rate_denominator)
      values(new_bundle,row->>'direction',row->>'currency',covered,remaining-covered,rates->(row->>'currency')->>'numerator',rates->(row->>'currency')->>'denominator');
  end loop;
  if cash_minor>0 and not exists(select 1 from public.settlement_fx_coverages c where c.bundle_id=new_bundle and c.covered_minor>0) then raise exception using message='amount_too_small', errcode='P0001'; end if;
  return jsonb_build_object('bundle_id',new_bundle,'status','pending','version',1,'cash_minor',cash_minor,'full_net_minor',full_minor);
end $$;

create function public.respond_fx_settlement_bundle(target_bundle_id uuid, response text, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; expenses jsonb; payment_id uuid; debtor uuid; creditor uuid; allocation_id uuid;
begin
  if actor is null or response not in ('accepted','declined') then raise exception using message='invalid_amount', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null then raise exception using message='allocation_not_found', errcode='P0001'; end if;
  if bundle.status<>'pending' then return jsonb_build_object('bundle_id',bundle.id,'status',bundle.status,'version',bundle.version); end if;
  if actor is distinct from bundle.counterparty_participant_id then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  if response='declined' then
    update public.settlement_fx_bundles set status='declined', version=version+1 where id=bundle.id;
    return jsonb_build_object('bundle_id',bundle.id,'status','declined','version',bundle.version+1);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'version',e.version) order by e.id),'[]'::jsonb) into expenses from public.expenses e
    where e.scope='space' and e.space_id=bundle.space_id and e.status='active' and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id in (bundle.payer_participant_id,bundle.counterparty_participant_id));
  if expenses is distinct from bundle.quote->'expenses' then raise exception using message='balance_changed', errcode='P0001'; end if;
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and covered_minor>0 order by currency, direction loop
    debtor:=case when coverage.direction='payer_owes' then bundle.payer_participant_id else bundle.counterparty_participant_id end;
    creditor:=case when coverage.direction='payer_owes' then bundle.counterparty_participant_id else bundle.payer_participant_id end;
    insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only)
      values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':coverage:'||coverage.id::text),'space',bundle.space_id,debtor,coverage.currency,coverage.covered_minor,current_date,'confirmed','fx-coverage',false)
      returning id into payment_id;
    insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)
      values(payment_id,creditor,coverage.covered_minor,'accepted',now()) returning id into allocation_id;
    update public.settlement_fx_coverages set settlement_payment_id=payment_id where id=coverage.id;
    insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)
      values(actor,payment_id,'settlement.fx_coverage_accepted',jsonb_build_object('bundle_id',bundle.id,'allocation_id',allocation_id,'currency',coverage.currency,'amount_minor',coverage.covered_minor,'rate_numerator',coverage.rate_numerator,'rate_denominator',coverage.rate_denominator));
  end loop;
  if bundle.cash_minor>0 then
    insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only)
      values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', bundle.id::text||':cash'),'space',bundle.space_id,bundle.payer_participant_id,bundle.target_currency,bundle.cash_minor,current_date,'confirmed','fx-cash',true)
      returning id into payment_id;
    insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)
      values(payment_id,bundle.counterparty_participant_id,bundle.cash_minor,'accepted',now());
  end if;
  update public.settlement_fx_bundles set status='accepted', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','accepted','version',bundle.version+1,'cash_minor',bundle.cash_minor);
end $$;

create function public.cancel_fx_settlement_bundle(target_bundle_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype;
begin
  if actor is null then raise exception using message='not_authenticated', errcode='P0001'; end if;
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null or bundle.payer_participant_id is distinct from actor then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if bundle.status<>'pending' then return jsonb_build_object('bundle_id',bundle.id,'status',bundle.status,'version',bundle.version); end if;
  if expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  update public.settlement_fx_bundles set status='cancelled', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','cancelled','version',bundle.version+1);
end $$;

create function public.reverse_fx_settlement_bundle(reversal_request_id uuid, target_bundle_id uuid, expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); bundle public.settlement_fx_bundles%rowtype; coverage public.settlement_fx_coverages%rowtype; allocation public.settlement_allocations%rowtype;
begin
  if actor is null or reversal_request_id is null then raise exception using message='invalid_request_id', errcode='P0001'; end if;
  perform private.lock_collect_pay_balance();
  select * into bundle from public.settlement_fx_bundles where id=target_bundle_id for update;
  if bundle.id is null or actor not in (bundle.payer_participant_id, bundle.counterparty_participant_id) then raise exception using message='settlement_participant_denied', errcode='P0001'; end if;
  if bundle.status='reversed' then return jsonb_build_object('bundle_id',bundle.id,'status','reversed','version',bundle.version); end if;
  if bundle.status<>'accepted' or expected_version is distinct from bundle.version then raise exception using message='version_conflict', errcode='P0001'; end if;
  for coverage in select * from public.settlement_fx_coverages where bundle_id=bundle.id and settlement_payment_id is not null loop
    select * into allocation from public.settlement_allocations where settlement_payment_id=coverage.settlement_payment_id;
    if not exists(select 1 from public.settlement_allocation_reversals where settlement_allocation_id=allocation.id) then
      insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)
        values(extensions.uuid_generate_v5('76c9cd65-ed72-51b4-8244-2b06bdb3661e', reversal_request_id::text||':'||allocation.id::text),allocation.id,actor,allocation.amount_minor,'fx-bundle-reversal');
      perform public.recompute_settlement_status(coverage.settlement_payment_id);
    end if;
  end loop;
  update public.settlement_fx_bundles set status='reversed', version=version+1 where id=bundle.id;
  return jsonb_build_object('bundle_id',bundle.id,'status','reversed','version',bundle.version+1);
end $$;

revoke all on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid), public.respond_fx_settlement_bundle(uuid,text,integer), public.cancel_fx_settlement_bundle(uuid,integer), public.reverse_fx_settlement_bundle(uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid), public.respond_fx_settlement_bundle(uuid,text,integer), public.cancel_fx_settlement_bundle(uuid,integer), public.reverse_fx_settlement_bundle(uuid,uuid,integer) to authenticated;

commit;
