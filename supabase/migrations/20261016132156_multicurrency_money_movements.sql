-- Own-money movements compose the EXISTING transfer and expense-funding journal.
-- A fee is a linked canonical expense; a transfer principal is never spending.
create table public.personal_money_movements (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  operation_id uuid not null unique references public.personal_money_operations(id),
  kind text not null check(kind in('transfer','exchange','withdrawal')),
  source_account_id uuid not null references public.personal_accounts(id),
  destination_account_id uuid not null references public.personal_accounts(id),
  source_total_minor bigint not null check(source_total_minor between 1 and 9007199254740991),
  destination_net_minor bigint not null check(destination_net_minor between 1 and 9007199254740991),
  source_currency text not null,
  destination_currency text not null,
  occurred_on date not null,
  memo text,
  transfer_transaction_id uuid not null unique references public.personal_account_transactions(id),
  version integer not null default 1,
  reversed_operation_id uuid unique references public.personal_money_operations(id),
  created_at timestamptz not null default now(),
  check(source_account_id<>destination_account_id)
);
create index personal_money_movements_owner_idx on public.personal_money_movements(owner_participant_id,occurred_on desc,created_at desc);

create table public.personal_money_movement_fees (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  movement_id uuid not null unique references public.personal_money_movements(id),
  operation_id uuid not null unique references public.personal_money_operations(id),
  mode text not null check(mode in('included_source','included_destination','separate')),
  account_id uuid not null references public.personal_accounts(id),
  amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
  currency text not null,
  expense_id uuid not null unique references public.expenses(id),
  transaction_id uuid unique references public.personal_account_transactions(id),
  created_at timestamptz not null default now()
);

create table public.personal_money_movement_coverage (
  owner_participant_id uuid not null references public.participants(id),
  movement_id uuid not null references public.personal_money_movements(id),
  account_id uuid not null references public.personal_accounts(id),
  anchor_id uuid not null references public.personal_account_balance_anchors(id),
  included_in_anchor boolean not null,
  calibration_transaction_id uuid unique references public.personal_account_transactions(id),
  primary key(movement_id,account_id)
);

do $$ declare t text; begin
  foreach t in array array['personal_money_movements','personal_money_movement_fees','personal_money_movement_coverage'] loop
    execute pg_catalog.format('alter table public.%I enable row level security',t);
    execute pg_catalog.format('revoke all on table public.%I from public,anon,authenticated',t);
    execute pg_catalog.format('grant select on table public.%I to authenticated',t);
    execute pg_catalog.format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and owner_participant_id=(select public.current_participant_id()))',t||'_select_owner',t);
  end loop;
end $$;

create or replace function private.assert_money_anchor(unit_id uuid,coverage jsonb)
returns public.personal_account_balance_anchors language plpgsql stable security definer set search_path='' as $$
declare anchor public.personal_account_balance_anchors%rowtype;
begin
  select * into anchor from public.personal_account_balance_anchors a where a.account_id=unit_id order by a.anchor_sequence desc limit 1;
  if anchor.id is not null and ((coverage->>'anchor_id')::uuid is distinct from anchor.id
    or pg_catalog.jsonb_typeof(coverage->'included_in_anchor') is distinct from 'boolean') then
    raise exception using message='balance_coverage_required',errcode='P0001';
  elsif anchor.id is null and (coverage->>'anchor_id' is not null or coverage->>'included_in_anchor' is not null) then
    raise exception using message='balance_coverage_changed',errcode='P0001';
  end if;
  return anchor;
end $$;

create or replace function private.guard_recorded_movement_fee()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.personal_money_movement_fees f where f.expense_id=new.expense_id) then
    raise exception using message='movement_fee_already_funded',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_movement_fee_funding_guard before insert on public.personal_funding_intents
  for each row execute function private.guard_recorded_movement_fee();

create or replace function private.guard_movement_fee_financial_edit()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.personal_money_movement_fees f where f.expense_id=old.id)
    and (new.total_minor<>old.total_minor or new.currency<>old.currency or new.scope<>old.scope or new.created_by<>old.created_by) then
    raise exception using message='movement_fee_review_required',errcode='P0001';
  end if;
  return new;
end $$;
create trigger movement_fee_expense_financial_guard before update on public.expenses
  for each row execute function private.guard_movement_fee_financial_edit();

create or replace function public.record_personal_money_movement(request_id uuid,movement_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb;
  source_row public.personal_accounts%rowtype; target_row public.personal_accounts%rowtype; fee_row public.personal_accounts%rowtype;
  anchor public.personal_account_balance_anchors%rowtype;
  source_id uuid:=(movement_payload->>'source_account_id')::uuid; target_id uuid:=(movement_payload->>'destination_account_id')::uuid;
  source_parent uuid; target_parent uuid; unit_ids uuid[];
  out_amount bigint:=(movement_payload->>'source_total_minor')::bigint; in_amount bigint:=(movement_payload->>'destination_net_minor')::bigint;
  source_principal bigint; target_gross bigint; fee_amount bigint; fee_id uuid; fee_expense uuid; fee_transaction uuid;
  movement_date date:=(movement_payload->>'occurred_on')::date; fee jsonb:=movement_payload->'fee'; fee_mode text;
  movement_kind text:=movement_payload->>'kind'; movement_memo text:=nullif(pg_catalog.btrim(movement_payload->>'memo'),'');
  movement_id uuid:=gen_random_uuid(); operation_id uuid; transfer_id uuid; unit record; coverage jsonb; delta numeric; calibration_id uuid; baseline numeric;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'record_movement',movement_payload);
  if result_payload is not null then return result_payload; end if;
  if source_id is null or target_id is null or source_id=target_id or out_amount is null or in_amount is null
    or out_amount not between 1 and 9007199254740991 or in_amount not between 1 and 9007199254740991
    or movement_date is null or movement_kind is null or movement_kind not in('transfer','exchange','withdrawal') then
    raise exception using message='invalid_transfer',errcode='P0001';
  end if;
  source_principal:=out_amount;target_gross:=in_amount;unit_ids:=array[source_id,target_id];
  if fee is not null and fee<>'null'::jsonb then
    fee_mode:=fee->>'mode';fee_amount:=(fee->>'amount_minor')::bigint;fee_id:=(fee->>'account_id')::uuid;
    if fee_amount is null or fee_amount not between 1 and 9007199254740991 or fee_mode is null
      or fee_mode not in('included_source','included_destination','separate') or fee_id is null then
      raise exception using message='invalid_movement_fee',errcode='P0001';
    end if;
    if fee_mode='included_source' then
      if fee_id<>source_id or fee_amount>=out_amount then raise exception using message='fee_exceeds_principal',errcode='P0001'; end if;
      source_principal:=out_amount-fee_amount;
    elsif fee_mode='included_destination' then
      if fee_id<>target_id or fee_amount>=in_amount or in_amount+fee_amount>9007199254740991 then
        raise exception using message='invalid_movement_fee',errcode='P0001';
      end if;
      target_gross:=in_amount+fee_amount;
    end if;
    unit_ids:=pg_catalog.array_append(unit_ids,fee_id);
    select * into fee_row from public.personal_accounts a where a.id=fee_id and a.owner_participant_id=actor;
    if fee_row.id is null then raise exception using message='personal_account_not_found',errcode='P0001'; end if;
    -- Original personal expense authority, locked before native account rows.
    -- A later failure rolls this back with the entire movement.
    fee_expense:=public.create_expense(private.money_child_request(request_id,'fee-expense'),'personal',null,fee_amount,fee_row.currency,
      'Money movement fee','Fees',movement_date,array[actor],array[fee_amount],array[fee_amount]);
  end if;
  perform 1 from public.personal_accounts a where a.owner_participant_id=actor and (a.id=any(unit_ids)
    or a.id in(select c.parent_account_id from public.personal_account_currencies c where c.account_id=any(unit_ids))) order by a.id for update;
  source_row:=private.assert_money_unit(actor,source_id,(movement_payload->>'source_version')::integer,(movement_payload->>'source_parent_version')::integer);
  target_row:=private.assert_money_unit(actor,target_id,(movement_payload->>'destination_version')::integer,(movement_payload->>'destination_parent_version')::integer);
  if source_row.account_class<>'asset' or target_row.account_class<>'asset' then raise exception using message='asset_account_required',errcode='P0001'; end if;
  source_parent:=coalesce((select c.parent_account_id from public.personal_account_currencies c where c.account_id=source_id),source_id);
  target_parent:=coalesce((select c.parent_account_id from public.personal_account_currencies c where c.account_id=target_id),target_id);
  if movement_kind='exchange' then
    if source_parent<>target_parent or source_row.currency=target_row.currency then raise exception using message='invalid_exchange_pair',errcode='P0001'; end if;
  else
    if source_parent=target_parent then raise exception using message='use_exchange',errcode='P0001'; end if;
    if movement_kind='withdrawal' and target_row.account_type<>'cash' then raise exception using message='withdrawal_requires_cash',errcode='P0001'; end if;
    if target_row.account_type='cash' then movement_kind:='withdrawal'; end if;
  end if;
  if source_row.currency=target_row.currency and source_principal<>target_gross then raise exception using message='same_currency_transfer_mismatch',errcode='P0001'; end if;
  if fee_id is not null then
    fee_row:=private.assert_money_unit(actor,fee_id,(fee->>'version')::integer,(fee->>'parent_version')::integer);
    if fee_row.currency is distinct from fee->>'currency' then raise exception using message='account_currency_mismatch',errcode='P0001'; end if;
  end if;
  perform private.assert_money_anchor(source_id,movement_payload->'source_coverage');
  perform private.assert_money_anchor(target_id,movement_payload->'destination_coverage');
  if fee_id is not null and fee_id<>source_id and fee_id<>target_id then perform private.assert_money_anchor(fee_id,fee->'coverage'); end if;
  result_payload:=public.create_transfer_transaction(private.money_child_request(request_id,'principal'),source_id,source_principal,target_id,target_gross,movement_date,movement_memo);
  transfer_id:=(result_payload->>'transaction_id')::uuid;
  select o.id into operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=record_personal_money_movement.request_id;
  insert into public.personal_money_movements(id,owner_participant_id,operation_id,kind,source_account_id,destination_account_id,source_total_minor,destination_net_minor,
    source_currency,destination_currency,occurred_on,memo,transfer_transaction_id)
    values(movement_id,actor,operation_id,movement_kind,source_id,target_id,out_amount,in_amount,source_row.currency,target_row.currency,movement_date,movement_memo,transfer_id);
  if fee_id is not null then
    result_payload:=public.link_expense_funding(private.money_child_request(request_id,'fee-funding'),fee_expense,fee_id,fee_amount);
    fee_transaction:=(result_payload->>'posted_transaction_id')::uuid;
    insert into public.personal_money_movement_fees(owner_participant_id,movement_id,operation_id,mode,account_id,amount_minor,currency,expense_id,transaction_id)
      values(actor,movement_id,operation_id,fee_mode,fee_id,fee_amount,fee_row.currency,fee_expense,fee_transaction);
  end if;
  -- Compensate only when the user explicitly declares the actual movement was
  -- already included in an observed balance. Never infer coverage from a date.
  for unit in select e.account_id,pg_catalog.sum(e.amount_minor) amount
    from public.personal_account_entries e where e.transaction_id in(transfer_id,fee_transaction) group by e.account_id loop
    coverage:=case when unit.account_id=source_id then movement_payload->'source_coverage'
      when unit.account_id=target_id then movement_payload->'destination_coverage' else fee->'coverage' end;
    anchor:=private.assert_money_anchor(unit.account_id,coverage);calibration_id:=null;
    if anchor.id is not null then
      if (coverage->>'included_in_anchor')::boolean and unit.amount<>0 then
        select coalesce(pg_catalog.sum(e.amount_minor),0) into baseline from public.personal_account_entries e where e.account_id=unit.account_id;
        delta:=baseline-unit.amount;
        if delta not between -9007199254740991 and 9007199254740991 then raise exception using message='amount_overflow',errcode='P0001'; end if;
        result_payload:=public.reconcile_account_to_stated_balance(private.money_child_request(request_id,'coverage:'||unit.account_id::text),unit.account_id,delta::bigint,
          anchor.observed_at::date,'Previously included actual movement',(select a.version from public.personal_accounts a where a.id=unit.account_id));
        calibration_id:=(result_payload->>'transaction_id')::uuid;
      end if;
      insert into public.personal_money_movement_coverage(owner_participant_id,movement_id,account_id,anchor_id,included_in_anchor,calibration_transaction_id)
        values(actor,movement_id,unit.account_id,anchor.id,(coverage->>'included_in_anchor')::boolean,calibration_id);
    end if;
    perform private.assert_native_balance_range(unit.account_id);
  end loop;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('movement_id',movement_id,'transaction_id',transfer_id,'kind',movement_kind,'fee_expense_id',fee_expense));
end $$;

create or replace function public.itemise_personal_movement_fee(
  request_id uuid,target_movement_id uuid,expected_version integer,fee_mode text,fee_amount_minor bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; movement public.personal_money_movements%rowtype;
  fee_unit uuid; fee_currency text; expense_id uuid; operation_id uuid;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'itemise_movement_fee',pg_catalog.jsonb_build_object(
    'movement',target_movement_id,'version',expected_version,'mode',fee_mode,'amount',fee_amount_minor));
  if result_payload is not null then return result_payload; end if;
  select * into movement from public.personal_money_movements m where m.id=target_movement_id and m.owner_participant_id=actor for update;
  if movement.id is null then raise exception using message='movement_not_found',errcode='P0001'; end if;
  if movement.version is distinct from expected_version or movement.reversed_operation_id is not null then raise exception using message='version_conflict',errcode='P0001'; end if;
  if exists(select 1 from public.personal_money_movement_fees f where f.movement_id=movement.id) then raise exception using message='fee_already_itemised',errcode='P0001'; end if;
  if fee_mode is null or fee_mode not in('included_source','included_destination') or fee_amount_minor is null or fee_amount_minor<=0
    or (fee_mode='included_source' and fee_amount_minor>=movement.source_total_minor)
    or (fee_mode='included_destination' and fee_amount_minor>=movement.destination_net_minor) then
    raise exception using message='invalid_movement_fee',errcode='P0001';
  end if;
  -- A previously balanced same-currency transfer cannot hide an unequal fee.
  if movement.source_currency=movement.destination_currency then raise exception using message='same_currency_transfer_mismatch',errcode='P0001'; end if;
  fee_unit:=case when fee_mode='included_source' then movement.source_account_id else movement.destination_account_id end;
  fee_currency:=case when fee_mode='included_source' then movement.source_currency else movement.destination_currency end;
  expense_id:=public.create_expense(private.money_child_request(request_id,'classification'),'personal',null,fee_amount_minor,fee_currency,
    'Money movement fee','Fees',movement.occurred_on,array[actor],array[fee_amount_minor],array[fee_amount_minor]);
  select o.id into operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=itemise_personal_movement_fee.request_id;
  insert into public.personal_money_movement_fees(owner_participant_id,movement_id,operation_id,mode,account_id,amount_minor,currency,expense_id)
    values(actor,movement.id,operation_id,fee_mode,fee_unit,fee_amount_minor,fee_currency,expense_id);
  update public.personal_money_movements set version=version+1 where id=movement.id;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('movement_id',movement.id,'fee_expense_id',expense_id,'classification_only',true));
end $$;

create or replace function private.guard_money_movement_reversal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind<>'reversal' then return new; end if;
  if exists(select 1 from public.personal_money_movement_coverage c where c.calibration_transaction_id=new.reverses_transaction_id) then
    raise exception using message='balance_anchor_review_required',errcode='P0001';
  end if;
  if exists(select 1 from public.personal_money_movements m left join public.personal_money_movement_fees f on f.movement_id=m.id
    where new.reverses_transaction_id in(m.transfer_transaction_id,f.transaction_id))
    and not exists(select 1 from public.personal_money_movements m
      left join public.personal_money_movement_fees f on f.movement_id=m.id
      join public.personal_money_operations o on o.id=m.reversed_operation_id
      where new.reverses_transaction_id in(m.transfer_transaction_id,f.transaction_id)
        and o.owner_participant_id=new.owner_participant_id and o.kind='reverse_movement' and o.result is null) then
    raise exception using message='money_movement_reversal_required',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_movement_reversal_guard before insert on public.personal_account_transactions
  for each row execute function private.guard_money_movement_reversal();

create or replace function public.reverse_personal_money_movement(
  request_id uuid,target_movement_id uuid,expected_version integer,occurred_on date,transaction_memo text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; movement public.personal_money_movements%rowtype;
  fee public.personal_money_movement_fees%rowtype; reversal_operation_id uuid; expense_version integer;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'reverse_movement',pg_catalog.jsonb_build_object(
    'movement',target_movement_id,'version',expected_version,'date',occurred_on,'memo',transaction_memo));
  if result_payload is not null then return result_payload; end if;
  select * into movement from public.personal_money_movements m where m.id=target_movement_id and m.owner_participant_id=actor for update;
  if movement.id is null then raise exception using message='movement_not_found',errcode='P0001'; end if;
  if movement.version is distinct from expected_version or movement.reversed_operation_id is not null then raise exception using message='version_conflict',errcode='P0001'; end if;
  select o.id into reversal_operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=reverse_personal_money_movement.request_id;
  update public.personal_money_movements m set reversed_operation_id=reversal_operation_id,version=m.version+1 where m.id=movement.id;
  result_payload:=public.reverse_personal_account_transaction(private.money_child_request(request_id,'principal'),movement.transfer_transaction_id,occurred_on,transaction_memo);
  select * into fee from public.personal_money_movement_fees f where f.movement_id=movement.id;
  if fee.id is not null then
    if fee.transaction_id is not null then perform public.reverse_personal_account_transaction(private.money_child_request(request_id,'fee'),fee.transaction_id,occurred_on,transaction_memo); end if;
    select e.version into expense_version from public.expenses e where e.id=fee.expense_id and e.status='active';
    if expense_version is not null then perform public.cancel_expense(fee.expense_id,expense_version,'Recorded movement reversal'); end if;
  end if;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('movement_id',movement.id,'state','reversed','reversal_transaction_id',result_payload->>'transaction_id'));
end $$;

revoke all on function private.assert_money_anchor(uuid,jsonb) from public,anon,authenticated;
revoke all on function private.guard_recorded_movement_fee() from public,anon,authenticated;
revoke all on function private.guard_movement_fee_financial_edit() from public,anon,authenticated;
revoke all on function private.guard_money_movement_reversal() from public,anon,authenticated;
revoke all on function public.record_personal_money_movement(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.itemise_personal_movement_fee(uuid,uuid,integer,text,bigint) from public,anon,authenticated;
revoke all on function public.reverse_personal_money_movement(uuid,uuid,integer,date,text) from public,anon,authenticated;
grant execute on function public.record_personal_money_movement(uuid,jsonb) to authenticated;
grant execute on function public.itemise_personal_movement_fee(uuid,uuid,integer,text,bigint) to authenticated;
grant execute on function public.reverse_personal_money_movement(uuid,uuid,integer,date,text) to authenticated;
