-- Phase 6B: link Canonical Expenses to the owner's private account journal.
--
-- Expense totals, accepted payer contributions, shares, and Phase 5 balance
-- authority remain unchanged. This migration only records where the owner's
-- accepted payer contribution was actually funded.

create table public.personal_funding_intents (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  expense_id uuid not null references public.expenses(id) on delete restrict,
  account_id uuid references public.personal_accounts(id) on delete restrict,
  expense_amount_minor bigint not null
    check (expense_amount_minor between 1 and 9007199254740991),
  expense_currency text not null check (expense_currency ~ '^[A-Z]{3}$'),
  account_amount_minor bigint
    check (account_amount_minor between 1 and 9007199254740991),
  account_currency text check (account_currency is null or account_currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending'
    check (status in ('pending', 'posted', 'reversed')),
  posted_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  reversal_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  reversed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_participant_id, client_request_id),
  unique (posted_transaction_id),
  unique (reversal_transaction_id),
  check (
    (account_id is null and account_currency is null)
    or
    (account_id is not null and account_currency is not null)
  ),
  check (
    (status = 'pending'
      and account_amount_minor is null
      and posted_transaction_id is null
      and reversal_transaction_id is null
      and reversed_at is null)
    or
    (status = 'posted'
      and account_id is not null
      and account_amount_minor is not null
      and posted_transaction_id is not null
      and reversal_transaction_id is null
      and reversed_at is null)
    or
    (status = 'reversed'
      and account_id is not null
      and account_amount_minor is not null
      and posted_transaction_id is not null
      and reversal_transaction_id is not null
      and reversed_at is not null)
  )
);

create unique index personal_funding_intents_one_active_idx
  on public.personal_funding_intents(expense_id, owner_participant_id)
  where status in ('pending', 'posted');

create index personal_funding_intents_owner_status_idx
  on public.personal_funding_intents(owner_participant_id, status, created_at desc);

create trigger personal_funding_intents_set_updated_at
  before update on public.personal_funding_intents
  for each row execute function public.set_updated_at();

alter table public.personal_account_events
  add column funding_intent_id uuid
    references public.personal_funding_intents(id) on delete restrict;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_meta.conname
    from pg_catalog.pg_constraint as constraint_meta
    where constraint_meta.conrelid = 'public.personal_account_events'::regclass
      and constraint_meta.contype = 'c'
      and pg_catalog.pg_get_constraintdef(constraint_meta.oid)
        like '%num_nonnulls(account_id, transaction_id)%'
  loop
    execute pg_catalog.format(
      'alter table public.personal_account_events drop constraint %I',
      constraint_row.conname
    );
  end loop;
end $$;

alter table public.personal_account_events
  add constraint personal_account_events_has_parent_check
  check (num_nonnulls(account_id, transaction_id, funding_intent_id) >= 1);

create index personal_account_events_funding_intent_idx
  on public.personal_account_events(funding_intent_id)
  where funding_intent_id is not null;

create or replace function private.owner_expense_contribution(
  target_expense_id uuid,
  target_owner_id uuid
)
returns table(amount_minor bigint, currency text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select contribution.amount_minor, expense.currency
  from public.expenses as expense
  join public.expense_participations as participation
    on participation.expense_id = expense.id
  join public.payer_contributions as contribution
    on contribution.expense_participation_id = participation.id
  where expense.id = target_expense_id
    and expense.status = 'active'
    and participation.participant_id = target_owner_id
    and participation.state = 'accepted'
  limit 1;

  if not found then
    raise exception using
      message = 'owner_payer_contribution_required',
      errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.validate_personal_funding_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  derived_amount bigint;
  derived_currency text;
  account_owner uuid;
  selected_currency text;
begin
  if not exists (
    select 1 from public.participants
    where id = new.owner_participant_id and kind = 'account'
  ) then
    raise exception using message = 'account_participant_required', errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select amount_minor, currency
      into derived_amount, derived_currency
    from private.owner_expense_contribution(new.expense_id, new.owner_participant_id);

    if new.expense_amount_minor <> derived_amount
       or new.expense_currency <> derived_currency then
      raise exception using message = 'funding_contribution_mismatch', errcode = 'P0001';
    end if;
  end if;

  if new.account_id is not null then
    select owner_participant_id, currency
      into account_owner, selected_currency
    from public.personal_accounts
    where id = new.account_id;
    if account_owner is null then
      raise exception using message = 'personal_account_not_found', errcode = 'P0001';
    end if;
    if account_owner <> new.owner_participant_id then
      raise exception using message = 'personal_account_owner_mismatch', errcode = 'P0001';
    end if;
    if new.account_currency <> selected_currency then
      raise exception using message = 'account_currency_mismatch', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger personal_funding_intents_validate
  before insert or update
  on public.personal_funding_intents
  for each row execute function private.validate_personal_funding_intent();

create or replace function private.assert_expense_payload(
  target_expense_id uuid,
  expected_scope text,
  expected_space_id uuid,
  expected_total_minor bigint,
  expected_currency text,
  expected_description text,
  expected_category text,
  expected_occurred_on date,
  expected_participant_ids uuid[],
  expected_contribution_amounts bigint[],
  expected_share_amounts bigint[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  expense_row public.expenses%rowtype;
  actual_participants uuid[];
  actual_contributions bigint[];
  actual_shares bigint[];
begin
  select * into expense_row from public.expenses where id = target_expense_id;
  if expense_row.id is null then
    raise exception using message = 'expense_not_found', errcode = 'P0001';
  end if;

  select
    pg_catalog.array_agg(participation.participant_id order by participation.participant_order),
    pg_catalog.array_agg(coalesce(contribution.amount_minor, 0) order by participation.participant_order),
    pg_catalog.array_agg(share.amount_minor order by participation.participant_order)
  into actual_participants, actual_contributions, actual_shares
  from public.expense_participations as participation
  left join public.payer_contributions as contribution
    on contribution.expense_participation_id = participation.id
  join public.expense_shares as share
    on share.expense_participation_id = participation.id
  where participation.expense_id = target_expense_id;

  if expense_row.scope <> expected_scope
     or expense_row.space_id is distinct from expected_space_id
     or expense_row.total_minor <> expected_total_minor
     or expense_row.currency <> pg_catalog.upper(expected_currency)
     or expense_row.description is distinct from nullif(pg_catalog.btrim(expected_description), '')
     or expense_row.category <> coalesce(nullif(pg_catalog.btrim(expected_category), ''), 'Other')
     or expense_row.occurred_on <> expected_occurred_on
     or actual_participants <> expected_participant_ids
     or actual_contributions <> expected_contribution_amounts
     or actual_shares <> expected_share_amounts then
    raise exception using message = 'idempotency_conflict', errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.post_expense_funding_transaction(
  actor uuid,
  request_id uuid,
  target_intent_id uuid,
  target_expense_id uuid,
  target_account_id uuid,
  account_amount_minor bigint,
  transaction_date date,
  transaction_memo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.personal_accounts%rowtype;
  transaction_kind text;
  signed_amount bigint;
  fingerprint text;
  existing_transaction public.personal_account_transactions%rowtype;
  transaction_id uuid;
begin
  select * into account_row
  from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor
  for update;

  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;
  if account_amount_minor is null or account_amount_minor <= 0
     or account_amount_minor > 9007199254740991 then
    raise exception using message = 'invalid_account_amount', errcode = 'P0001';
  end if;

  if account_row.account_class = 'asset' then
    transaction_kind := 'expense_funding';
    signed_amount := -account_amount_minor;
  else
    transaction_kind := 'liability_purchase';
    signed_amount := account_amount_minor;
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', transaction_kind,
    'funding_intent_id', target_intent_id,
    'expense_id', target_expense_id,
    'account_id', target_account_id,
    'account_amount_minor', account_amount_minor,
    'occurred_on', transaction_date,
    'memo', nullif(pg_catalog.btrim(transaction_memo), '')
  ));

  select * into existing_transaction
  from public.personal_account_transactions
  where owner_participant_id = actor and client_request_id = request_id;

  if existing_transaction.id is not null then
    if existing_transaction.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return existing_transaction.id;
  end if;

  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo, expense_id
  ) values (
    actor, request_id, fingerprint, transaction_kind, transaction_date,
    nullif(pg_catalog.btrim(transaction_memo), ''), target_expense_id
  ) returning id into transaction_id;

  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values (
    transaction_id, account_row.id, signed_amount, account_row.currency
  );

  update public.personal_accounts set version = version + 1
  where id = account_row.id;

  perform private.assert_personal_transaction_invariants(transaction_id);
  return transaction_id;
end;
$$;

create or replace function public.link_expense_funding(
  request_id uuid,
  target_expense_id uuid,
  target_account_id uuid default null,
  supplied_account_amount_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text;
  existing_intent public.personal_funding_intents%rowtype;
  account_row public.personal_accounts%rowtype;
  contribution_amount bigint;
  expense_currency text;
  effective_account_amount bigint;
  intent_id uuid;
  transaction_id uuid;
  next_status text := 'pending';
  result_payload jsonb;
begin
  if request_id is null or target_expense_id is null then
    raise exception using message = 'invalid_funding_request', errcode = 'P0001';
  end if;
  if supplied_account_amount_minor is not null and (
    supplied_account_amount_minor <= 0
    or supplied_account_amount_minor > 9007199254740991
  ) then
    raise exception using message = 'invalid_account_amount', errcode = 'P0001';
  end if;
  if target_account_id is null and supplied_account_amount_minor is not null then
    raise exception using message = 'funding_account_required', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'expense_id', target_expense_id,
    'account_id', target_account_id,
    'supplied_account_amount_minor', supplied_account_amount_minor
  ));

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.personal.funding:' || actor::text || ':' || target_expense_id::text,
      0
    )
  );

  select * into existing_intent
  from public.personal_funding_intents
  where owner_participant_id = actor and client_request_id = request_id;

  if existing_intent.id is not null then
    if existing_intent.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'funding_intent_id', existing_intent.id,
      'funding_status', existing_intent.status,
      'posted_transaction_id', existing_intent.posted_transaction_id,
      'expense_amount_minor', existing_intent.expense_amount_minor,
      'expense_currency', existing_intent.expense_currency,
      'account_id', existing_intent.account_id,
      'account_amount_minor', existing_intent.account_amount_minor,
      'account_currency', existing_intent.account_currency
    );
  end if;

  if exists (
    select 1 from public.personal_funding_intents
    where expense_id = target_expense_id and owner_participant_id = actor
      and status in ('pending', 'posted')
  ) then
    raise exception using message = 'funding_intent_exists', errcode = 'P0001';
  end if;

  select amount_minor, currency into contribution_amount, expense_currency
  from private.owner_expense_contribution(target_expense_id, actor);

  if target_account_id is not null then
    select * into account_row
    from public.personal_accounts
    where id = target_account_id and owner_participant_id = actor
    for update;
    if account_row.id is null then
      raise exception using message = 'personal_account_not_found', errcode = 'P0001';
    end if;
    if account_row.archived_at is not null then
      raise exception using message = 'personal_account_archived', errcode = 'P0001';
    end if;

    effective_account_amount := supplied_account_amount_minor;
    if effective_account_amount is null and account_row.currency = expense_currency then
      effective_account_amount := contribution_amount;
    end if;
    if effective_account_amount is not null then
      next_status := 'posted';
    end if;
  end if;

  insert into public.personal_funding_intents(
    owner_participant_id, client_request_id, payload_fingerprint,
    expense_id, account_id, expense_amount_minor, expense_currency,
    account_currency, status
  ) values (
    actor, request_id, fingerprint, target_expense_id, target_account_id,
    contribution_amount, expense_currency, account_row.currency, 'pending'
  ) returning id into intent_id;

  if next_status = 'posted' then
    transaction_id := private.post_expense_funding_transaction(
      actor, request_id, intent_id, target_expense_id, target_account_id,
      effective_account_amount,
      (select occurred_on from public.expenses where id = target_expense_id),
      'Expense funding'
    );
    update public.personal_funding_intents
    set status = 'posted', account_amount_minor = effective_account_amount,
        posted_transaction_id = transaction_id, version = version + 1
    where id = intent_id
    returning * into existing_intent;
  else
    select * into existing_intent from public.personal_funding_intents where id = intent_id;
  end if;

  result_payload := pg_catalog.jsonb_build_object(
    'funding_intent_id', existing_intent.id,
    'funding_status', existing_intent.status,
    'posted_transaction_id', existing_intent.posted_transaction_id,
    'expense_amount_minor', existing_intent.expense_amount_minor,
    'expense_currency', existing_intent.expense_currency,
    'account_id', existing_intent.account_id,
    'account_amount_minor', existing_intent.account_amount_minor,
    'account_currency', existing_intent.account_currency
  );

  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, funding_intent_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, existing_intent.account_id,
    existing_intent.posted_transaction_id, existing_intent.id,
    case when existing_intent.status = 'posted'
      then 'funding.posted' else 'funding.pending' end,
    result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.complete_pending_funding(
  request_id uuid,
  target_funding_intent_id uuid,
  target_account_id uuid,
  account_amount_minor bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text;
  prior_event public.personal_account_events%rowtype;
  intent_row public.personal_funding_intents%rowtype;
  account_row public.personal_accounts%rowtype;
  selected_account_id uuid;
  transaction_id uuid;
  result_payload jsonb;
begin
  if request_id is null or target_funding_intent_id is null
     or account_amount_minor is null or account_amount_minor <= 0
     or account_amount_minor > 9007199254740991 then
    raise exception using message = 'invalid_funding_completion', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'funding_intent_id', target_funding_intent_id,
    'account_id', target_account_id,
    'account_amount_minor', account_amount_minor
  ));

  select * into prior_event
  from public.personal_account_events
  where owner_participant_id = actor and event_type = 'funding.posted'
    and client_request_id = request_id;

  if prior_event.id is not null then
    if prior_event.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return prior_event.safe_diff;
  end if;

  select * into intent_row
  from public.personal_funding_intents
  where id = target_funding_intent_id and owner_participant_id = actor
  for update;

  if intent_row.id is null then
    raise exception using message = 'funding_intent_not_found', errcode = 'P0001';
  end if;
  if intent_row.status <> 'pending' then
    raise exception using message = 'funding_not_pending', errcode = 'P0001';
  end if;

  selected_account_id := coalesce(intent_row.account_id, target_account_id);
  if selected_account_id is null then
    raise exception using message = 'funding_account_required', errcode = 'P0001';
  end if;
  if intent_row.account_id is not null
     and target_account_id is not null
     and target_account_id <> intent_row.account_id then
    raise exception using message = 'funding_account_changed', errcode = 'P0001';
  end if;

  select * into account_row
  from public.personal_accounts
  where id = selected_account_id and owner_participant_id = actor
  for update;
  if account_row.id is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_row.archived_at is not null then
    raise exception using message = 'personal_account_archived', errcode = 'P0001';
  end if;

  transaction_id := private.post_expense_funding_transaction(
    actor, request_id, intent_row.id, intent_row.expense_id,
    selected_account_id, account_amount_minor,
    (select occurred_on from public.expenses where id = intent_row.expense_id),
    'Completed pending expense funding'
  );

  update public.personal_funding_intents
  set account_id = selected_account_id,
      account_currency = account_row.currency,
      account_amount_minor = complete_pending_funding.account_amount_minor,
      status = 'posted', posted_transaction_id = transaction_id,
      version = version + 1
  where id = intent_row.id
  returning * into intent_row;

  result_payload := pg_catalog.jsonb_build_object(
    'funding_intent_id', intent_row.id,
    'funding_status', intent_row.status,
    'posted_transaction_id', intent_row.posted_transaction_id,
    'expense_amount_minor', intent_row.expense_amount_minor,
    'expense_currency', intent_row.expense_currency,
    'account_id', intent_row.account_id,
    'account_amount_minor', intent_row.account_amount_minor,
    'account_currency', intent_row.account_currency
  );

  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, funding_intent_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint, intent_row.account_id,
    intent_row.posted_transaction_id, intent_row.id,
    'funding.posted', result_payload
  );

  return result_payload;
end;
$$;

create or replace function public.create_expense_with_funding(
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
  funding_account_id uuid default null,
  funding_account_amount_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  created_expense_id uuid;
  funding_result jsonb;
begin
  if funding_request_id is null then
    raise exception using message = 'invalid_funding_request', errcode = 'P0001';
  end if;

  created_expense_id := public.create_expense(
    request_id, expense_scope, target_space_id, total_minor,
    currency_code, description, category, occurred_on,
    participant_ids, contribution_amounts, share_amounts
  );

  perform private.assert_expense_payload(
    created_expense_id, expense_scope, target_space_id, total_minor,
    currency_code, description, category, occurred_on,
    participant_ids, contribution_amounts, share_amounts
  );

  if not exists (
    select 1 from public.expense_participations
    where expense_id = created_expense_id
      and participant_id = actor
  ) then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;

  funding_result := public.link_expense_funding(
    funding_request_id, created_expense_id, funding_account_id,
    funding_account_amount_minor
  );

  return pg_catalog.jsonb_build_object(
    'expense_id', created_expense_id,
    'funding', funding_result
  );
end;
$$;

create or replace function private.mark_reversed_funding_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent_row public.personal_funding_intents%rowtype;
  reversal_row public.personal_account_transactions%rowtype;
begin
  if old.reversal_transaction_id is not null
     or new.reversal_transaction_id is null then
    return new;
  end if;

  update public.personal_funding_intents
  set status = 'reversed', reversal_transaction_id = new.reversal_transaction_id,
      reversed_at = new.reversed_at, version = version + 1
  where posted_transaction_id = new.id and status = 'posted'
  returning * into intent_row;

  if intent_row.id is not null then
    select * into reversal_row from public.personal_account_transactions
    where id = new.reversal_transaction_id;
    insert into public.personal_account_events(
      owner_participant_id, client_request_id, payload_fingerprint,
      account_id, transaction_id, funding_intent_id, event_type, safe_diff
    ) values (
      intent_row.owner_participant_id,
      reversal_row.client_request_id,
      reversal_row.payload_fingerprint,
      intent_row.account_id,
      reversal_row.id,
      intent_row.id,
      'funding.reversed',
      pg_catalog.jsonb_build_object(
        'funding_intent_id', intent_row.id,
        'posted_transaction_id', intent_row.posted_transaction_id,
        'reversal_transaction_id', reversal_row.id
      )
    );
  end if;
  return new;
end;
$$;

create trigger personal_funding_intent_reverse_with_journal
  after update of reversal_transaction_id
  on public.personal_account_transactions
  for each row execute function private.mark_reversed_funding_intent();

alter table public.personal_funding_intents enable row level security;

create policy personal_funding_intents_select_owner
  on public.personal_funding_intents for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

revoke all on table public.personal_funding_intents from public, anon, authenticated;
grant select on table public.personal_funding_intents to authenticated;

revoke all on function private.owner_expense_contribution(uuid, uuid) from public, anon, authenticated;
revoke all on function private.validate_personal_funding_intent() from public, anon, authenticated;
revoke all on function private.assert_expense_payload(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[]) from public, anon, authenticated;
revoke all on function private.post_expense_funding_transaction(uuid, uuid, uuid, uuid, uuid, bigint, date, text) from public, anon, authenticated;
revoke all on function private.mark_reversed_funding_intent() from public, anon, authenticated;

revoke all on function public.link_expense_funding(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.complete_pending_funding(uuid, uuid, uuid, bigint) from public, anon, authenticated;
revoke all on function public.create_expense_with_funding(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[], uuid, uuid, bigint) from public, anon, authenticated;

grant execute on function public.link_expense_funding(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.complete_pending_funding(uuid, uuid, uuid, bigint) to authenticated;
grant execute on function public.create_expense_with_funding(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[], uuid, uuid, bigint) to authenticated;

comment on table public.personal_funding_intents is 'Owner-private link from accepted payer contribution to actual asset debit or liability principal.';
comment on function public.link_expense_funding(uuid, uuid, uuid, bigint) is 'Links one owner payer contribution to an immediate or pending private funding movement.';
comment on function public.complete_pending_funding(uuid, uuid, uuid, bigint) is 'Posts an explicit account-currency amount without recreating or changing the Canonical Expense.';
comment on function public.create_expense_with_funding(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[], uuid, uuid, bigint) is 'Atomically creates an Expense and its owner-private immediate or pending funding intent.';
