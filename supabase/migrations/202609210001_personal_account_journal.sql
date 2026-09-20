-- Phase 6A: owner-private personal account journal.
--
-- This is additive to the Phase 5 shared financial model. Personal account
-- rows never rewrite canonical expenses, payer contributions, shares, or
-- accepted settlement allocations.

create table public.personal_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  creation_payload_fingerprint text not null
    check (creation_payload_fingerprint ~ '^[0-9a-f]{64}$'),
  name text not null check (char_length(trim(name)) between 1 and 100),
  account_class text not null check (account_class in ('asset', 'liability')),
  account_type text not null check (
    account_type in ('cash', 'bank', 'ewallet', 'credit_card', 'paylater', 'loan')
  ),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  archived_at timestamptz,
  is_default boolean not null default false,
  opening_status text not null default 'unknown'
    check (opening_status in ('unknown', 'posted')),
  opening_balance_as_of date,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_participant_id, client_request_id),
  check (
    (account_type in ('cash', 'bank', 'ewallet') and account_class = 'asset')
    or
    (account_type in ('credit_card', 'paylater', 'loan') and account_class = 'liability')
  ),
  check (
    (opening_status = 'unknown' and opening_balance_as_of is null)
    or
    (opening_status = 'posted' and opening_balance_as_of is not null)
  ),
  check (
    not is_default
    or (
      account_class = 'asset'
      and account_type in ('cash', 'bank', 'ewallet')
      and archived_at is null
    )
  )
);

create unique index personal_accounts_one_active_default_idx
  on public.personal_accounts(owner_participant_id)
  where is_default and archived_at is null;

create index personal_accounts_owner_idx
  on public.personal_accounts(owner_participant_id, archived_at, created_at);

create table public.personal_account_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in (
    'opening', 'reconciliation', 'income', 'refund', 'expense_funding',
    'transfer', 'liability_purchase', 'liability_repayment', 'interest_fee',
    'settlement_out', 'settlement_in', 'gift_out', 'gift_in', 'reversal'
  )),
  occurred_on date not null,
  memo text,
  posted_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_transaction_id uuid,
  expense_id uuid references public.expenses(id),
  settlement_allocation_id uuid references public.settlement_allocations(id),
  installment_id uuid,
  reverses_transaction_id uuid,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  unique (owner_participant_id, client_request_id),
  unique (reverses_transaction_id),
  check (
    (kind = 'reversal' and reverses_transaction_id is not null)
    or
    (kind <> 'reversal' and reverses_transaction_id is null)
  ),
  check (reversal_transaction_id is null or reversed_at is not null)
);

alter table public.personal_account_transactions
  add constraint personal_account_transactions_reversal_transaction_fk
  foreign key (reversal_transaction_id)
  references public.personal_account_transactions(id),
  add constraint personal_account_transactions_reverses_transaction_fk
  foreign key (reverses_transaction_id)
  references public.personal_account_transactions(id);

create index personal_account_transactions_owner_date_idx
  on public.personal_account_transactions(owner_participant_id, occurred_on desc, posted_at desc);

create table public.personal_account_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null
    references public.personal_account_transactions(id) on delete restrict,
  account_id uuid not null references public.personal_accounts(id) on delete restrict,
  amount_minor bigint not null
    check (amount_minor between -9007199254740991 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  unique (transaction_id, account_id)
);

create index personal_account_entries_account_idx
  on public.personal_account_entries(account_id, created_at desc);

create table public.personal_account_events (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  account_id uuid references public.personal_accounts(id) on delete restrict,
  transaction_id uuid references public.personal_account_transactions(id) on delete restrict,
  event_type text not null check (char_length(trim(event_type)) between 1 and 100),
  safe_diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (owner_participant_id, event_type, client_request_id),
  check (num_nonnulls(account_id, transaction_id) >= 1)
);

create index personal_account_events_owner_created_idx
  on public.personal_account_events(owner_participant_id, created_at desc);

create trigger personal_accounts_set_updated_at
  before update on public.personal_accounts
  for each row execute function public.set_updated_at();

create or replace function private.personal_payload_fingerprint(payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.require_personal_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.participants
    where id = actor and kind = 'account'
  ) then
    raise exception using message = 'account_participant_required', errcode = 'P0001';
  end if;
  return actor;
end;
$$;

create or replace function private.validate_personal_account_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.participants
    where id = new.owner_participant_id and kind = 'account'
  ) then
    raise exception using message = 'account_participant_required', errcode = 'P0001';
  end if;
  new.name := pg_catalog.btrim(new.name);
  new.currency := pg_catalog.upper(new.currency);
  return new;
end;
$$;

create trigger personal_accounts_validate_owner
  before insert or update of owner_participant_id, name, currency
  on public.personal_accounts
  for each row execute function private.validate_personal_account_owner();

create or replace function private.validate_personal_account_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_owner uuid;
  transaction_kind text;
  account_owner uuid;
  account_currency text;
begin
  select owner_participant_id, kind
    into transaction_owner, transaction_kind
  from public.personal_account_transactions
  where id = new.transaction_id;

  select owner_participant_id, currency
    into account_owner, account_currency
  from public.personal_accounts
  where id = new.account_id;

  if transaction_owner is null or account_owner is null then
    raise exception using message = 'personal_account_parent_not_found', errcode = 'P0001';
  end if;
  if transaction_owner <> account_owner then
    raise exception using message = 'personal_account_owner_mismatch', errcode = 'P0001';
  end if;
  if new.currency <> account_currency then
    raise exception using message = 'account_currency_mismatch', errcode = 'P0001';
  end if;
  if new.amount_minor = 0 and transaction_kind <> 'opening' then
    raise exception using message = 'zero_entry_forbidden', errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger personal_account_entries_validate
  before insert or update
  on public.personal_account_entries
  for each row execute function private.validate_personal_account_entry();

create or replace function private.assert_personal_transaction_invariants(target_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  transaction_row public.personal_account_transactions%rowtype;
  entry_count integer;
  asset_count integer;
  liability_count integer;
  positive_count integer;
  negative_count integer;
  currency_count integer;
  amount_total numeric;
begin
  select * into transaction_row
  from public.personal_account_transactions
  where id = target_transaction_id;

  if transaction_row.id is null then
    return;
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where account.account_class = 'asset')::integer,
    pg_catalog.count(*) filter (where account.account_class = 'liability')::integer,
    pg_catalog.count(*) filter (where entry.amount_minor > 0)::integer,
    pg_catalog.count(*) filter (where entry.amount_minor < 0)::integer,
    pg_catalog.count(distinct entry.currency)::integer,
    coalesce(pg_catalog.sum(entry.amount_minor), 0)
  into
    entry_count, asset_count, liability_count, positive_count, negative_count,
    currency_count, amount_total
  from public.personal_account_entries as entry
  join public.personal_accounts as account on account.id = entry.account_id
  where entry.transaction_id = transaction_row.id;

  if transaction_row.kind in ('opening', 'reconciliation') then
    if entry_count <> 1 then
      raise exception using message = 'invalid_transaction_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind in ('income', 'refund', 'settlement_in', 'gift_in') then
    if entry_count <> 1 or asset_count <> 1 or positive_count <> 1 then
      raise exception using message = 'invalid_transaction_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind in ('expense_funding', 'settlement_out', 'gift_out') then
    if entry_count <> 1 or asset_count <> 1 or negative_count <> 1 then
      raise exception using message = 'invalid_transaction_entries', errcode = 'P0001';
    end if;
    if transaction_row.kind = 'expense_funding' and transaction_row.expense_id is null then
      raise exception using message = 'expense_required', errcode = 'P0001';
    end if;
  elsif transaction_row.kind = 'transfer' then
    if entry_count <> 2 or asset_count <> 2
       or positive_count <> 1 or negative_count <> 1
       or (currency_count = 1 and amount_total <> 0) then
      raise exception using message = 'invalid_transfer_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind = 'liability_purchase' then
    if entry_count not in (1, 2) or liability_count <> 1 or positive_count <> 1
       or asset_count not in (0, 1)
       or (asset_count = 1 and negative_count <> 1) then
      raise exception using message = 'invalid_liability_purchase_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind = 'liability_repayment' then
    if entry_count <> 2 or asset_count <> 1 or liability_count <> 1
       or negative_count <> 2 then
      raise exception using message = 'invalid_liability_repayment_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind = 'interest_fee' then
    if transaction_row.expense_id is null
       or entry_count not in (1, 2)
       or not (
         (entry_count = 1 and asset_count = 1 and negative_count = 1)
         or
         (liability_count = 1 and positive_count = 1
           and asset_count in (0, 1)
           and (asset_count = 0 or negative_count = 1))
       ) then
      raise exception using message = 'invalid_interest_fee_entries', errcode = 'P0001';
    end if;
  elsif transaction_row.kind = 'reversal' then
    if exists (
      select 1
      from public.personal_account_transactions as original
      where original.id = transaction_row.reverses_transaction_id
        and original.kind = 'reversal'
    ) or (
      select pg_catalog.count(*)
      from public.personal_account_entries
      where transaction_id = transaction_row.reverses_transaction_id
    ) <> entry_count or exists (
      select 1
      from public.personal_account_entries as original_entry
      where original_entry.transaction_id = transaction_row.reverses_transaction_id
        and not exists (
          select 1
          from public.personal_account_entries as reversal_entry
          where reversal_entry.transaction_id = transaction_row.id
            and reversal_entry.account_id = original_entry.account_id
            and reversal_entry.currency = original_entry.currency
            and reversal_entry.amount_minor = -original_entry.amount_minor
        )
    ) then
      raise exception using message = 'invalid_reversal_entries', errcode = 'P0001';
    end if;
  end if;
end;
$$;

create or replace function private.assert_personal_account_opening(target_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.personal_accounts%rowtype;
  opening_count integer;
begin
  select * into account_row
  from public.personal_accounts
  where id = target_account_id;
  if account_row.id is null then
    return;
  end if;

  select pg_catalog.count(*)::integer into opening_count
  from public.personal_account_transactions as journal
  join public.personal_account_entries as entry
    on entry.transaction_id = journal.id
  where journal.kind = 'opening'
    and entry.account_id = account_row.id
    and journal.owner_participant_id = account_row.owner_participant_id;

  if account_row.opening_status = 'unknown' and opening_count <> 0 then
    raise exception using message = 'opening_status_mismatch', errcode = 'P0001';
  end if;
  if account_row.opening_status = 'posted' and (
    opening_count <> 1 or not exists (
      select 1
      from public.personal_account_transactions as journal
      join public.personal_account_entries as entry
        on entry.transaction_id = journal.id
      where journal.kind = 'opening'
        and journal.occurred_on = account_row.opening_balance_as_of
        and entry.account_id = account_row.id
    )
  ) then
    raise exception using message = 'opening_status_mismatch', errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.personal_transaction_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_personal_transaction_invariants(coalesce(new.id, old.id));
  return null;
end;
$$;

create constraint trigger personal_transactions_enforce_invariants
  after insert or update on public.personal_account_transactions
  deferrable initially deferred
  for each row execute function private.personal_transaction_constraint_trigger();

create or replace function private.personal_entry_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_personal_transaction_invariants(
    case when tg_op = 'DELETE' then old.transaction_id else new.transaction_id end
  );
  perform private.assert_personal_account_opening(
    case when tg_op = 'DELETE' then old.account_id else new.account_id end
  );
  return null;
end;
$$;

create constraint trigger personal_entries_enforce_invariants
  after insert or update or delete on public.personal_account_entries
  deferrable initially deferred
  for each row execute function private.personal_entry_constraint_trigger();

create or replace function private.personal_account_constraint_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_personal_account_opening(coalesce(new.id, old.id));
  return null;
end;
$$;

create constraint trigger personal_accounts_enforce_opening
  after insert or update on public.personal_accounts
  deferrable initially deferred
  for each row execute function private.personal_account_constraint_trigger();

alter table public.personal_accounts enable row level security;
alter table public.personal_account_transactions enable row level security;
alter table public.personal_account_entries enable row level security;
alter table public.personal_account_events enable row level security;

create policy personal_accounts_select_owner
  on public.personal_accounts for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

create policy personal_account_transactions_select_owner
  on public.personal_account_transactions for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

create policy personal_account_entries_select_owner
  on public.personal_account_entries for select to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.personal_account_transactions as journal
      where journal.id = personal_account_entries.transaction_id
        and journal.owner_participant_id = public.current_participant_id()
    )
  );

create policy personal_account_events_select_owner
  on public.personal_account_events for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

revoke all on table public.personal_accounts from public, anon, authenticated;
revoke all on table public.personal_account_transactions from public, anon, authenticated;
revoke all on table public.personal_account_entries from public, anon, authenticated;
revoke all on table public.personal_account_events from public, anon, authenticated;
grant select on table public.personal_accounts to authenticated;
grant select on table public.personal_account_transactions to authenticated;
grant select on table public.personal_account_entries to authenticated;
grant select on table public.personal_account_events to authenticated;

create or replace function public.create_personal_account(
  request_id uuid,
  account_name text,
  account_type text,
  currency_code text,
  opening_balance_minor bigint default null,
  balance_as_of date default null,
  make_default boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_name text := nullif(pg_catalog.btrim(account_name), '');
  normalized_type text := pg_catalog.lower(account_type);
  normalized_currency text := pg_catalog.upper(currency_code);
  derived_class text;
  fingerprint text;
  opening_fingerprint text;
  existing_account public.personal_accounts%rowtype;
  account_id uuid;
  transaction_id uuid;
  should_default boolean;
begin
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  if normalized_name is null or char_length(normalized_name) > 100 then
    raise exception using message = 'invalid_account_name', errcode = 'P0001';
  end if;
  if normalized_type in ('cash', 'bank', 'ewallet') then
    derived_class := 'asset';
  elsif normalized_type in ('credit_card', 'paylater', 'loan') then
    derived_class := 'liability';
  else
    raise exception using message = 'invalid_account_type', errcode = 'P0001';
  end if;
  if normalized_currency is null or normalized_currency !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;
  if (opening_balance_minor is null) <> (balance_as_of is null) then
    raise exception using message = 'invalid_opening_balance', errcode = 'P0001';
  end if;
  if opening_balance_minor < -9007199254740991
     or opening_balance_minor > 9007199254740991 then
    raise exception using message = 'invalid_opening_balance', errcode = 'P0001';
  end if;
  if make_default and derived_class <> 'asset' then
    raise exception using message = 'default_asset_account_required', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'name', normalized_name,
    'type', normalized_type,
    'currency', normalized_currency,
    'opening_balance_minor', opening_balance_minor,
    'balance_as_of', balance_as_of,
    'make_default', make_default
  ));

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tabby.personal.account:' || actor::text, 0)
  );

  select * into existing_account
  from public.personal_accounts
  where owner_participant_id = actor and client_request_id = request_id;

  if existing_account.id is not null then
    if existing_account.creation_payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'account_id', existing_account.id,
      'account_version', existing_account.version,
      'opening_status', existing_account.opening_status,
      'is_default', existing_account.is_default
    );
  end if;

  should_default := derived_class = 'asset' and (
    make_default or not exists (
      select 1 from public.personal_accounts
      where owner_participant_id = actor
        and is_default and archived_at is null
    )
  );

  if should_default then
    update public.personal_accounts
    set is_default = false, version = version + 1
    where owner_participant_id = actor and is_default and archived_at is null;
  end if;

  insert into public.personal_accounts(
    owner_participant_id, client_request_id, creation_payload_fingerprint,
    name, account_class, account_type, currency, is_default
  ) values (
    actor, request_id, fingerprint, normalized_name, derived_class,
    normalized_type, normalized_currency, should_default
  ) returning id into account_id;

  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_id, 'account.created',
    pg_catalog.jsonb_build_object(
      'account_id', account_id,
      'account_version', 1,
      'opening_status', 'unknown',
      'is_default', should_default
    )
  );

  if opening_balance_minor is not null then
    opening_fingerprint := private.personal_payload_fingerprint(
      pg_catalog.jsonb_build_object(
        'kind', 'opening', 'account_id', account_id,
        'amount_minor', opening_balance_minor, 'occurred_on', balance_as_of
      )
    );
    insert into public.personal_account_transactions(
      owner_participant_id, client_request_id, payload_fingerprint,
      kind, occurred_on, memo
    ) values (
      actor, request_id, opening_fingerprint, 'opening', balance_as_of,
      'Opening balance'
    ) returning id into transaction_id;
    insert into public.personal_account_entries(
      transaction_id, account_id, amount_minor, currency
    ) values (transaction_id, account_id, opening_balance_minor, normalized_currency);
    update public.personal_accounts
    set opening_status = 'posted', opening_balance_as_of = balance_as_of,
        version = version + 1
    where id = account_id;
    perform private.assert_personal_transaction_invariants(transaction_id);
    perform private.assert_personal_account_opening(account_id);
    insert into public.personal_account_events(
      owner_participant_id, client_request_id, payload_fingerprint,
      account_id, transaction_id, event_type, safe_diff
    ) values (
      actor, request_id, opening_fingerprint, account_id, transaction_id,
      'account.opening_completed',
      pg_catalog.jsonb_build_object('account_id', account_id, 'transaction_id', transaction_id)
    );
  end if;

  select * into existing_account from public.personal_accounts where id = account_id;
  return pg_catalog.jsonb_build_object(
    'account_id', existing_account.id,
    'account_version', existing_account.version,
    'opening_status', existing_account.opening_status,
    'is_default', existing_account.is_default
  );
end;
$$;

create or replace function public.update_personal_account(
  request_id uuid,
  target_account_id uuid,
  account_name text,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_name text := nullif(pg_catalog.btrim(account_name), '');
  fingerprint text;
  prior_event public.personal_account_events%rowtype;
  account_row public.personal_accounts%rowtype;
begin
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  if normalized_name is null or char_length(normalized_name) > 100 then
    raise exception using message = 'invalid_account_name', errcode = 'P0001';
  end if;
  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'account_id', target_account_id, 'name', normalized_name
  ));
  select * into prior_event from public.personal_account_events
  where owner_participant_id = actor and event_type = 'account.updated'
    and client_request_id = request_id;
  if prior_event.id is not null then
    if prior_event.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return prior_event.safe_diff;
  end if;
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if expected_version is null or account_row.version <> expected_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  update public.personal_accounts
  set name = normalized_name, version = version + 1
  where id = account_row.id
  returning * into account_row;
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, 'account.updated',
    pg_catalog.jsonb_build_object('account_id', account_row.id, 'account_version', account_row.version)
  ) returning * into prior_event;
  return prior_event.safe_diff;
end;
$$;

create or replace function public.set_default_personal_account(
  request_id uuid,
  target_account_id uuid,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text := private.personal_payload_fingerprint(
    pg_catalog.jsonb_build_object('account_id', target_account_id)
  );
  prior_event public.personal_account_events%rowtype;
  account_row public.personal_accounts%rowtype;
begin
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  select * into prior_event from public.personal_account_events
  where owner_participant_id = actor and event_type = 'account.default_changed'
    and client_request_id = request_id;
  if prior_event.id is not null then
    if prior_event.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return prior_event.safe_diff;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tabby.personal.account:' || actor::text, 0)
  );
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null or account_row.account_class <> 'asset'
     or account_row.account_type not in ('cash', 'bank', 'ewallet') then
    raise exception using message = 'default_asset_account_required', errcode = 'P0001';
  end if;
  if expected_version is null or account_row.version <> expected_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  update public.personal_accounts
  set is_default = false, version = version + 1
  where owner_participant_id = actor and is_default and id <> account_row.id;
  update public.personal_accounts
  set is_default = true, version = version + 1
  where id = account_row.id and not is_default
  returning * into account_row;
  if not found then
    select * into account_row from public.personal_accounts where id = target_account_id;
  end if;
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, 'account.default_changed',
    pg_catalog.jsonb_build_object('account_id', account_row.id, 'account_version', account_row.version)
  ) returning * into prior_event;
  return prior_event.safe_diff;
end;
$$;

create or replace function public.archive_personal_account(
  request_id uuid,
  target_account_id uuid,
  replacement_default_account_id uuid,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'account_id', target_account_id,
    'replacement_default_account_id', replacement_default_account_id
  ));
  prior_event public.personal_account_events%rowtype;
  account_row public.personal_accounts%rowtype;
  replacement_row public.personal_accounts%rowtype;
  other_eligible_exists boolean;
begin
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  select * into prior_event from public.personal_account_events
  where owner_participant_id = actor and event_type = 'account.archived'
    and client_request_id = request_id;
  if prior_event.id is not null then
    if prior_event.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return prior_event.safe_diff;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tabby.personal.account:' || actor::text, 0)
  );
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if expected_version is null or account_row.version <> expected_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  select exists (
    select 1 from public.personal_accounts
    where owner_participant_id = actor and id <> account_row.id
      and archived_at is null and account_type in ('cash', 'bank', 'ewallet')
  ) into other_eligible_exists;
  if account_row.is_default and other_eligible_exists
     and replacement_default_account_id is null then
    raise exception using message = 'replacement_default_required', errcode = 'P0001';
  end if;
  if not account_row.is_default and replacement_default_account_id is not null then
    raise exception using message = 'unexpected_replacement_default', errcode = 'P0001';
  end if;
  if replacement_default_account_id is not null then
    select * into replacement_row from public.personal_accounts
    where id = replacement_default_account_id and owner_participant_id = actor
      and id <> account_row.id and archived_at is null
      and account_type in ('cash', 'bank', 'ewallet') for update;
    if replacement_row.id is null then
      raise exception using message = 'invalid_replacement_default', errcode = 'P0001';
    end if;
  end if;
  update public.personal_accounts
  set archived_at = pg_catalog.now(), is_default = false, version = version + 1
  where id = account_row.id
  returning * into account_row;
  if replacement_row.id is not null then
    update public.personal_accounts
    set is_default = false, version = version + 1
    where owner_participant_id = actor and is_default and id <> replacement_row.id;
    update public.personal_accounts
    set is_default = true, version = version + 1
    where id = replacement_row.id and not is_default;
  end if;
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, 'account.archived',
    pg_catalog.jsonb_build_object(
      'account_id', account_row.id, 'account_version', account_row.version,
      'replacement_default_account_id', replacement_default_account_id
    )
  ) returning * into prior_event;
  return prior_event.safe_diff;
end;
$$;

create or replace function public.complete_account_opening(
  request_id uuid,
  target_account_id uuid,
  opening_balance_minor bigint,
  balance_as_of date,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'opening', 'account_id', target_account_id,
    'amount_minor', opening_balance_minor, 'occurred_on', balance_as_of
  ));
  existing_transaction public.personal_account_transactions%rowtype;
  account_row public.personal_accounts%rowtype;
  transaction_id uuid;
begin
  if request_id is null or opening_balance_minor is null
     or opening_balance_minor < -9007199254740991
     or opening_balance_minor > 9007199254740991 or balance_as_of is null then
    raise exception using message = 'invalid_opening_balance', errcode = 'P0001';
  end if;
  select * into existing_transaction from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'account_id', target_account_id,
      'transaction_id', existing_transaction.id,
      'opening_status', 'posted'
    );
  end if;
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if expected_version is null or account_row.version <> expected_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if account_row.opening_status <> 'unknown' then
    raise exception using message = 'opening_already_posted', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo
  ) values (actor, request_id, fingerprint, 'opening', balance_as_of, 'Opening balance')
  returning id into transaction_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values (transaction_id, account_row.id, opening_balance_minor, account_row.currency);
  update public.personal_accounts
  set opening_status = 'posted', opening_balance_as_of = balance_as_of,
      version = version + 1
  where id = account_row.id
  returning * into account_row;
  perform private.assert_personal_transaction_invariants(transaction_id);
  perform private.assert_personal_account_opening(account_row.id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, transaction_id,
    'account.opening_completed',
    pg_catalog.jsonb_build_object(
      'account_id', account_row.id, 'account_version', account_row.version,
      'transaction_id', transaction_id, 'opening_status', 'posted'
    )
  );
  return pg_catalog.jsonb_build_object(
    'account_id', account_row.id, 'account_version', account_row.version,
    'transaction_id', transaction_id, 'opening_status', 'posted'
  );
end;
$$;

create or replace function private.post_single_personal_entry(
  actor uuid,
  request_id uuid,
  transaction_kind text,
  target_account_id uuid,
  amount_minor bigint,
  transaction_date date,
  transaction_memo text,
  target_expense_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_memo text := nullif(pg_catalog.btrim(transaction_memo), '');
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', transaction_kind, 'account_id', target_account_id,
    'amount_minor', amount_minor, 'occurred_on', transaction_date,
    'memo', normalized_memo, 'expense_id', target_expense_id
  ));
  existing_transaction public.personal_account_transactions%rowtype;
  account_row public.personal_accounts%rowtype;
  transaction_id uuid;
begin
  select * into existing_transaction from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'transaction_id', existing_transaction.id,
      'account_id', target_account_id
    );
  end if;
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if account_row.account_class <> 'asset' then
    raise exception using message = 'asset_account_required', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo, expense_id
  ) values (
    actor, request_id, fingerprint, transaction_kind, transaction_date,
    normalized_memo, target_expense_id
  ) returning id into transaction_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values (transaction_id, account_row.id, amount_minor, account_row.currency);
  update public.personal_accounts set version = version + 1 where id = account_row.id;
  perform private.assert_personal_transaction_invariants(transaction_id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, transaction_id,
    'transaction.' || transaction_kind || '.posted',
    pg_catalog.jsonb_build_object('transaction_id', transaction_id, 'account_id', account_row.id)
  );
  return pg_catalog.jsonb_build_object('transaction_id', transaction_id, 'account_id', account_row.id);
end;
$$;

create or replace function public.create_income_transaction(
  request_id uuid,
  target_account_id uuid,
  amount_minor bigint,
  occurred_on date,
  transaction_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_personal_actor();
begin
  if request_id is null or amount_minor is null or amount_minor <= 0
     or amount_minor > 9007199254740991 or occurred_on is null then
    raise exception using message = 'invalid_income', errcode = 'P0001';
  end if;
  return private.post_single_personal_entry(
    actor, request_id, 'income', target_account_id, amount_minor,
    occurred_on, transaction_memo, null
  );
end;
$$;

create or replace function public.create_refund_transaction(
  request_id uuid,
  target_account_id uuid,
  amount_minor bigint,
  occurred_on date,
  target_expense_id uuid default null,
  transaction_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := private.require_personal_actor();
begin
  if request_id is null or amount_minor is null or amount_minor <= 0
     or amount_minor > 9007199254740991 or occurred_on is null then
    raise exception using message = 'invalid_refund', errcode = 'P0001';
  end if;
  if target_expense_id is not null
     and not private.can_read_expense(target_expense_id, actor) then
    raise exception using message = 'expense_read_denied', errcode = 'P0001';
  end if;
  return private.post_single_personal_entry(
    actor, request_id, 'refund', target_account_id, amount_minor,
    occurred_on, transaction_memo, target_expense_id
  );
end;
$$;

create or replace function public.create_transfer_transaction(
  request_id uuid,
  source_account_id uuid,
  source_amount_minor bigint,
  destination_account_id uuid,
  destination_amount_minor bigint,
  occurred_on date,
  transaction_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_memo text := nullif(pg_catalog.btrim(transaction_memo), '');
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'transfer', 'source_account_id', source_account_id,
    'source_amount_minor', source_amount_minor,
    'destination_account_id', destination_account_id,
    'destination_amount_minor', destination_amount_minor,
    'occurred_on', occurred_on, 'memo', normalized_memo
  ));
  existing_transaction public.personal_account_transactions%rowtype;
  source_row public.personal_accounts%rowtype;
  destination_row public.personal_accounts%rowtype;
  transaction_id uuid;
begin
  if request_id is null or source_account_id is null or destination_account_id is null
     or source_account_id = destination_account_id or source_amount_minor is null
     or destination_amount_minor is null or source_amount_minor <= 0
     or destination_amount_minor <= 0 or source_amount_minor > 9007199254740991
     or destination_amount_minor > 9007199254740991 or occurred_on is null then
    raise exception using message = 'invalid_transfer', errcode = 'P0001';
  end if;
  select * into existing_transaction from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object('transaction_id', existing_transaction.id);
  end if;
  perform 1 from public.personal_accounts
  where id in (source_account_id, destination_account_id)
  order by id for update;
  select * into source_row from public.personal_accounts
  where id = source_account_id and owner_participant_id = actor;
  select * into destination_row from public.personal_accounts
  where id = destination_account_id and owner_participant_id = actor;
  if source_row.id is null or destination_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if source_row.archived_at is not null or destination_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if source_row.account_class <> 'asset' or destination_row.account_class <> 'asset' then
    raise exception using message = 'asset_account_required', errcode = 'P0001';
  end if;
  if source_row.currency = destination_row.currency
     and source_amount_minor <> destination_amount_minor then
    raise exception using message = 'same_currency_transfer_mismatch', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo
  ) values (actor, request_id, fingerprint, 'transfer', occurred_on, normalized_memo)
  returning id into transaction_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values
    (transaction_id, source_row.id, -source_amount_minor, source_row.currency),
    (transaction_id, destination_row.id, destination_amount_minor, destination_row.currency);
  update public.personal_accounts set version = version + 1
  where id in (source_row.id, destination_row.id);
  perform private.assert_personal_transaction_invariants(transaction_id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, source_row.id, transaction_id,
    'transaction.transfer.posted',
    pg_catalog.jsonb_build_object(
      'transaction_id', transaction_id,
      'source_account_id', source_row.id,
      'destination_account_id', destination_row.id
    )
  );
  return pg_catalog.jsonb_build_object(
    'transaction_id', transaction_id,
    'source_account_id', source_row.id,
    'destination_account_id', destination_row.id
  );
end;
$$;

create or replace function public.reconcile_account_to_stated_balance(
  request_id uuid,
  target_account_id uuid,
  stated_balance_minor bigint,
  occurred_on date,
  transaction_memo text,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_memo text := nullif(pg_catalog.btrim(transaction_memo), '');
  account_row public.personal_accounts%rowtype;
  current_balance numeric;
  delta_minor bigint;
  fingerprint text;
  existing_transaction public.personal_account_transactions%rowtype;
  transaction_id uuid;
begin
  if request_id is null or stated_balance_minor is null
     or stated_balance_minor < -9007199254740991
     or stated_balance_minor > 9007199254740991 or occurred_on is null then
    raise exception using message = 'invalid_reconciliation', errcode = 'P0001';
  end if;
  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'reconciliation', 'account_id', target_account_id,
    'stated_balance_minor', stated_balance_minor, 'occurred_on', occurred_on,
    'memo', normalized_memo
  ));
  select * into existing_transaction from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object('transaction_id', existing_transaction.id, 'account_id', target_account_id);
  end if;
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if account_row.opening_status <> 'posted' then
    raise exception using message = 'opening_balance_required', errcode = 'P0001';
  end if;
  if expected_version is null or account_row.version <> expected_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  select coalesce(pg_catalog.sum(amount_minor), 0) into current_balance
  from public.personal_account_entries where account_id = account_row.id;
  delta_minor := stated_balance_minor - current_balance;
  if delta_minor = 0 then
    raise exception using message = 'no_reconciliation_needed', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo
  ) values (actor, request_id, fingerprint, 'reconciliation', occurred_on, normalized_memo)
  returning id into transaction_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values (transaction_id, account_row.id, delta_minor, account_row.currency);
  update public.personal_accounts set version = version + 1 where id = account_row.id;
  perform private.assert_personal_transaction_invariants(transaction_id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, account_row.id, transaction_id,
    'transaction.reconciliation.posted',
    pg_catalog.jsonb_build_object('transaction_id', transaction_id, 'account_id', account_row.id)
  );
  return pg_catalog.jsonb_build_object(
    'transaction_id', transaction_id, 'account_id', account_row.id,
    'delta_minor', delta_minor
  );
end;
$$;

create or replace function public.reverse_personal_account_transaction(
  request_id uuid,
  target_transaction_id uuid,
  occurred_on date,
  transaction_memo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_memo text := nullif(pg_catalog.btrim(transaction_memo), '');
  fingerprint text := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'reversal', 'target_transaction_id', target_transaction_id,
    'occurred_on', occurred_on, 'memo', normalized_memo
  ));
  existing_transaction public.personal_account_transactions%rowtype;
  target_row public.personal_account_transactions%rowtype;
  reversal_id uuid;
begin
  if request_id is null or occurred_on is null then
    raise exception using message = 'invalid_reversal', errcode = 'P0001';
  end if;
  select * into existing_transaction from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'transaction_id', existing_transaction.id,
      'reverses_transaction_id', target_transaction_id
    );
  end if;
  select * into target_row from public.personal_account_transactions
  where id = target_transaction_id and owner_participant_id = actor for update;
  if target_row.id is null then
    raise exception using message = 'personal_transaction_not_found', errcode = 'P0001';
  end if;
  if target_row.kind = 'reversal' then
    raise exception using message = 'reversal_of_reversal_forbidden', errcode = 'P0001';
  end if;
  if target_row.kind = 'opening' then
    raise exception using message = 'opening_reversal_forbidden', errcode = 'P0001';
  end if;
  if target_row.reversal_transaction_id is not null then
    raise exception using message = 'transaction_already_reversed', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo, reverses_transaction_id
  ) values (
    actor, request_id, fingerprint, 'reversal', occurred_on,
    coalesce(normalized_memo, 'Reversal'), target_row.id
  ) returning id into reversal_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  )
  select reversal_id, account_id, -amount_minor, currency
  from public.personal_account_entries
  where transaction_id = target_row.id;
  update public.personal_account_transactions
  set reversed_at = pg_catalog.now(), reversal_transaction_id = reversal_id,
      version = version + 1
  where id = target_row.id;
  update public.personal_accounts set version = version + 1
  where id in (
    select account_id from public.personal_account_entries
    where transaction_id = target_row.id
  );
  perform private.assert_personal_transaction_invariants(reversal_id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    transaction_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, reversal_id, 'transaction.reversed',
    pg_catalog.jsonb_build_object(
      'transaction_id', reversal_id,
      'reverses_transaction_id', target_row.id
    )
  );
  return pg_catalog.jsonb_build_object(
    'transaction_id', reversal_id,
    'reverses_transaction_id', target_row.id
  );
end;
$$;

revoke all on function private.personal_payload_fingerprint(jsonb) from public, anon, authenticated;
revoke all on function private.require_personal_actor() from public, anon, authenticated;
revoke all on function private.validate_personal_account_owner() from public, anon, authenticated;
revoke all on function private.validate_personal_account_entry() from public, anon, authenticated;
revoke all on function private.assert_personal_transaction_invariants(uuid) from public, anon, authenticated;
revoke all on function private.assert_personal_account_opening(uuid) from public, anon, authenticated;
revoke all on function private.personal_transaction_constraint_trigger() from public, anon, authenticated;
revoke all on function private.personal_entry_constraint_trigger() from public, anon, authenticated;
revoke all on function private.personal_account_constraint_trigger() from public, anon, authenticated;
revoke all on function private.post_single_personal_entry(uuid, uuid, text, uuid, bigint, date, text, uuid) from public, anon, authenticated;

revoke all on function public.create_personal_account(uuid, text, text, text, bigint, date, boolean) from public, anon, authenticated;
revoke all on function public.update_personal_account(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.set_default_personal_account(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.archive_personal_account(uuid, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.complete_account_opening(uuid, uuid, bigint, date, integer) from public, anon, authenticated;
revoke all on function public.create_income_transaction(uuid, uuid, bigint, date, text) from public, anon, authenticated;
revoke all on function public.create_refund_transaction(uuid, uuid, bigint, date, uuid, text) from public, anon, authenticated;
revoke all on function public.create_transfer_transaction(uuid, uuid, bigint, uuid, bigint, date, text) from public, anon, authenticated;
revoke all on function public.reconcile_account_to_stated_balance(uuid, uuid, bigint, date, text, integer) from public, anon, authenticated;
revoke all on function public.reverse_personal_account_transaction(uuid, uuid, date, text) from public, anon, authenticated;

grant execute on function public.create_personal_account(uuid, text, text, text, bigint, date, boolean) to authenticated;
grant execute on function public.update_personal_account(uuid, uuid, text, integer) to authenticated;
grant execute on function public.set_default_personal_account(uuid, uuid, integer) to authenticated;
grant execute on function public.archive_personal_account(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.complete_account_opening(uuid, uuid, bigint, date, integer) to authenticated;
grant execute on function public.create_income_transaction(uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.create_refund_transaction(uuid, uuid, bigint, date, uuid, text) to authenticated;
grant execute on function public.create_transfer_transaction(uuid, uuid, bigint, uuid, bigint, date, text) to authenticated;
grant execute on function public.reconcile_account_to_stated_balance(uuid, uuid, bigint, date, text, integer) to authenticated;
grant execute on function public.reverse_personal_account_transaction(uuid, uuid, date, text) to authenticated;

comment on table public.personal_accounts is 'Owner-private cash, bank, e-wallet, credit, PayLater, and loan accounts.';
comment on table public.personal_account_transactions is 'Append-only owner-private journal headers; reversals use compensating transactions.';
comment on table public.personal_account_entries is 'Signed account-currency legs belonging to one owner-private transaction.';
comment on table public.personal_account_events is 'Owner-only personal account audit; intentionally separate from shared financial_events.';
