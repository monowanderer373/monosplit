-- Additive currency grouping over the original immutable native account units.
-- Original account IDs, currencies, openings and journals are never copied.

create table public.personal_account_currencies (
  account_id uuid primary key references public.personal_accounts(id),
  parent_account_id uuid not null references public.personal_accounts(id),
  owner_participant_id uuid not null references public.participants(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  display_order integer not null default 1 check (display_order > 0),
  created_at timestamptz not null default now(),
  unique(parent_account_id,currency),
  check(account_id <> parent_account_id)
);

create table public.personal_money_operations (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  request_id uuid not null,
  kind text not null,
  payload_fingerprint text not null check(payload_fingerprint ~ '^[0-9a-f]{64}$'),
  result jsonb,
  created_at timestamptz not null default now(),
  unique(owner_participant_id,request_id)
);

create table public.personal_account_balance_anchors (
  id uuid primary key default gen_random_uuid(),
  anchor_sequence bigint generated always as identity unique,
  owner_participant_id uuid not null references public.participants(id),
  account_id uuid not null references public.personal_accounts(id),
  operation_id uuid not null unique references public.personal_money_operations(id),
  observed_balance_minor bigint not null check(observed_balance_minor between -9007199254740991 and 9007199254740991),
  observed_at timestamptz not null,
  captured_account_version integer not null,
  captured_entry_ids uuid[] not null,
  included_entry_ids uuid[] not null,
  pending_intent_ids uuid[] not null,
  calibration_transaction_id uuid references public.personal_account_transactions(id),
  created_at timestamptz not null default now()
);
create index personal_balance_anchor_account_idx on public.personal_account_balance_anchors(account_id,anchor_sequence desc);

create table public.personal_funding_bundles (
  funding_intent_id uuid primary key references public.personal_funding_intents(id),
  owner_participant_id uuid not null references public.participants(id),
  primary_account_id uuid references public.personal_accounts(id),
  confirmed_operation_id uuid unique references public.personal_money_operations(id),
  reversed_operation_id uuid unique references public.personal_money_operations(id),
  created_at timestamptz not null default now()
);
create index personal_funding_bundle_primary_idx on public.personal_funding_bundles(owner_participant_id,primary_account_id);

create table public.personal_funding_bundle_legs (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  funding_intent_id uuid not null references public.personal_funding_bundles(funding_intent_id),
  account_id uuid not null references public.personal_accounts(id),
  amount_minor bigint not null check(amount_minor between 1 and 9007199254740991),
  currency text not null check(currency ~ '^[A-Z]{3}$'),
  transaction_id uuid not null unique references public.personal_account_transactions(id),
  anchor_id uuid references public.personal_account_balance_anchors(id),
  included_in_anchor boolean,
  calibration_transaction_id uuid unique references public.personal_account_transactions(id),
  created_at timestamptz not null default now(),
  unique(funding_intent_id,account_id),
  check((anchor_id is null and included_in_anchor is null) or (anchor_id is not null and included_in_anchor is not null))
);

-- All new relations are owner-private and read-only to normal clients.
do $$
declare t text;
begin
  foreach t in array array['personal_account_currencies','personal_money_operations',
    'personal_account_balance_anchors','personal_funding_bundles','personal_funding_bundle_legs'] loop
    execute pg_catalog.format('alter table public.%I enable row level security',t);
    execute pg_catalog.format('revoke all on table public.%I from public,anon,authenticated',t);
    execute pg_catalog.format('grant select on table public.%I to authenticated',t);
    execute pg_catalog.format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and owner_participant_id = (select public.current_participant_id()))',t||'_select_owner',t);
  end loop;
end $$;

-- Old clients never enumerate added currency units as independent accounts.
alter policy personal_accounts_select_owner on public.personal_accounts
using ((select auth.uid()) is not null
  and owner_participant_id = (select public.current_participant_id())
  and not exists(select 1 from public.personal_account_currencies c where c.account_id = personal_accounts.id));

create or replace function private.money_child_request(request_id uuid,label text)
returns uuid language sql immutable set search_path = '' as $$
  select pg_catalog.md5(request_id::text || ':' || label)::uuid;
$$;

create or replace function private.begin_money_operation(actor uuid,request_id uuid,operation_kind text,payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_row public.personal_money_operations%rowtype;
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object('kind',operation_kind,'payload',payload));
begin
  if request_id is null then raise exception using message='invalid_request_id',errcode='P0001'; end if;
  -- Match the existing create/default/archive lock before taking account rows.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal.account:'||actor::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.money:'||actor::text||':'||request_id::text,0));
  select * into old_row from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=begin_money_operation.request_id;
  if old_row.id is not null then
    if old_row.payload_fingerprint <> fingerprint or old_row.kind <> operation_kind then
      raise exception using message='idempotency_conflict',errcode='P0001';
    end if;
    if old_row.result is null then raise exception using message='operation_not_finalized',errcode='P0001'; end if;
    return old_row.result;
  end if;
  insert into public.personal_money_operations(owner_participant_id,request_id,kind,payload_fingerprint)
    values(actor,request_id,operation_kind,fingerprint);
  return null;
end $$;

create or replace function private.finish_money_operation(actor uuid,request_id uuid,result_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  update public.personal_money_operations o set result=result_payload
    where o.owner_participant_id=actor and o.request_id=finish_money_operation.request_id;
  if not found or result_payload is null then raise exception using message='operation_not_finalized',errcode='P0001'; end if;
  return result_payload;
end $$;

create or replace function private.assert_money_operation_finalized()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.personal_money_operations where id=new.id and result is null) then
    raise exception using message='operation_not_finalized',errcode='P0001';
  end if;
  return null;
end $$;
create constraint trigger money_operation_finalized after insert or update on public.personal_money_operations
  deferrable initially deferred for each row execute function private.assert_money_operation_finalized();

create or replace function private.validate_currency_unit()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent public.personal_accounts%rowtype; unit public.personal_accounts%rowtype;
begin
  select * into parent from public.personal_accounts where id=new.parent_account_id;
  select * into unit from public.personal_accounts where id=new.account_id;
  if parent.id is null or unit.id is null or parent.owner_participant_id <> new.owner_participant_id
     or unit.owner_participant_id <> new.owner_participant_id or parent.currency = new.currency
     or unit.currency <> new.currency or parent.account_type <> unit.account_type
     or parent.account_class <> unit.account_class or unit.is_default
     or exists(select 1 from public.personal_account_currencies where account_id=parent.id) then
    raise exception using message='invalid_currency_unit',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_currency_unit_validate before insert or update on public.personal_account_currencies
  for each row execute function private.validate_currency_unit();

create or replace function private.guard_currency_unit_account()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_default and exists(select 1 from public.personal_account_currencies where account_id=new.id) then
    raise exception using message='currency_unit_not_default',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_currency_default_guard before update on public.personal_accounts
  for each row execute function private.guard_currency_unit_account();

create or replace function private.archive_child_currency_units()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    update public.personal_accounts a set archived_at=new.archived_at,is_default=false,version=a.version+1
    where a.id in(select c.account_id from public.personal_account_currencies c where c.parent_account_id=new.id)
      and a.archived_at is null;
  end if;
  return new;
end $$;
create trigger personal_currency_parent_archive after update of archived_at on public.personal_accounts
  for each row execute function private.archive_child_currency_units();

create or replace function private.guard_currency_unit_entry()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.personal_account_currencies c join public.personal_accounts p on p.id=c.parent_account_id
    where c.account_id=new.account_id and p.archived_at is not null)
    and not exists(select 1 from public.personal_account_transactions t where t.id=new.transaction_id and t.kind='reversal') then
    raise exception using message='personal_account_archived',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_currency_entry_guard before insert on public.personal_account_entries
  for each row execute function private.guard_currency_unit_entry();

create or replace function public.get_personal_multicurrency_accounts()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.require_personal_actor(); units jsonb;
begin
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',a.id,'parent_account_id',coalesce(c.parent_account_id,a.id),'name',p.name,
    'account_type',a.account_type,'account_class',a.account_class,'currency',a.currency,
    'archived_at',coalesce(p.archived_at,a.archived_at),'is_default',a.is_default,
    'opening_status',a.opening_status,'opening_balance_as_of',a.opening_balance_as_of,
    'version',a.version,'parent_version',p.version,'display_order',coalesce(c.display_order,0),
    'entry_sum_minor',coalesce(j.amount,0)::text,'entry_count',coalesce(j.count,0)::text
  ) order by p.created_at,p.id,coalesce(c.display_order,0),a.id),'[]'::jsonb) into units
  from public.personal_accounts a
  left join public.personal_account_currencies c on c.account_id=a.id
  join public.personal_accounts p on p.id=coalesce(c.parent_account_id,a.id) and p.owner_participant_id=actor
  left join lateral(select pg_catalog.sum(e.amount_minor) amount,pg_catalog.count(*) count
    from public.personal_account_entries e where e.account_id=a.id) j on true
  where a.owner_participant_id=actor;
  return pg_catalog.jsonb_build_object('schema_version',1,'accounts',units);
end $$;

create or replace function public.get_personal_money_operation(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid := private.require_personal_actor(); result_payload jsonb;
begin
  select o.result into result_payload from public.personal_money_operations o
    where o.owner_participant_id=actor and o.request_id=get_personal_money_operation.request_id;
  return result_payload;
end $$;

create or replace function private.assert_money_unit(actor uuid,unit_id uuid,expected_version integer,expected_parent_version integer)
returns public.personal_accounts language plpgsql security definer set search_path='' as $$
declare unit public.personal_accounts%rowtype; parent public.personal_accounts%rowtype;
begin
  select * into unit from public.personal_accounts where id=unit_id and owner_participant_id=actor for update;
  select p.* into parent from public.personal_accounts p
    where p.id=coalesce((select c.parent_account_id from public.personal_account_currencies c where c.account_id=unit_id),unit_id)
      and p.owner_participant_id=actor for update;
  if unit.id is null or parent.id is null then raise exception using message='personal_account_not_found',errcode='P0001'; end if;
  if unit.archived_at is not null or parent.archived_at is not null then raise exception using message='personal_account_archived',errcode='P0001'; end if;
  if expected_version is null or expected_parent_version is null or unit.version<>expected_version or parent.version<>expected_parent_version then
    raise exception using message='version_conflict',errcode='P0001';
  end if;
  return unit;
end $$;

create or replace function private.assert_native_balance_range(unit_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (select coalesce(pg_catalog.sum(amount_minor),0) from public.personal_account_entries where account_id=unit_id)
    not between -9007199254740991 and 9007199254740991 then
    raise exception using message='amount_overflow',errcode='P0001';
  end if;
end $$;

create or replace function public.add_personal_account_currency(
  request_id uuid,parent_account_id uuid,currency_code text,expected_version integer,
  opening_balance_minor bigint default null,balance_as_of date default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); parent public.personal_accounts%rowtype;
  code text:=pg_catalog.upper(currency_code); result_payload jsonb; unit_id uuid;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'add_currency',pg_catalog.jsonb_build_object(
    'parent',parent_account_id,'currency',code,'opening',opening_balance_minor,'as_of',balance_as_of,'version',expected_version));
  if result_payload is not null then return result_payload; end if;
  if code is null or not(code=any(array['JPY','MYR','USD','SGD','EUR','GBP','THB','AUD','KRW','HKD','CNY','TWD','VND'])) then
    raise exception using message='invalid_currency',errcode='P0001';
  end if;
  select * into parent from public.personal_accounts where id=parent_account_id and owner_participant_id=actor for update;
  if parent.id is null or exists(select 1 from public.personal_account_currencies where account_id=parent_account_id) then
    raise exception using message='personal_account_not_found',errcode='P0001';
  end if;
  if parent.archived_at is not null then raise exception using message='personal_account_archived',errcode='P0001'; end if;
  if expected_version is null or parent.version<>expected_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  if parent.currency=code or exists(select 1 from public.personal_account_currencies c where c.parent_account_id=parent.id and c.currency=code) then
    raise exception using message='currency_already_exists',errcode='P0001';
  end if;
  result_payload:=public.create_personal_account(private.money_child_request(request_id,'unit'),parent.name,parent.account_type,code,
    opening_balance_minor,balance_as_of,false);
  unit_id:=(result_payload->>'account_id')::uuid;
  insert into public.personal_account_currencies(account_id,parent_account_id,owner_participant_id,currency,display_order)
    values(unit_id,parent.id,actor,code,1+(select coalesce(pg_catalog.max(c.display_order),0) from public.personal_account_currencies c where c.parent_account_id=parent.id));
  update public.personal_accounts set version=version+1 where id=parent.id;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('account_id',unit_id,'parent_account_id',parent.id));
end $$;

create or replace function public.set_personal_currency_balance(
  request_id uuid,target_account_id uuid,observed_balance_minor bigint,observed_at timestamptz,
  expected_version integer,expected_parent_version integer,included_entry_ids uuid[]
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); unit public.personal_accounts%rowtype; result_payload jsonb;
  all_ids uuid[]; chosen_ids uuid[]; pending_ids uuid[]; included_sum numeric; delta numeric; anchor_id uuid:=gen_random_uuid();
  operation_id uuid; calibration_id uuid; current_total numeric;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'set_balance',pg_catalog.jsonb_build_object(
    'account',target_account_id,'observed',observed_balance_minor,'as_of',observed_at,
    'version',expected_version,'parent_version',expected_parent_version,'included_entries',included_entry_ids));
  if result_payload is not null then return result_payload; end if;
  if observed_balance_minor is null or observed_balance_minor not between -9007199254740991 and 9007199254740991
    or observed_at is null or observed_at>pg_catalog.now()+interval '5 minutes' or included_entry_ids is null then
    raise exception using message='invalid_reconciliation',errcode='P0001';
  end if;
  unit:=private.assert_money_unit(actor,target_account_id,expected_version,expected_parent_version);
  select coalesce(pg_catalog.array_agg(e.id order by e.id),'{}'::uuid[]) into all_ids
    from public.personal_account_entries e where e.account_id=unit.id;
  if not(included_entry_ids <@ all_ids) or pg_catalog.cardinality(included_entry_ids)<>(select pg_catalog.count(distinct x) from pg_catalog.unnest(included_entry_ids) x) then
    raise exception using message='invalid_balance_coverage',errcode='P0001';
  end if;
  -- Prior calibration/opening is the native baseline, not an optional cash item.
  select coalesce(pg_catalog.array_agg(distinct e.id),'{}'::uuid[]) into chosen_ids
    from public.personal_account_entries e join public.personal_account_transactions t on t.id=e.transaction_id
    where e.account_id=unit.id and (e.id=any(included_entry_ids) or t.kind in('opening','reconciliation'));
  select coalesce(pg_catalog.sum(e.amount_minor),0) into included_sum from public.personal_account_entries e where e.id=any(chosen_ids);
  select coalesce(pg_catalog.sum(e.amount_minor),0) into current_total from public.personal_account_entries e where e.account_id=unit.id;
  delta:=observed_balance_minor-included_sum;
  if delta not between -9007199254740991 and 9007199254740991 then raise exception using message='amount_overflow',errcode='P0001'; end if;
  select coalesce(pg_catalog.array_agg(f.id order by f.id),'{}'::uuid[]) into pending_ids
    from public.personal_funding_intents f where f.owner_participant_id=actor and f.status='pending';
  if unit.opening_status='unknown' then
    result_payload:=public.complete_account_opening(private.money_child_request(request_id,'calibration'),unit.id,delta::bigint,observed_at::date,unit.version);
    calibration_id:=(result_payload->>'transaction_id')::uuid;
  elsif delta<>0 then
    if current_total+delta not between -9007199254740991 and 9007199254740991 then raise exception using message='amount_overflow',errcode='P0001'; end if;
    result_payload:=public.reconcile_account_to_stated_balance(private.money_child_request(request_id,'calibration'),unit.id,(current_total+delta)::bigint,
      observed_at::date,'Observed balance coverage',unit.version);
    calibration_id:=(result_payload->>'transaction_id')::uuid;
  else
    update public.personal_accounts set version=version+1 where id=unit.id;
  end if;
  select o.id into operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=set_personal_currency_balance.request_id;
  insert into public.personal_account_balance_anchors(id,owner_participant_id,account_id,operation_id,observed_balance_minor,observed_at,
    captured_account_version,captured_entry_ids,included_entry_ids,pending_intent_ids,calibration_transaction_id)
  values(anchor_id,actor,unit.id,operation_id,observed_balance_minor,observed_at,unit.version,all_ids,chosen_ids,pending_ids,calibration_id);
  perform private.assert_native_balance_range(unit.id);
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('anchor_id',anchor_id,'account_id',unit.id,'transaction_id',calibration_id));
end $$;

-- Explicit API grants below; no newly created SECURITY DEFINER function keeps
-- PostgreSQL's implicit PUBLIC EXECUTE privilege.
revoke all on function private.money_child_request(uuid,text) from public,anon,authenticated;
revoke all on function private.begin_money_operation(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function private.finish_money_operation(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.assert_money_operation_finalized() from public,anon,authenticated;
revoke all on function private.validate_currency_unit() from public,anon,authenticated;
revoke all on function private.guard_currency_unit_account() from public,anon,authenticated;
revoke all on function private.archive_child_currency_units() from public,anon,authenticated;
revoke all on function private.guard_currency_unit_entry() from public,anon,authenticated;
revoke all on function private.assert_money_unit(uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function private.assert_native_balance_range(uuid) from public,anon,authenticated;
revoke all on function public.get_personal_multicurrency_accounts() from public,anon,authenticated;
revoke all on function public.get_personal_money_operation(uuid) from public,anon,authenticated;
revoke all on function public.add_personal_account_currency(uuid,uuid,text,integer,bigint,date) from public,anon,authenticated;
revoke all on function public.set_personal_currency_balance(uuid,uuid,bigint,timestamptz,integer,integer,uuid[]) from public,anon,authenticated;
grant execute on function public.get_personal_multicurrency_accounts() to authenticated;
grant execute on function public.get_personal_money_operation(uuid) to authenticated;
grant execute on function public.add_personal_account_currency(uuid,uuid,text,integer,bigint,date) to authenticated;
grant execute on function public.set_personal_currency_balance(uuid,uuid,bigint,timestamptz,integer,integer,uuid[]) to authenticated;

create or replace function private.validate_funding_bundle_owner()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.personal_funding_intents f where f.id=new.funding_intent_id and f.owner_participant_id=new.owner_participant_id)
    or (new.primary_account_id is not null and not exists(select 1 from public.personal_accounts a
      where a.id=new.primary_account_id and a.owner_participant_id=new.owner_participant_id
        and not exists(select 1 from public.personal_account_currencies c where c.account_id=a.id))) then
    raise exception using message='invalid_funding_bundle',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_funding_bundle_validate before insert or update on public.personal_funding_bundles
  for each row execute function private.validate_funding_bundle_owner();

-- A legacy completion may not guess a newly managed source or bypass explicit
-- coverage of an already observed balance. Any earlier journal insert rolls back.
create or replace function private.guard_managed_funding_completion()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='pending' and new.status='posted'
    and (exists(select 1 from public.personal_funding_bundles b where b.funding_intent_id=new.id)
      or exists(select 1 from public.personal_account_balance_anchors a
        where a.account_id=new.account_id and new.id=any(a.pending_intent_ids)))
    and not exists(select 1 from public.personal_funding_bundles b
      join public.personal_money_operations o on o.id=b.confirmed_operation_id
      where b.funding_intent_id=new.id and o.owner_participant_id=new.owner_participant_id
        and o.kind='confirm_funding' and o.result is null) then
    raise exception using message='funding_bundle_review_required',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_managed_funding_guard before update on public.personal_funding_intents
  for each row execute function private.guard_managed_funding_completion();

create or replace function public.defer_personal_expense_funding(
  request_id uuid,target_expense_id uuid,primary_account_id uuid,expected_expense_version integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; expense_row public.expenses%rowtype;
  intent_id uuid;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'defer_funding',pg_catalog.jsonb_build_object(
    'expense',target_expense_id,'parent',primary_account_id,'version',expected_expense_version));
  if result_payload is not null then return result_payload; end if;
  select e.* into expense_row from public.expenses e where e.id=target_expense_id
    and exists(select 1 from public.expense_participations p join public.payer_contributions c on c.expense_participation_id=p.id
      where p.expense_id=e.id and p.participant_id=actor and p.state='accepted' and c.amount_minor>0) for update;
  if expense_row.id is null or expense_row.status<>'active' then raise exception using message='expense_not_found',errcode='P0001'; end if;
  if expected_expense_version is null or expense_row.version<>expected_expense_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  if primary_account_id is not null then
    perform 1 from public.personal_accounts a where a.id=primary_account_id and a.owner_participant_id=actor and a.archived_at is null
      and not exists(select 1 from public.personal_account_currencies c where c.account_id=a.id) for update;
    if not found then raise exception using message='personal_account_not_found',errcode='P0001'; end if;
  end if;
  -- NULL account is intentional: even the actual currency is unknown.
  result_payload:=public.link_expense_funding(private.money_child_request(request_id,'intent'),target_expense_id,null,null);
  intent_id:=(result_payload->>'funding_intent_id')::uuid;
  insert into public.personal_funding_bundles(funding_intent_id,owner_participant_id,primary_account_id)
    values(intent_id,actor,primary_account_id);
  return private.finish_money_operation(actor,request_id,result_payload||pg_catalog.jsonb_build_object('primary_account_id',primary_account_id));
end $$;

create or replace function public.confirm_personal_funding_bundle(
  request_id uuid,target_funding_intent_id uuid,expected_intent_version integer,
  expected_expense_version integer,actual_legs jsonb,covers_owner_payment boolean
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb;
  intent public.personal_funding_intents%rowtype; expense_row public.expenses%rowtype;
  leg jsonb; unit public.personal_accounts%rowtype; anchor public.personal_account_balance_anchors%rowtype;
  actual_amount bigint; contribution bigint; contribution_currency text; operation_id uuid;
  transaction_id uuid; calibration_id uuid; first_transaction uuid; first_account uuid; first_amount bigint; first_currency text;
  unit_ids uuid[]; normalized_legs jsonb; covered boolean; signed_delta bigint; same_currency_total numeric:=0; all_same boolean:=true;
  baseline numeric; compensation bigint;
begin
  if actual_legs is null or pg_catalog.jsonb_typeof(actual_legs)<>'array' or pg_catalog.jsonb_array_length(actual_legs) not between 1 and 20
    or covers_owner_payment is distinct from true then raise exception using message='invalid_funding_bundle',errcode='P0001'; end if;
  select pg_catalog.jsonb_agg(l.value order by l.value->>'account_id'),pg_catalog.array_agg((l.value->>'account_id')::uuid order by l.value->>'account_id')
    into normalized_legs,unit_ids from pg_catalog.jsonb_array_elements(actual_legs) l;
  if pg_catalog.cardinality(unit_ids)<>(select pg_catalog.count(distinct x) from pg_catalog.unnest(unit_ids) x) then
    raise exception using message='duplicate_funding_source',errcode='P0001';
  end if;
  result_payload:=private.begin_money_operation(actor,request_id,'confirm_funding',pg_catalog.jsonb_build_object(
    'intent',target_funding_intent_id,'intent_version',expected_intent_version,'expense_version',expected_expense_version,
    'legs',normalized_legs,'covers_owner_payment',covers_owner_payment));
  if result_payload is not null then return result_payload; end if;
  select * into intent from public.personal_funding_intents f where f.id=target_funding_intent_id and f.owner_participant_id=actor for update;
  if intent.id is null then raise exception using message='funding_intent_not_found',errcode='P0001'; end if;
  if intent.status<>'pending' then raise exception using message='funding_not_pending',errcode='P0001'; end if;
  if expected_intent_version is null or intent.version<>expected_intent_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  select * into expense_row from public.expenses where id=intent.expense_id for update;
  if expected_expense_version is null or expense_row.version<>expected_expense_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  select amount_minor,currency into contribution,contribution_currency from private.owner_expense_contribution(intent.expense_id,actor);
  if contribution<>intent.expense_amount_minor or contribution_currency<>intent.expense_currency then
    raise exception using message='funding_contribution_changed',errcode='P0001';
  end if;
  -- Lock every unit/parent before validating or posting any leg. Existing native
  -- helpers are then composed inside THIS database transaction, never client loops.
  perform 1 from public.personal_accounts a where a.owner_participant_id=actor and (a.id=any(unit_ids) or a.id in
    (select c.parent_account_id from public.personal_account_currencies c where c.account_id=any(unit_ids))) order by a.id for update;
  for leg in select value from pg_catalog.jsonb_array_elements(normalized_legs) loop
    unit:=private.assert_money_unit(actor,(leg->>'account_id')::uuid,(leg->>'version')::integer,(leg->>'parent_version')::integer);
    actual_amount:=(leg->>'amount_minor')::bigint;
    if actual_amount is null or actual_amount not between 1 and 9007199254740991 then raise exception using message='invalid_account_amount',errcode='P0001'; end if;
    if intent.account_id is not null and not exists(select 1 from public.personal_funding_bundles b where b.funding_intent_id=intent.id)
      and (pg_catalog.cardinality(unit_ids)<>1 or unit.id<>intent.account_id) then
      raise exception using message='funding_account_changed',errcode='P0001';
    end if;
    if exists(select 1 from public.personal_installment_plans p where p.funding_intent_id=intent.id)
      and (pg_catalog.cardinality(unit_ids)<>1 or unit.account_class<>'liability') then
      raise exception using message='installment_principal_source_required',errcode='P0001';
    end if;
    if unit.currency<>intent.expense_currency then all_same:=false; else same_currency_total:=same_currency_total+actual_amount; end if;
    select * into anchor from public.personal_account_balance_anchors a where a.account_id=unit.id order by a.anchor_sequence desc limit 1;
    if anchor.id is not null and ((leg->>'anchor_id')::uuid is distinct from anchor.id or pg_catalog.jsonb_typeof(leg->'included_in_anchor') is distinct from 'boolean') then
      raise exception using message='balance_coverage_required',errcode='P0001';
    elsif anchor.id is null and (leg->>'anchor_id' is not null or leg->>'included_in_anchor' is not null) then
      raise exception using message='balance_coverage_changed',errcode='P0001';
    end if;
  end loop;
  if all_same and same_currency_total<>contribution then raise exception using message='funding_contribution_mismatch',errcode='P0001'; end if;
  insert into public.personal_funding_bundles(funding_intent_id,owner_participant_id,primary_account_id)
    values(intent.id,actor,coalesce((select c.parent_account_id from public.personal_account_currencies c where c.account_id=intent.account_id),intent.account_id))
    on conflict(funding_intent_id) do nothing;
  select o.id into operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=confirm_personal_funding_bundle.request_id;
  update public.personal_funding_bundles set confirmed_operation_id=operation_id where funding_intent_id=intent.id;
  for leg in select value from pg_catalog.jsonb_array_elements(normalized_legs) loop
    select * into unit from public.personal_accounts where id=(leg->>'account_id')::uuid;
    actual_amount:=(leg->>'amount_minor')::bigint;
    transaction_id:=private.post_expense_funding_transaction(actor,private.money_child_request(request_id,'leg:'||unit.id::text),intent.id,intent.expense_id,
      unit.id,actual_amount,expense_row.occurred_on,'Verified actual deduction');
    select * into anchor from public.personal_account_balance_anchors a where a.account_id=unit.id order by a.anchor_sequence desc limit 1;
    calibration_id:=null; covered:=null;
    if anchor.id is not null then
      covered:=(leg->>'included_in_anchor')::boolean;
      if covered then
        signed_delta:=case when unit.account_class='asset' then -actual_amount else actual_amount end;
        compensation:=-signed_delta;
        select pg_catalog.sum(e.amount_minor) into baseline from public.personal_account_entries e where e.account_id=unit.id;
        if baseline+compensation not between -9007199254740991 and 9007199254740991 then raise exception using message='amount_overflow',errcode='P0001'; end if;
        result_payload:=public.reconcile_account_to_stated_balance(private.money_child_request(request_id,'coverage:'||unit.id::text),unit.id,
          (baseline+compensation)::bigint,anchor.observed_at::date,'Previously included actual deduction',
          (select a.version from public.personal_accounts a where a.id=unit.id));
        calibration_id:=(result_payload->>'transaction_id')::uuid;
      end if;
    end if;
    insert into public.personal_funding_bundle_legs(owner_participant_id,funding_intent_id,account_id,amount_minor,currency,transaction_id,anchor_id,included_in_anchor,calibration_transaction_id)
      values(actor,intent.id,unit.id,actual_amount,unit.currency,transaction_id,anchor.id,covered,calibration_id);
    if first_transaction is null then first_transaction:=transaction_id;first_account:=unit.id;first_amount:=actual_amount;first_currency:=unit.currency; end if;
    perform private.assert_native_balance_range(unit.id);
  end loop;
  update public.personal_funding_intents set account_id=first_account,account_currency=first_currency,account_amount_minor=first_amount,
    status='posted',posted_transaction_id=first_transaction,version=version+1 where id=intent.id;
  result_payload:=pg_catalog.jsonb_build_object('funding_intent_id',intent.id,'funding_status','posted','leg_count',pg_catalog.cardinality(unit_ids),
    'posted_transaction_id',first_transaction,'operation_id',operation_id);
  insert into public.personal_account_events(owner_participant_id,client_request_id,payload_fingerprint,account_id,transaction_id,funding_intent_id,event_type,safe_diff)
    values(actor,request_id,private.personal_payload_fingerprint(result_payload),first_account,first_transaction,intent.id,'funding.bundle.posted',result_payload);
  return private.finish_money_operation(actor,request_id,result_payload);
end $$;

create or replace function public.create_expense_with_multicurrency_funding(
  request_id uuid,expense_payload jsonb,funding_plan jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; expense_id uuid; expense_version integer;
  participant_ids uuid[]; contribution_amounts bigint[]; share_amounts bigint[]; deferred_result jsonb; confirmation jsonb;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'create_expense_funding',pg_catalog.jsonb_build_object('expense',expense_payload,'funding',funding_plan));
  if result_payload is not null then return result_payload; end if;
  if pg_catalog.jsonb_typeof(expense_payload) is distinct from 'object' or pg_catalog.jsonb_typeof(funding_plan) is distinct from 'object'
    or funding_plan->>'mode' is null or funding_plan->>'mode' not in('deferred','actual') then
    raise exception using message='invalid_funding_bundle',errcode='P0001';
  end if;
  select pg_catalog.array_agg(x.value::uuid order by x.ordinality) into participant_ids from pg_catalog.jsonb_array_elements_text(expense_payload->'participant_ids') with ordinality x(value,ordinality);
  select pg_catalog.array_agg(x.value::bigint order by x.ordinality) into contribution_amounts from pg_catalog.jsonb_array_elements_text(expense_payload->'contribution_amounts') with ordinality x(value,ordinality);
  select pg_catalog.array_agg(x.value::bigint order by x.ordinality) into share_amounts from pg_catalog.jsonb_array_elements_text(expense_payload->'share_amounts') with ordinality x(value,ordinality);
  expense_id:=public.create_expense(request_id,expense_payload->>'expense_scope',(expense_payload->>'target_space_id')::uuid,(expense_payload->>'total_minor')::bigint,
    expense_payload->>'currency_code',expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,
    participant_ids,contribution_amounts,share_amounts);
  perform private.assert_expense_payload(expense_id,expense_payload->>'expense_scope',(expense_payload->>'target_space_id')::uuid,(expense_payload->>'total_minor')::bigint,
    expense_payload->>'currency_code',expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,
    participant_ids,contribution_amounts,share_amounts);
  select e.version into expense_version from public.expenses e where e.id=expense_id;
  deferred_result:=public.defer_personal_expense_funding(private.money_child_request(request_id,'defer'),expense_id,(funding_plan->>'primary_account_id')::uuid,expense_version);
  if funding_plan->>'mode'='actual' then
    confirmation:=public.confirm_personal_funding_bundle(private.money_child_request(request_id,'confirm'),(deferred_result->>'funding_intent_id')::uuid,1,
      expense_version,funding_plan->'legs',(funding_plan->>'covers_owner_payment')::boolean);
  else
    if pg_catalog.jsonb_array_length(coalesce(funding_plan->'legs','[]'::jsonb))<>0 then
      raise exception using message='deferred_funding_has_no_debits',errcode='P0001';
    end if;
    confirmation:=deferred_result;
  end if;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('expense_id',expense_id,'funding',confirmation));
end $$;

revoke all on function private.validate_funding_bundle_owner() from public,anon,authenticated;
revoke all on function private.guard_managed_funding_completion() from public,anon,authenticated;
revoke all on function public.defer_personal_expense_funding(uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.confirm_personal_funding_bundle(uuid,uuid,integer,integer,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.create_expense_with_multicurrency_funding(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.defer_personal_expense_funding(uuid,uuid,uuid,integer) to authenticated;
grant execute on function public.confirm_personal_funding_bundle(uuid,uuid,integer,integer,jsonb,boolean) to authenticated;
grant execute on function public.create_expense_with_multicurrency_funding(uuid,jsonb,jsonb) to authenticated;

create or replace function private.guard_bundled_journal_reversal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.kind<>'reversal' then return new; end if;
  if exists(select 1 from public.personal_funding_bundle_legs l where l.calibration_transaction_id=new.reverses_transaction_id)
    or exists(select 1 from public.personal_account_balance_anchors a where a.calibration_transaction_id=new.reverses_transaction_id) then
    raise exception using message='balance_anchor_review_required',errcode='P0001';
  end if;
  if exists(select 1 from public.personal_funding_bundle_legs l where l.transaction_id=new.reverses_transaction_id)
    and not exists(select 1 from public.personal_funding_bundle_legs l
      join public.personal_funding_bundles b on b.funding_intent_id=l.funding_intent_id
      join public.personal_money_operations o on o.id=b.reversed_operation_id
      where l.transaction_id=new.reverses_transaction_id and o.owner_participant_id=new.owner_participant_id
        and o.kind='reverse_funding' and o.result is null) then
    raise exception using message='funding_bundle_reversal_required',errcode='P0001';
  end if;
  return new;
end $$;
create trigger personal_bundled_reversal_guard before insert on public.personal_account_transactions
  for each row execute function private.guard_bundled_journal_reversal();

create or replace function public.reverse_personal_funding_bundle(
  request_id uuid,target_funding_intent_id uuid,expected_version integer,occurred_on date,transaction_memo text
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; intent public.personal_funding_intents%rowtype;
  leg record; operation_id uuid; reversed_ids uuid[]:='{}'::uuid[];
begin
  result_payload:=private.begin_money_operation(actor,request_id,'reverse_funding',pg_catalog.jsonb_build_object(
    'intent',target_funding_intent_id,'version',expected_version,'date',occurred_on,'memo',transaction_memo));
  if result_payload is not null then return result_payload; end if;
  select * into intent from public.personal_funding_intents f where f.id=target_funding_intent_id and f.owner_participant_id=actor for update;
  if intent.id is null or not exists(select 1 from public.personal_funding_bundles b where b.funding_intent_id=intent.id and b.confirmed_operation_id is not null) then
    raise exception using message='funding_intent_not_found',errcode='P0001';
  end if;
  if intent.status<>'posted' or intent.version is distinct from expected_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  if occurred_on is null then raise exception using message='invalid_reversal',errcode='P0001'; end if;
  select o.id into operation_id from public.personal_money_operations o where o.owner_participant_id=actor and o.request_id=reverse_personal_funding_bundle.request_id;
  update public.personal_funding_bundles set reversed_operation_id=operation_id where funding_intent_id=intent.id;
  for leg in select l.* from public.personal_funding_bundle_legs l where l.funding_intent_id=intent.id order by l.account_id loop
    result_payload:=public.reverse_personal_account_transaction(private.money_child_request(request_id,'reverse:'||leg.id::text),leg.transaction_id,occurred_on,transaction_memo);
    reversed_ids:=pg_catalog.array_append(reversed_ids,(result_payload->>'transaction_id')::uuid);
    perform private.assert_native_balance_range(leg.account_id);
  end loop;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('funding_intent_id',intent.id,'funding_status','reversed','reversal_transaction_ids',reversed_ids));
end $$;

create or replace function public.review_changed_personal_funding(
  request_id uuid,target_funding_intent_id uuid,expected_intent_version integer,expected_expense_version integer
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor(); result_payload jsonb; intent public.personal_funding_intents%rowtype;
  contribution bigint; currency_code text;
begin
  result_payload:=private.begin_money_operation(actor,request_id,'review_funding',pg_catalog.jsonb_build_object(
    'intent',target_funding_intent_id,'intent_version',expected_intent_version,'expense_version',expected_expense_version));
  if result_payload is not null then return result_payload; end if;
  select * into intent from public.personal_funding_intents f where f.id=target_funding_intent_id and f.owner_participant_id=actor for update;
  if intent.id is null then raise exception using message='funding_intent_not_found',errcode='P0001'; end if;
  if intent.status<>'pending' or intent.version is distinct from expected_intent_version then raise exception using message='version_conflict',errcode='P0001'; end if;
  perform 1 from public.expenses e where e.id=intent.expense_id and e.version=expected_expense_version for update;
  if not found then raise exception using message='version_conflict',errcode='P0001'; end if;
  select amount_minor,currency into contribution,currency_code from private.owner_expense_contribution(intent.expense_id,actor);
  update public.personal_funding_intents set expense_amount_minor=contribution,expense_currency=currency_code,version=version+1 where id=intent.id;
  return private.finish_money_operation(actor,request_id,pg_catalog.jsonb_build_object('funding_intent_id',intent.id,'funding_status','pending','version',intent.version+1));
end $$;

revoke all on function private.guard_bundled_journal_reversal() from public,anon,authenticated;
revoke all on function public.reverse_personal_funding_bundle(uuid,uuid,integer,date,text) from public,anon,authenticated;
revoke all on function public.review_changed_personal_funding(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.reverse_personal_funding_bundle(uuid,uuid,integer,date,text) to authenticated;
grant execute on function public.review_changed_personal_funding(uuid,uuid,integer,integer) to authenticated;
