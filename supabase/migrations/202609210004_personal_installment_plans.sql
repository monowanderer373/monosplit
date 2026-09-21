-- Phase 6D: owner-private credit-card / PayLater installment schedules.
--
-- The purchase remains one Canonical Expense.  A schedule is based on the
-- actual principal posted to the liability account, and repayments only move
-- money from an asset account to that liability.  Repayments never create a
-- second expense.

create table public.personal_installment_plans (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  purchase_expense_id uuid not null references public.expenses(id) on delete restrict,
  funding_intent_id uuid not null references public.personal_funding_intents(id) on delete restrict,
  liability_account_id uuid not null references public.personal_accounts(id) on delete restrict,
  repayment_account_id uuid not null references public.personal_accounts(id) on delete restrict,
  plan_kind text not null check (plan_kind in ('next_month', 'n_installments')),
  installment_count integer not null,
  principal_minor bigint check (principal_minor between 1 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  first_due_on date not null,
  timezone text not null,
  local_time time without time zone not null default '00:00',
  status text not null default 'pending_principal'
    check (status in ('pending_principal', 'active', 'paid_off', 'reversed')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_participant_id, client_request_id),
  unique (funding_intent_id),
  check (
    (plan_kind = 'next_month' and installment_count = 1)
    or (plan_kind = 'n_installments' and installment_count between 3 and 24)
  ),
  check (
    (status = 'pending_principal' and principal_minor is null)
    or (status in ('active', 'paid_off', 'reversed') and principal_minor is not null)
  )
);

create index personal_installment_plans_owner_status_idx
  on public.personal_installment_plans(owner_participant_id, status, first_due_on);

create table public.personal_installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.personal_installment_plans(id) on delete restrict,
  owner_participant_id uuid not null references public.participants(id),
  sequence integer not null check (sequence > 0),
  due_on date not null,
  principal_minor bigint not null check (principal_minor between 1 and 9007199254740991),
  repayment_account_id uuid not null references public.personal_accounts(id) on delete restrict,
  asset_payment_minor bigint check (asset_payment_minor between 1 and 9007199254740991),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'posted', 'skipped', 'failed', 'reversed')),
  posted_transaction_id uuid references public.personal_account_transactions(id) on delete restrict,
  reversal_transaction_id uuid references public.personal_account_transactions(id) on delete restrict,
  error_code text,
  posted_at timestamptz,
  skipped_at timestamptz,
  reversed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (plan_id, sequence),
  unique (posted_transaction_id),
  unique (reversal_transaction_id),
  check (
    (status = 'scheduled' and posted_transaction_id is null
      and reversal_transaction_id is null and error_code is null
      and posted_at is null and skipped_at is null and reversed_at is null)
    or
    (status = 'failed' and posted_transaction_id is null
      and reversal_transaction_id is null and error_code is not null
      and posted_at is null and skipped_at is null and reversed_at is null)
    or
    (status = 'posted' and posted_transaction_id is not null
      and reversal_transaction_id is null and error_code is null
      and posted_at is not null and skipped_at is null and reversed_at is null)
    or
    (status = 'skipped' and posted_transaction_id is null
      and reversal_transaction_id is null and error_code is null
      and posted_at is null and skipped_at is not null and reversed_at is null)
    or
    (status = 'reversed' and posted_transaction_id is not null
      and reversal_transaction_id is not null and error_code is null
      and posted_at is not null and skipped_at is null and reversed_at is not null)
  )
);

create index personal_installments_owner_due_idx
  on public.personal_installments(owner_participant_id, status, due_on, id);

alter table public.personal_account_transactions
  add constraint personal_account_transactions_installment_fk
  foreign key (installment_id) references public.personal_installments(id) on delete restrict;

alter table public.personal_account_events
  add column installment_plan_id uuid
    references public.personal_installment_plans(id) on delete restrict,
  add column installment_id uuid
    references public.personal_installments(id) on delete restrict;

alter table public.personal_account_events
  drop constraint personal_account_events_has_parent_check;

alter table public.personal_account_events
  add constraint personal_account_events_has_parent_check check (
    num_nonnulls(
      account_id, transaction_id, funding_intent_id,
      installment_plan_id, installment_id
    ) >= 1
  );

create trigger personal_installment_plans_set_updated_at
  before update on public.personal_installment_plans
  for each row execute function public.set_updated_at();

create trigger personal_installments_set_updated_at
  before update on public.personal_installments
  for each row execute function public.set_updated_at();

create or replace function private.personal_installment_request_id(
  target_plan_id uuid,
  sequence_number integer,
  request_kind text
)
returns uuid
language sql
immutable
strict
set search_path = ''
as $$
  select extensions.uuid_generate_v5(
    'd4d0ceab-d1e5-5c45-9da9-d42bddc60b86'::uuid,
    target_plan_id::text || ':' || sequence_number::text || ':' || request_kind
  );
$$;

create or replace function private.validate_personal_installment_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  liability_row public.personal_accounts%rowtype;
  repayment_row public.personal_accounts%rowtype;
  funding_row public.personal_funding_intents%rowtype;
begin
  select * into liability_row from public.personal_accounts
  where id = new.liability_account_id;
  select * into repayment_row from public.personal_accounts
  where id = new.repayment_account_id;
  select * into funding_row from public.personal_funding_intents
  where id = new.funding_intent_id;

  if liability_row.id is null or liability_row.owner_participant_id <> new.owner_participant_id
     or liability_row.account_class <> 'liability' then
    raise exception using message = 'installment_liability_account_invalid', errcode = 'P0001';
  end if;
  if repayment_row.id is null or repayment_row.owner_participant_id <> new.owner_participant_id
     or repayment_row.account_class <> 'asset' or repayment_row.archived_at is not null then
    raise exception using message = 'installment_repayment_account_invalid', errcode = 'P0001';
  end if;
  if funding_row.id is null or funding_row.owner_participant_id <> new.owner_participant_id
     or funding_row.expense_id <> new.purchase_expense_id
     or funding_row.account_id <> new.liability_account_id then
    raise exception using message = 'installment_funding_mismatch', errcode = 'P0001';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = pg_catalog.btrim(new.timezone)
  ) then
    raise exception using message = 'invalid_installment_timezone', errcode = 'P0001';
  end if;
  new.currency := liability_row.currency;
  new.timezone := pg_catalog.btrim(new.timezone);
  return new;
end;
$$;

create trigger personal_installment_plans_validate
  before insert or update of owner_participant_id, purchase_expense_id,
    funding_intent_id, liability_account_id, repayment_account_id, currency, timezone
  on public.personal_installment_plans
  for each row execute function private.validate_personal_installment_plan();

create or replace function private.validate_personal_installment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_owner uuid;
  account_owner uuid;
  repayment_class text;
begin
  select owner_participant_id into plan_owner
  from public.personal_installment_plans where id = new.plan_id;
  select owner_participant_id, account_class into account_owner, repayment_class
  from public.personal_accounts where id = new.repayment_account_id;
  if plan_owner is null or plan_owner <> new.owner_participant_id then
    raise exception using message = 'installment_plan_owner_mismatch', errcode = 'P0001';
  end if;
  if account_owner is null or account_owner <> new.owner_participant_id
     or repayment_class <> 'asset' then
    raise exception using message = 'installment_repayment_account_invalid', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger personal_installments_validate
  before insert or update of plan_id, owner_participant_id, repayment_account_id
  on public.personal_installments
  for each row execute function private.validate_personal_installment();

alter table public.personal_installment_plans enable row level security;
alter table public.personal_installments enable row level security;

create policy personal_installment_plans_select_owner
  on public.personal_installment_plans for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

create policy personal_installments_select_owner
  on public.personal_installments for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

revoke all on table public.personal_installment_plans from public, anon, authenticated;
revoke all on table public.personal_installments from public, anon, authenticated;
grant select on table public.personal_installment_plans to authenticated;
grant select on table public.personal_installments to authenticated;

create or replace function private.generate_personal_installments(target_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row public.personal_installment_plans%rowtype;
  item_number integer;
  base_amount bigint;
  remainder_amount bigint;
  due_date date;
begin
  select * into plan_row from public.personal_installment_plans
  where id = target_plan_id for update;
  if plan_row.id is null then
    raise exception using message = 'personal_installment_plan_not_found', errcode = 'P0001';
  end if;
  if plan_row.principal_minor is null or plan_row.status = 'pending_principal' then
    raise exception using message = 'installment_principal_pending', errcode = 'P0001';
  end if;
  if exists (select 1 from public.personal_installments where plan_id = plan_row.id) then
    return;
  end if;

  base_amount := plan_row.principal_minor / plan_row.installment_count;
  remainder_amount := plan_row.principal_minor % plan_row.installment_count;
  if base_amount = 0 then
    raise exception using message = 'installment_principal_too_small', errcode = 'P0001';
  end if;

  due_date := plan_row.first_due_on;
  for item_number in 1..plan_row.installment_count loop
    insert into public.personal_installments(
      plan_id, owner_participant_id, sequence, due_on, principal_minor,
      repayment_account_id, asset_payment_minor, status
    ) values (
      plan_row.id, plan_row.owner_participant_id, item_number, due_date,
      base_amount + case when item_number <= remainder_amount then 1 else 0 end,
      plan_row.repayment_account_id,
      case when (
        select currency from public.personal_accounts where id = plan_row.repayment_account_id
      ) = plan_row.currency then
        base_amount + case when item_number <= remainder_amount then 1 else 0 end
      else null end,
      'scheduled'
    );
    due_date := public.next_recurring_local_date(
      due_date, 'monthly', extract(day from plan_row.first_due_on)::integer
    );
  end loop;
end;
$$;

create or replace function private.activate_personal_installment_plan(target_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row public.personal_installment_plans%rowtype;
  funding_row public.personal_funding_intents%rowtype;
begin
  select * into plan_row from public.personal_installment_plans
  where id = target_plan_id for update;
  if plan_row.id is null or plan_row.status <> 'pending_principal' then
    return;
  end if;
  select * into funding_row from public.personal_funding_intents
  where id = plan_row.funding_intent_id for update;
  if funding_row.status <> 'posted' then
    return;
  end if;
  if funding_row.account_id <> plan_row.liability_account_id
     or funding_row.account_amount_minor is null then
    raise exception using message = 'installment_funding_mismatch', errcode = 'P0001';
  end if;

  update public.personal_installment_plans
  set principal_minor = funding_row.account_amount_minor,
      currency = funding_row.account_currency,
      status = 'active', version = version + 1
  where id = plan_row.id;
  perform private.generate_personal_installments(plan_row.id);
end;
$$;

create or replace function private.activate_installment_after_funding()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_id uuid;
begin
  if new.status = 'posted' and old.status <> 'posted' then
    select id into plan_id from public.personal_installment_plans
    where funding_intent_id = new.id;
    if plan_id is not null then
      perform private.activate_personal_installment_plan(plan_id);
    end if;
  end if;
  return new;
end;
$$;

create trigger personal_installment_activate_after_funding
  after update of status on public.personal_funding_intents
  for each row execute function private.activate_installment_after_funding();

create or replace function public.create_installment_plan_for_expense(
  request_id uuid,
  target_expense_id uuid,
  target_repayment_account_id uuid,
  requested_plan_kind text,
  requested_installment_count integer,
  requested_first_due_on date,
  requested_timezone text,
  requested_local_time time without time zone default '00:00'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  funding_row public.personal_funding_intents%rowtype;
  plan_row public.personal_installment_plans%rowtype;
  fingerprint text;
begin
  if request_id is null or target_expense_id is null
     or target_repayment_account_id is null or requested_first_due_on is null
     or requested_timezone is null
     or not (
       requested_plan_kind = 'next_month' and requested_installment_count = 1
       or requested_plan_kind = 'n_installments'
          and requested_installment_count between 3 and 24
     ) then
    raise exception using message = 'invalid_installment_plan', errcode = 'P0001';
  end if;

  select * into funding_row from public.personal_funding_intents
  where owner_participant_id = actor and expense_id = target_expense_id
    and status in ('pending', 'posted')
  for update;
  if funding_row.id is null then
    raise exception using message = 'installment_funding_required', errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.personal_accounts
    where id = funding_row.account_id and owner_participant_id = actor
      and account_class = 'liability'
  ) then
    raise exception using message = 'installment_liability_account_invalid', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'expense_id', target_expense_id,
    'funding_intent_id', funding_row.id,
    'liability_account_id', funding_row.account_id,
    'repayment_account_id', target_repayment_account_id,
    'plan_kind', requested_plan_kind,
    'installment_count', requested_installment_count,
    'first_due_on', requested_first_due_on,
    'timezone', pg_catalog.btrim(requested_timezone),
    'local_time', requested_local_time
  ));

  select * into plan_row from public.personal_installment_plans
  where owner_participant_id = actor and client_request_id = request_id;
  if plan_row.id is not null then
    if plan_row.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
  else
    insert into public.personal_installment_plans(
      owner_participant_id, client_request_id, payload_fingerprint,
      purchase_expense_id, funding_intent_id, liability_account_id,
      repayment_account_id, plan_kind, installment_count, currency,
      first_due_on, timezone, local_time, status
    ) values (
      actor, request_id, fingerprint, target_expense_id, funding_row.id,
      funding_row.account_id, target_repayment_account_id,
      requested_plan_kind, requested_installment_count,
      funding_row.account_currency, requested_first_due_on,
      pg_catalog.btrim(requested_timezone), requested_local_time,
      'pending_principal'
    ) returning * into plan_row;
  end if;

  perform private.activate_personal_installment_plan(plan_row.id);
  select * into plan_row from public.personal_installment_plans where id = plan_row.id;
  return pg_catalog.jsonb_build_object(
    'installment_plan_id', plan_row.id,
    'status', plan_row.status,
    'principal_minor', plan_row.principal_minor,
    'currency', plan_row.currency,
    'installment_count', plan_row.installment_count,
    'version', plan_row.version
  );
end;
$$;

create or replace function public.create_installment_purchase(
  request_id uuid,
  expense_scope text,
  target_space_id uuid,
  total_minor bigint,
  currency_code text,
  description text,
  category text,
  occurred_on date,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[],
  funding_request_id uuid,
  liability_account_id uuid,
  billed_principal_minor bigint,
  plan_request_id uuid,
  repayment_account_id uuid,
  plan_kind text,
  installment_count integer,
  first_due_on date,
  plan_timezone text,
  plan_local_time time without time zone default '00:00'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  purchase_result jsonb;
  plan_result jsonb;
begin
  purchase_result := public.create_expense_with_funding(
    request_id, expense_scope, target_space_id, total_minor, currency_code,
    description, category, occurred_on, participant_ids,
    contribution_amounts, share_amounts, funding_request_id,
    liability_account_id, billed_principal_minor
  );
  plan_result := public.create_installment_plan_for_expense(
    plan_request_id, (purchase_result ->> 'expense_id')::uuid,
    repayment_account_id, plan_kind, installment_count,
    first_due_on, plan_timezone, plan_local_time
  );
  return purchase_result || pg_catalog.jsonb_build_object('installment_plan', plan_result);
end;
$$;

create or replace function private.post_installment_repayment_transaction(
  actor uuid,
  request_id uuid,
  target_installment_id uuid,
  target_asset_account_id uuid,
  asset_amount_minor bigint,
  liability_amount_minor bigint,
  transaction_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  installment_row public.personal_installments%rowtype;
  plan_row public.personal_installment_plans%rowtype;
  asset_row public.personal_accounts%rowtype;
  liability_row public.personal_accounts%rowtype;
  fingerprint text;
  existing_row public.personal_account_transactions%rowtype;
  transaction_id uuid;
begin
  select * into installment_row from public.personal_installments
  where id = target_installment_id and owner_participant_id = actor;
  select * into plan_row from public.personal_installment_plans
  where id = installment_row.plan_id and owner_participant_id = actor;
  select * into asset_row from public.personal_accounts
  where id = target_asset_account_id and owner_participant_id = actor for update;
  select * into liability_row from public.personal_accounts
  where id = plan_row.liability_account_id and owner_participant_id = actor for update;

  if asset_row.id is null or asset_row.account_class <> 'asset'
     or asset_row.archived_at is not null then
    raise exception using message = 'installment_repayment_account_invalid', errcode = 'P0001';
  end if;
  if liability_row.id is null or liability_row.account_class <> 'liability'
     or liability_row.archived_at is not null then
    raise exception using message = 'installment_liability_account_invalid', errcode = 'P0001';
  end if;
  if target_asset_account_id = liability_row.id
     or asset_amount_minor is null or asset_amount_minor <= 0
     or liability_amount_minor is null or liability_amount_minor <= 0 then
    raise exception using message = 'invalid_installment_repayment', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'liability_repayment',
    'installment_id', target_installment_id,
    'asset_account_id', target_asset_account_id,
    'asset_amount_minor', asset_amount_minor,
    'liability_account_id', liability_row.id,
    'liability_amount_minor', liability_amount_minor,
    'occurred_on', transaction_date
  ));
  select * into existing_row from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_row.id is not null then
    if existing_row.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return existing_row.id;
  end if;

  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint, kind,
    occurred_on, memo, installment_id
  ) values (
    actor, request_id, fingerprint, 'liability_repayment', transaction_date,
    'Installment repayment', target_installment_id
  ) returning id into transaction_id;
  insert into public.personal_account_entries(transaction_id, account_id, amount_minor, currency)
  values
    (transaction_id, asset_row.id, -asset_amount_minor, asset_row.currency),
    (transaction_id, liability_row.id, -liability_amount_minor, liability_row.currency);
  update public.personal_accounts set version = version + 1
  where id in (asset_row.id, liability_row.id);
  perform private.assert_personal_transaction_invariants(transaction_id);
  return transaction_id;
end;
$$;

create or replace function private.refresh_personal_installment_plan(target_plan_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row public.personal_installment_plans%rowtype;
  paid_principal numeric;
begin
  select * into plan_row from public.personal_installment_plans
  where id = target_plan_id for update;
  if plan_row.id is null or plan_row.status in ('pending_principal', 'reversed') then
    return;
  end if;
  select coalesce(pg_catalog.sum(principal_minor) filter (where status = 'posted'), 0)
  into paid_principal from public.personal_installments where plan_id = plan_row.id;
  update public.personal_installment_plans
  set status = case when paid_principal >= principal_minor then 'paid_off' else 'active' end,
      version = version + 1
  where id = plan_row.id;
end;
$$;

create or replace function private.installment_error_code(database_message text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case database_message
    when 'installment_actual_payment_required' then 'actual_payment_required'
    when 'installment_repayment_account_invalid' then 'account_invalid'
    when 'installment_liability_account_invalid' then 'liability_invalid'
    when 'personal_account_archived' then 'account_archived'
    when 'idempotency_conflict' then 'idempotency_conflict'
    else 'posting_failed'
  end;
$$;

create or replace function private.post_personal_installment_for(
  actor uuid,
  target_installment_id uuid,
  allowed_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  installment_row public.personal_installments%rowtype;
  plan_row public.personal_installment_plans%rowtype;
  asset_currency text;
  actual_asset_amount bigint;
  transaction_id uuid;
  failure_message text;
begin
  select * into installment_row from public.personal_installments
  where id = target_installment_id and owner_participant_id = actor for update;
  if installment_row.id is null then
    raise exception using message = 'personal_installment_not_found', errcode = 'P0001';
  end if;
  if installment_row.status <> allowed_status then
    raise exception using message = 'personal_installment_state_conflict', errcode = 'P0001';
  end if;
  select * into plan_row from public.personal_installment_plans
  where id = installment_row.plan_id and owner_participant_id = actor for update;

  begin
    select currency into asset_currency from public.personal_accounts
    where id = installment_row.repayment_account_id and owner_participant_id = actor
      and account_class = 'asset' and archived_at is null;
    if asset_currency is null then
      raise exception using message = 'installment_repayment_account_invalid', errcode = 'P0001';
    end if;
    actual_asset_amount := installment_row.asset_payment_minor;
    if actual_asset_amount is null and asset_currency = plan_row.currency then
      actual_asset_amount := installment_row.principal_minor;
    end if;
    if actual_asset_amount is null then
      raise exception using message = 'installment_actual_payment_required', errcode = 'P0001';
    end if;
    transaction_id := private.post_installment_repayment_transaction(
      actor,
      private.personal_installment_request_id(plan_row.id, installment_row.sequence, 'repayment'),
      installment_row.id, installment_row.repayment_account_id,
      actual_asset_amount, installment_row.principal_minor, installment_row.due_on
    );
    update public.personal_installments
    set status = 'posted', asset_payment_minor = actual_asset_amount,
        posted_transaction_id = transaction_id, error_code = null,
        posted_at = pg_catalog.now(), version = version + 1
    where id = installment_row.id returning * into installment_row;
    perform private.refresh_personal_installment_plan(plan_row.id);
  exception when others then
    get stacked diagnostics failure_message = message_text;
    update public.personal_installments
    set status = 'failed', error_code = private.installment_error_code(failure_message),
        posted_transaction_id = null, posted_at = null, version = version + 1
    where id = installment_row.id returning * into installment_row;
  end;

  return pg_catalog.jsonb_build_object(
    'installment_id', installment_row.id,
    'status', installment_row.status,
    'posted_transaction_id', installment_row.posted_transaction_id,
    'error_code', installment_row.error_code,
    'version', installment_row.version
  );
end;
$$;

create or replace function public.post_installment_repayment(target_installment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_personal_actor();
begin
  return private.post_personal_installment_for(actor, target_installment_id, 'scheduled');
end;
$$;

create or replace function public.retry_installment_repayment(target_installment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_personal_actor();
begin
  return private.post_personal_installment_for(actor, target_installment_id, 'failed');
end;
$$;

create or replace function private.installment_due_count(actor uuid, due_override date default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.count(*)::integer
  from public.personal_installments as installment
  join public.personal_installment_plans as plan on plan.id = installment.plan_id
  where installment.owner_participant_id = actor
    and installment.status = 'scheduled'
    and installment.due_on <= coalesce(
      due_override, pg_catalog.timezone(plan.timezone, pg_catalog.now())::date
    );
$$;

create or replace function private.catch_up_personal_installments_for(
  actor uuid,
  due_override date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  installment_row public.personal_installments%rowtype;
  processed_count integer := 0;
  failed_count integer := 0;
  post_result jsonb;
begin
  if actor is null or not exists (
    select 1 from public.participants where id = actor and kind = 'account'
  ) then
    raise exception using message = 'account_participant_required', errcode = 'P0001';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tabby.personal.installments.catchup:' || actor::text, 0)
  );
  while processed_count < 24 loop
    select installment.* into installment_row
    from public.personal_installments as installment
    join public.personal_installment_plans as plan on plan.id = installment.plan_id
    where installment.owner_participant_id = actor
      and installment.status = 'scheduled'
      and installment.due_on <= coalesce(
        due_override, pg_catalog.timezone(plan.timezone, pg_catalog.now())::date
      )
    order by installment.due_on, installment.id
    limit 1 for update of installment;
    exit when installment_row.id is null;
    post_result := private.post_personal_installment_for(
      actor, installment_row.id, 'scheduled'
    );
    if post_result ->> 'status' = 'failed' then
      failed_count := failed_count + 1;
    end if;
    processed_count := processed_count + 1;
  end loop;
  return pg_catalog.jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'remaining', private.installment_due_count(actor, due_override)
  );
end;
$$;

create or replace function public.catch_up_personal_installments()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_personal_actor();
begin
  return private.catch_up_personal_installments_for(actor, null);
end;
$$;

create or replace function public.edit_future_installment(
  target_installment_id uuid,
  expected_version integer,
  replacement_due_on date,
  replacement_repayment_account_id uuid,
  replacement_asset_payment_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  installment_row public.personal_installments%rowtype;
begin
  select * into installment_row from public.personal_installments
  where id = target_installment_id and owner_participant_id = actor for update;
  if installment_row.id is null then
    raise exception using message = 'personal_installment_not_found', errcode = 'P0001';
  end if;
  if installment_row.status not in ('scheduled', 'failed') then
    raise exception using message = 'personal_installment_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> installment_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if replacement_due_on is null or replacement_repayment_account_id is null
     or (replacement_asset_payment_minor is not null
       and replacement_asset_payment_minor not between 1 and 9007199254740991) then
    raise exception using message = 'invalid_installment_edit', errcode = 'P0001';
  end if;
  update public.personal_installments
  set due_on = replacement_due_on,
      repayment_account_id = replacement_repayment_account_id,
      asset_payment_minor = replacement_asset_payment_minor,
      status = 'scheduled', error_code = null, version = version + 1
  where id = installment_row.id returning * into installment_row;
  return pg_catalog.jsonb_build_object(
    'installment_id', installment_row.id, 'status', installment_row.status,
    'due_on', installment_row.due_on, 'version', installment_row.version
  );
end;
$$;

create or replace function public.reschedule_remaining_installments(
  target_plan_id uuid,
  expected_version integer,
  replacement_first_due_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  plan_row public.personal_installment_plans%rowtype;
  installment_row public.personal_installments%rowtype;
  next_date date;
begin
  select * into plan_row from public.personal_installment_plans
  where id = target_plan_id and owner_participant_id = actor for update;
  if plan_row.id is null then
    raise exception using message = 'personal_installment_plan_not_found', errcode = 'P0001';
  end if;
  if plan_row.status <> 'active' or replacement_first_due_on is null then
    raise exception using message = 'personal_installment_plan_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> plan_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  next_date := replacement_first_due_on;
  for installment_row in
    select * from public.personal_installments
    where plan_id = plan_row.id and status in ('scheduled', 'failed')
    order by sequence for update
  loop
    update public.personal_installments
    set due_on = next_date, status = 'scheduled', error_code = null,
        version = version + 1
    where id = installment_row.id;
    next_date := public.next_recurring_local_date(
      next_date, 'monthly', extract(day from replacement_first_due_on)::integer
    );
  end loop;
  update public.personal_installment_plans
  set first_due_on = replacement_first_due_on, version = version + 1
  where id = plan_row.id returning * into plan_row;
  return pg_catalog.jsonb_build_object(
    'installment_plan_id', plan_row.id,
    'first_due_on', plan_row.first_due_on, 'version', plan_row.version
  );
end;
$$;

create or replace function public.pay_off_installment_plan(
  request_id uuid,
  target_plan_id uuid,
  expected_version integer,
  target_repayment_account_id uuid,
  asset_payment_minor bigint,
  paid_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  plan_row public.personal_installment_plans%rowtype;
  target_row public.personal_installments%rowtype;
  paid_principal bigint;
  remaining_principal bigint;
  request_sequence integer;
  transaction_id uuid;
begin
  if request_id is null or paid_on is null or target_repayment_account_id is null
     or asset_payment_minor is null or asset_payment_minor <= 0 then
    raise exception using message = 'invalid_installment_payoff', errcode = 'P0001';
  end if;
  select * into plan_row from public.personal_installment_plans
  where id = target_plan_id and owner_participant_id = actor for update;
  if plan_row.id is null then
    raise exception using message = 'personal_installment_plan_not_found', errcode = 'P0001';
  end if;
  if plan_row.status = 'paid_off' then
    return pg_catalog.jsonb_build_object(
      'installment_plan_id', plan_row.id, 'status', plan_row.status,
      'version', plan_row.version
    );
  end if;
  if plan_row.status <> 'active' then
    raise exception using message = 'personal_installment_plan_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> plan_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.sum(principal_minor) filter (where status = 'posted'), 0)::bigint
  into paid_principal from public.personal_installments where plan_id = plan_row.id;
  remaining_principal := plan_row.principal_minor - paid_principal;
  if remaining_principal <= 0 then
    perform private.refresh_personal_installment_plan(plan_row.id);
    select * into plan_row from public.personal_installment_plans where id = plan_row.id;
    return pg_catalog.jsonb_build_object(
      'installment_plan_id', plan_row.id, 'status', plan_row.status,
      'version', plan_row.version
    );
  end if;

  select * into target_row from public.personal_installments
  where plan_id = plan_row.id and status in ('scheduled', 'failed')
  order by sequence limit 1 for update;
  if target_row.id is null then
    select coalesce(pg_catalog.max(sequence), 0) + 1 into request_sequence
    from public.personal_installments where plan_id = plan_row.id;
    insert into public.personal_installments(
      plan_id, owner_participant_id, sequence, due_on, principal_minor,
      repayment_account_id, asset_payment_minor, status
    ) values (
      plan_row.id, actor, request_sequence, paid_on, remaining_principal,
      target_repayment_account_id, asset_payment_minor, 'scheduled'
    ) returning * into target_row;
  else
    update public.personal_installments
    set due_on = paid_on, principal_minor = remaining_principal,
        repayment_account_id = target_repayment_account_id,
        asset_payment_minor = pay_off_installment_plan.asset_payment_minor,
        status = 'scheduled', error_code = null, version = version + 1
    where id = target_row.id returning * into target_row;
  end if;
  update public.personal_installments
  set status = 'skipped', skipped_at = pg_catalog.now(), error_code = null,
      version = version + 1
  where plan_id = plan_row.id and id <> target_row.id
    and status in ('scheduled', 'failed');

  transaction_id := private.post_installment_repayment_transaction(
    actor, request_id, target_row.id, target_repayment_account_id,
    asset_payment_minor, remaining_principal, paid_on
  );
  update public.personal_installments
  set status = 'posted', posted_transaction_id = transaction_id,
      posted_at = pg_catalog.now(), version = version + 1
  where id = target_row.id;
  perform private.refresh_personal_installment_plan(plan_row.id);
  select * into plan_row from public.personal_installment_plans where id = plan_row.id;
  return pg_catalog.jsonb_build_object(
    'installment_plan_id', plan_row.id, 'status', plan_row.status,
    'paid_principal_minor', remaining_principal,
    'posted_transaction_id', transaction_id, 'version', plan_row.version
  );
end;
$$;

create or replace function private.mark_reversed_installment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare installment_row public.personal_installments%rowtype;
begin
  if old.reversal_transaction_id is not null or new.reversal_transaction_id is null
     or new.installment_id is null then
    return new;
  end if;
  update public.personal_installments
  set status = 'reversed', reversal_transaction_id = new.reversal_transaction_id,
      reversed_at = new.reversed_at, version = version + 1
  where id = new.installment_id and posted_transaction_id = new.id
    and status = 'posted'
  returning * into installment_row;
  if installment_row.id is not null then
    perform private.refresh_personal_installment_plan(installment_row.plan_id);
  end if;
  return new;
end;
$$;

create trigger personal_installment_reverse_with_journal
  after update of reversal_transaction_id on public.personal_account_transactions
  for each row execute function private.mark_reversed_installment();

create or replace function public.reverse_installment(
  request_id uuid,
  target_installment_id uuid,
  expected_version integer,
  reversed_on date,
  reversal_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  installment_row public.personal_installments%rowtype;
  reversal_result jsonb;
begin
  select * into installment_row from public.personal_installments
  where id = target_installment_id and owner_participant_id = actor for update;
  if installment_row.id is null then
    raise exception using message = 'personal_installment_not_found', errcode = 'P0001';
  end if;
  if installment_row.status = 'reversed' then
    return pg_catalog.jsonb_build_object(
      'installment_id', installment_row.id, 'status', installment_row.status,
      'version', installment_row.version
    );
  end if;
  if installment_row.status <> 'posted' then
    raise exception using message = 'personal_installment_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> installment_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  reversal_result := public.reverse_personal_account_transaction(
    request_id, installment_row.posted_transaction_id,
    reversed_on, reversal_reason
  );
  select * into installment_row from public.personal_installments
  where id = target_installment_id;
  return pg_catalog.jsonb_build_object(
    'installment_id', installment_row.id, 'status', installment_row.status,
    'reversal_transaction_id', reversal_result ->> 'transaction_id',
    'version', installment_row.version
  );
end;
$$;

revoke all on function private.personal_installment_request_id(uuid, integer, text) from public, anon, authenticated;
revoke all on function private.validate_personal_installment_plan() from public, anon, authenticated;
revoke all on function private.validate_personal_installment() from public, anon, authenticated;
revoke all on function private.generate_personal_installments(uuid) from public, anon, authenticated;
revoke all on function private.activate_personal_installment_plan(uuid) from public, anon, authenticated;
revoke all on function private.activate_installment_after_funding() from public, anon, authenticated;
revoke all on function private.post_installment_repayment_transaction(uuid, uuid, uuid, uuid, bigint, bigint, date) from public, anon, authenticated;
revoke all on function private.refresh_personal_installment_plan(uuid) from public, anon, authenticated;
revoke all on function private.installment_error_code(text) from public, anon, authenticated;
revoke all on function private.post_personal_installment_for(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.installment_due_count(uuid, date) from public, anon, authenticated;
revoke all on function private.catch_up_personal_installments_for(uuid, date) from public, anon, authenticated;
revoke all on function private.mark_reversed_installment() from public, anon, authenticated;

revoke all on function public.create_installment_plan_for_expense(uuid, uuid, uuid, text, integer, date, text, time without time zone) from public, anon, authenticated;
revoke all on function public.create_installment_purchase(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[], uuid, uuid, bigint, uuid, uuid, text, integer, date, text, time without time zone) from public, anon, authenticated;
revoke all on function public.post_installment_repayment(uuid) from public, anon, authenticated;
revoke all on function public.retry_installment_repayment(uuid) from public, anon, authenticated;
revoke all on function public.catch_up_personal_installments() from public, anon, authenticated;
revoke all on function public.edit_future_installment(uuid, integer, date, uuid, bigint) from public, anon, authenticated;
revoke all on function public.reschedule_remaining_installments(uuid, integer, date) from public, anon, authenticated;
revoke all on function public.pay_off_installment_plan(uuid, uuid, integer, uuid, bigint, date) from public, anon, authenticated;
revoke all on function public.reverse_installment(uuid, uuid, integer, date, text) from public, anon, authenticated;

grant execute on function public.create_installment_plan_for_expense(uuid, uuid, uuid, text, integer, date, text, time without time zone) to authenticated;
grant execute on function public.create_installment_purchase(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[], uuid, uuid, bigint, uuid, uuid, text, integer, date, text, time without time zone) to authenticated;
grant execute on function public.post_installment_repayment(uuid) to authenticated;
grant execute on function public.retry_installment_repayment(uuid) to authenticated;
grant execute on function public.catch_up_personal_installments() to authenticated;
grant execute on function public.edit_future_installment(uuid, integer, date, uuid, bigint) to authenticated;
grant execute on function public.reschedule_remaining_installments(uuid, integer, date) to authenticated;
grant execute on function public.pay_off_installment_plan(uuid, uuid, integer, uuid, bigint, date) to authenticated;
grant execute on function public.reverse_installment(uuid, uuid, integer, date, text) to authenticated;

comment on table public.personal_installment_plans is 'Owner-private installment schedules based on actual liability-account principal.';
comment on table public.personal_installments is 'Editable due rows whose repayment journals reduce an asset and a liability without creating expenses.';
comment on function public.catch_up_personal_installments() is 'Posts at most 24 due installment repayments using each plan timezone and never guesses cross-currency cash.';
