-- Phase 6C: typed owner-private recurring bookkeeping.
--
-- This is intentionally separate from recurring_rules / recurring_drafts,
-- which remain the review-only capture-template system. Personal recurring
-- rules can create only owner-local Canonical Expenses and their private
-- funding intents.

create extension if not exists "uuid-ossp" with schema extensions;

alter table public.personal_funding_intents
  add column cancelled_at timestamptz;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_meta.conname
    from pg_catalog.pg_constraint as constraint_meta
    where constraint_meta.conrelid = 'public.personal_funding_intents'::regclass
      and constraint_meta.contype = 'c'
      and pg_catalog.pg_get_constraintdef(constraint_meta.oid) like '%status%'
      and pg_catalog.pg_get_constraintdef(constraint_meta.oid) like '%pending%'
      and pg_catalog.pg_get_constraintdef(constraint_meta.oid) like '%posted%'
  loop
    execute pg_catalog.format(
      'alter table public.personal_funding_intents drop constraint %I',
      constraint_row.conname
    );
  end loop;
end $$;

alter table public.personal_funding_intents
  add constraint personal_funding_intents_status_check
    check (status in ('pending', 'posted', 'reversed', 'cancelled')),
  add constraint personal_funding_intents_state_check
    check (
      (status = 'pending'
        and account_amount_minor is null
        and posted_transaction_id is null
        and reversal_transaction_id is null
        and reversed_at is null
        and cancelled_at is null)
      or
      (status = 'posted'
        and account_id is not null
        and account_amount_minor is not null
        and posted_transaction_id is not null
        and reversal_transaction_id is null
        and reversed_at is null
        and cancelled_at is null)
      or
      (status = 'reversed'
        and account_id is not null
        and account_amount_minor is not null
        and posted_transaction_id is not null
        and reversal_transaction_id is not null
        and reversed_at is not null
        and cancelled_at is null)
      or
      (status = 'cancelled'
        and account_amount_minor is null
        and posted_transaction_id is null
        and reversal_transaction_id is null
        and reversed_at is null
        and cancelled_at is not null)
    );

create table public.personal_recurring_rules (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  title text not null check (pg_catalog.char_length(pg_catalog.btrim(title)) between 1 and 100),
  description text,
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  category text not null check (pg_catalog.char_length(pg_catalog.btrim(category)) between 1 and 100),
  funding_account_id uuid not null references public.personal_accounts(id) on delete restrict,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  anchor_day_of_month integer check (anchor_day_of_month between 1 and 31),
  anchor_weekday integer check (anchor_weekday between 1 and 7),
  timezone text not null check (pg_catalog.char_length(pg_catalog.btrim(timezone)) between 1 and 100),
  local_time time without time zone not null,
  start_on date not null,
  end_on date,
  posting_mode text not null check (posting_mode in ('auto_post', 'review')),
  paused boolean not null default false,
  next_due_on date not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_participant_id, client_request_id),
  check (end_on is null or end_on >= start_on),
  check (
    (cadence = 'monthly' and anchor_day_of_month is not null and anchor_weekday is null)
    or
    (cadence = 'weekly' and anchor_weekday is not null and anchor_day_of_month is null)
  )
);

create index personal_recurring_rules_owner_due_idx
  on public.personal_recurring_rules(owner_participant_id, next_due_on, id)
  where not paused;

create table public.personal_recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.personal_recurring_rules(id) on delete restrict,
  owner_participant_id uuid not null references public.participants(id),
  scheduled_for date not null,
  expense_request_id uuid not null,
  funding_request_id uuid not null,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'posted', 'skipped', 'failed', 'reversed')),
  effective_amount_minor bigint
    check (effective_amount_minor between 1 and 9007199254740991),
  effective_currency text
    check (effective_currency is null or effective_currency ~ '^[A-Z]{3}$'),
  effective_account_id uuid references public.personal_accounts(id) on delete restrict,
  effective_occurred_on date,
  expense_id uuid references public.expenses(id) on delete restrict,
  funding_intent_id uuid references public.personal_funding_intents(id) on delete restrict,
  error_code text,
  posted_at timestamptz,
  skipped_at timestamptz,
  reversed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (rule_id, scheduled_for),
  unique (owner_participant_id, expense_request_id),
  unique (owner_participant_id, funding_request_id),
  check (
    (status = 'pending_review'
      and expense_id is null and funding_intent_id is null
      and error_code is null and posted_at is null
      and skipped_at is null and reversed_at is null)
    or
    (status = 'posted'
      and effective_amount_minor is not null
      and effective_currency is not null
      and effective_account_id is not null
      and effective_occurred_on is not null
      and expense_id is not null and funding_intent_id is not null
      and error_code is null and posted_at is not null
      and skipped_at is null and reversed_at is null)
    or
    (status = 'skipped'
      and expense_id is null and funding_intent_id is null
      and error_code is null and posted_at is null
      and skipped_at is not null and reversed_at is null)
    or
    (status = 'failed'
      and expense_id is null and funding_intent_id is null
      and error_code is not null and posted_at is null
      and skipped_at is null and reversed_at is null)
    or
    (status = 'reversed'
      and effective_amount_minor is not null
      and effective_currency is not null
      and effective_account_id is not null
      and effective_occurred_on is not null
      and expense_id is not null and funding_intent_id is not null
      and error_code is null and posted_at is not null
      and skipped_at is null and reversed_at is not null)
  )
);

create index personal_recurring_occurrences_owner_status_idx
  on public.personal_recurring_occurrences(owner_participant_id, status, scheduled_for desc);

create trigger personal_recurring_rules_set_updated_at
  before update on public.personal_recurring_rules
  for each row execute function public.set_updated_at();

create trigger personal_recurring_occurrences_set_updated_at
  before update on public.personal_recurring_occurrences
  for each row execute function public.set_updated_at();

create or replace function private.personal_recurring_request_id(
  target_rule_id uuid,
  scheduled_date date,
  request_kind text
)
returns uuid
language sql
immutable
strict
set search_path = ''
as $$
  select extensions.uuid_generate_v5(
    '9dbf0ea0-4b11-5ee4-9bb3-38cb6a2764fb'::uuid,
    target_rule_id::text || ':' || scheduled_date::text || ':' || request_kind
  );
$$;

create or replace function private.first_personal_recurring_date(
  base_date date,
  cadence_value text,
  monthly_anchor integer,
  weekly_anchor integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  month_start date;
  month_last_day integer;
  candidate date;
begin
  if cadence_value = 'weekly' and weekly_anchor between 1 and 7
     and monthly_anchor is null then
    return base_date + (
      (weekly_anchor - extract(isodow from base_date)::integer + 7) % 7
    );
  end if;

  if cadence_value <> 'monthly' or monthly_anchor not between 1 and 31
     or weekly_anchor is not null then
    raise exception using message = 'invalid_recurring_cadence', errcode = 'P0001';
  end if;

  month_start := pg_catalog.date_trunc('month', base_date::timestamp)::date;
  month_last_day := extract(
    day from month_start + interval '1 month - 1 day'
  )::integer;
  candidate := pg_catalog.make_date(
    extract(year from month_start)::integer,
    extract(month from month_start)::integer,
    least(monthly_anchor, month_last_day)
  );

  if candidate < base_date then
    candidate := public.next_recurring_local_date(
      candidate, 'monthly', monthly_anchor
    );
  end if;
  return candidate;
end;
$$;

create or replace function private.next_personal_recurring_date(
  scheduled_date date,
  cadence_value text,
  monthly_anchor integer,
  weekly_anchor integer
)
returns date
language plpgsql
immutable
set search_path = ''
as $$
begin
  if cadence_value = 'weekly' and weekly_anchor between 1 and 7
     and monthly_anchor is null then
    return scheduled_date + 7;
  end if;
  if cadence_value = 'monthly' and monthly_anchor between 1 and 31
     and weekly_anchor is null then
    return public.next_recurring_local_date(
      scheduled_date, 'monthly', monthly_anchor
    );
  end if;
  raise exception using message = 'invalid_recurring_cadence', errcode = 'P0001';
end;
$$;

create or replace function private.personal_recurring_error_code(
  database_message text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case database_message
    when 'personal_account_not_found' then 'account_missing'
    when 'personal_account_archived' then 'account_archived'
    when 'personal_account_owner_mismatch' then 'account_owner_mismatch'
    when 'owner_payer_contribution_required' then 'contribution_missing'
    when 'funding_intent_exists' then 'funding_conflict'
    when 'idempotency_conflict' then 'idempotency_conflict'
    when 'invalid_amount' then 'invalid_amount'
    when 'invalid_currency' then 'invalid_currency'
    else 'posting_failed'
  end;
$$;

create or replace function private.validate_personal_recurring_rule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_owner uuid;
begin
  if not exists (
    select 1 from public.participants
    where id = new.owner_participant_id and kind = 'account'
  ) then
    raise exception using message = 'account_participant_required', errcode = 'P0001';
  end if;

  select owner_participant_id into account_owner
  from public.personal_accounts
  where id = new.funding_account_id and archived_at is null;
  if account_owner is null then
    raise exception using message = 'personal_account_not_found', errcode = 'P0001';
  end if;
  if account_owner <> new.owner_participant_id then
    raise exception using message = 'personal_account_owner_mismatch', errcode = 'P0001';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_timezone_names as zone
    where zone.name = pg_catalog.btrim(new.timezone)
  ) then
    raise exception using message = 'invalid_recurring_timezone', errcode = 'P0001';
  end if;

  new.title := pg_catalog.btrim(new.title);
  new.description := nullif(pg_catalog.btrim(new.description), '');
  new.currency := pg_catalog.upper(new.currency);
  new.category := coalesce(nullif(pg_catalog.btrim(new.category), ''), 'Other');
  new.timezone := pg_catalog.btrim(new.timezone);
  return new;
end;
$$;

create trigger personal_recurring_rules_validate_insert
  before insert
  on public.personal_recurring_rules
  for each row execute function private.validate_personal_recurring_rule();

create trigger personal_recurring_rules_validate_update
  before update of owner_participant_id, title, description, currency, category,
    funding_account_id, timezone
  on public.personal_recurring_rules
  for each row execute function private.validate_personal_recurring_rule();

create or replace function private.validate_personal_recurring_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_owner uuid;
  account_owner uuid;
begin
  select owner_participant_id into rule_owner
  from public.personal_recurring_rules where id = new.rule_id;
  if rule_owner is null or rule_owner <> new.owner_participant_id then
    raise exception using message = 'recurring_rule_owner_mismatch', errcode = 'P0001';
  end if;
  if new.effective_account_id is not null then
    select owner_participant_id into account_owner
    from public.personal_accounts where id = new.effective_account_id;
    if account_owner is null or account_owner <> new.owner_participant_id then
      raise exception using message = 'personal_account_owner_mismatch', errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger personal_recurring_occurrences_validate
  before insert or update
  on public.personal_recurring_occurrences
  for each row execute function private.validate_personal_recurring_occurrence();

alter table public.personal_recurring_rules enable row level security;
alter table public.personal_recurring_occurrences enable row level security;

create policy personal_recurring_rules_select_owner
  on public.personal_recurring_rules for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

create policy personal_recurring_occurrences_select_owner
  on public.personal_recurring_occurrences for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

revoke all on table public.personal_recurring_rules from public, anon, authenticated;
revoke all on table public.personal_recurring_occurrences from public, anon, authenticated;
grant select on table public.personal_recurring_rules to authenticated;
grant select on table public.personal_recurring_occurrences to authenticated;

create or replace function public.create_personal_recurring_rule(
  request_id uuid,
  rule_title text,
  rule_description text,
  rule_amount_minor bigint,
  currency_code text,
  rule_category text,
  target_funding_account_id uuid,
  rule_cadence text,
  rule_anchor_day_of_month integer,
  rule_anchor_weekday integer,
  rule_timezone text,
  rule_local_time time without time zone,
  rule_start_on date,
  rule_end_on date,
  rule_posting_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text;
  existing_rule public.personal_recurring_rules%rowtype;
  first_due date;
begin
  if request_id is null or rule_title is null
     or rule_amount_minor is null or rule_amount_minor <= 0
     or rule_amount_minor > 9007199254740991
     or currency_code is null or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$'
     or target_funding_account_id is null
     or rule_cadence not in ('weekly', 'monthly')
     or rule_timezone is null or rule_local_time is null
     or rule_start_on is null or rule_posting_mode not in ('auto_post', 'review')
     or (rule_end_on is not null and rule_end_on < rule_start_on) then
    raise exception using message = 'invalid_personal_recurring_rule', errcode = 'P0001';
  end if;

  first_due := private.first_personal_recurring_date(
    rule_start_on, rule_cadence,
    rule_anchor_day_of_month, rule_anchor_weekday
  );

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'title', nullif(pg_catalog.btrim(rule_title), ''),
    'description', nullif(pg_catalog.btrim(rule_description), ''),
    'amount_minor', rule_amount_minor,
    'currency', pg_catalog.upper(currency_code),
    'category', coalesce(nullif(pg_catalog.btrim(rule_category), ''), 'Other'),
    'funding_account_id', target_funding_account_id,
    'cadence', rule_cadence,
    'anchor_day_of_month', rule_anchor_day_of_month,
    'anchor_weekday', rule_anchor_weekday,
    'timezone', pg_catalog.btrim(rule_timezone),
    'local_time', rule_local_time,
    'start_on', rule_start_on,
    'end_on', rule_end_on,
    'posting_mode', rule_posting_mode
  ));

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.personal.recurring.create:' || actor::text || ':' || request_id::text,
      0
    )
  );

  select * into existing_rule
  from public.personal_recurring_rules
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_rule.id is not null then
    if existing_rule.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'rule_id', existing_rule.id,
      'next_due_on', existing_rule.next_due_on,
      'version', existing_rule.version
    );
  end if;

  insert into public.personal_recurring_rules(
    owner_participant_id, client_request_id, payload_fingerprint,
    title, description, amount_minor, currency, category,
    funding_account_id, cadence, anchor_day_of_month, anchor_weekday,
    timezone, local_time, start_on, end_on, posting_mode, next_due_on
  ) values (
    actor, request_id, fingerprint,
    rule_title, rule_description, rule_amount_minor, pg_catalog.upper(currency_code),
    coalesce(nullif(pg_catalog.btrim(rule_category), ''), 'Other'),
    target_funding_account_id, rule_cadence,
    rule_anchor_day_of_month, rule_anchor_weekday,
    rule_timezone, rule_local_time, rule_start_on, rule_end_on,
    rule_posting_mode, first_due
  ) returning * into existing_rule;

  return pg_catalog.jsonb_build_object(
    'rule_id', existing_rule.id,
    'next_due_on', existing_rule.next_due_on,
    'version', existing_rule.version
  );
end;
$$;

create or replace function public.update_personal_recurring_rule(
  target_rule_id uuid,
  expected_version integer,
  rule_title text,
  rule_description text,
  rule_amount_minor bigint,
  currency_code text,
  rule_category text,
  target_funding_account_id uuid,
  rule_cadence text,
  rule_anchor_day_of_month integer,
  rule_anchor_weekday integer,
  rule_timezone text,
  rule_local_time time without time zone,
  rule_start_on date,
  rule_end_on date,
  rule_posting_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  rule_row public.personal_recurring_rules%rowtype;
  next_base date;
  recalculated_due date;
begin
  select * into rule_row
  from public.personal_recurring_rules
  where id = target_rule_id and owner_participant_id = actor
  for update;
  if rule_row.id is null then
    raise exception using message = 'personal_recurring_rule_not_found', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> rule_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if rule_title is null
     or rule_amount_minor is null or rule_amount_minor <= 0
     or rule_amount_minor > 9007199254740991
     or currency_code is null or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$'
     or target_funding_account_id is null
     or rule_cadence not in ('weekly', 'monthly')
     or rule_timezone is null or rule_local_time is null
     or rule_start_on is null or rule_posting_mode not in ('auto_post', 'review')
     or (rule_end_on is not null and rule_end_on < rule_start_on) then
    raise exception using message = 'invalid_personal_recurring_rule', errcode = 'P0001';
  end if;

  next_base := greatest(rule_start_on, rule_row.next_due_on);
  recalculated_due := private.first_personal_recurring_date(
    next_base, rule_cadence,
    rule_anchor_day_of_month, rule_anchor_weekday
  );

  update public.personal_recurring_rules
  set title = rule_title,
      description = rule_description,
      amount_minor = rule_amount_minor,
      currency = pg_catalog.upper(currency_code),
      category = coalesce(nullif(pg_catalog.btrim(rule_category), ''), 'Other'),
      funding_account_id = target_funding_account_id,
      cadence = rule_cadence,
      anchor_day_of_month = rule_anchor_day_of_month,
      anchor_weekday = rule_anchor_weekday,
      timezone = rule_timezone,
      local_time = rule_local_time,
      start_on = rule_start_on,
      end_on = rule_end_on,
      posting_mode = rule_posting_mode,
      next_due_on = recalculated_due,
      version = version + 1
  where id = rule_row.id
  returning * into rule_row;

  return pg_catalog.jsonb_build_object(
    'rule_id', rule_row.id,
    'next_due_on', rule_row.next_due_on,
    'version', rule_row.version
  );
end;
$$;

create or replace function public.set_personal_recurring_paused(
  target_rule_id uuid,
  should_pause boolean,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  rule_row public.personal_recurring_rules%rowtype;
begin
  select * into rule_row
  from public.personal_recurring_rules
  where id = target_rule_id and owner_participant_id = actor
  for update;
  if rule_row.id is null then
    raise exception using message = 'personal_recurring_rule_not_found', errcode = 'P0001';
  end if;
  if should_pause is null or expected_version is null
     or expected_version <> rule_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.personal_recurring_rules
  set paused = should_pause, version = version + 1
  where id = rule_row.id
  returning * into rule_row;

  return pg_catalog.jsonb_build_object(
    'rule_id', rule_row.id,
    'paused', rule_row.paused,
    'version', rule_row.version
  );
end;
$$;

create or replace function private.post_personal_recurring_occurrence_for(
  actor uuid,
  target_occurrence_id uuid,
  allowed_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  occurrence_row public.personal_recurring_occurrences%rowtype;
  rule_row public.personal_recurring_rules%rowtype;
  actual_amount bigint;
  actual_currency text;
  actual_account uuid;
  actual_date date;
  create_result jsonb;
  failure_message text;
  failure_code text;
begin
  select * into occurrence_row
  from public.personal_recurring_occurrences
  where id = target_occurrence_id and owner_participant_id = actor
  for update;
  if occurrence_row.id is null then
    raise exception using message = 'personal_recurring_occurrence_not_found', errcode = 'P0001';
  end if;
  if occurrence_row.status <> allowed_status then
    raise exception using message = 'personal_recurring_occurrence_state_conflict', errcode = 'P0001';
  end if;

  select * into rule_row from public.personal_recurring_rules
  where id = occurrence_row.rule_id and owner_participant_id = actor;
  if rule_row.id is null then
    raise exception using message = 'personal_recurring_rule_not_found', errcode = 'P0001';
  end if;

  actual_amount := coalesce(occurrence_row.effective_amount_minor, rule_row.amount_minor);
  actual_currency := coalesce(occurrence_row.effective_currency, rule_row.currency);
  actual_account := coalesce(occurrence_row.effective_account_id, rule_row.funding_account_id);
  actual_date := coalesce(occurrence_row.effective_occurred_on, occurrence_row.scheduled_for);

  begin
    create_result := public.create_expense_with_funding(
      occurrence_row.expense_request_id,
      'personal', null, actual_amount, actual_currency,
      coalesce(rule_row.description, rule_row.title),
      rule_row.category, actual_date,
      array[actor], array[actual_amount], array[actual_amount],
      occurrence_row.funding_request_id, actual_account, null
    );

    update public.personal_recurring_occurrences
    set status = 'posted',
        effective_amount_minor = actual_amount,
        effective_currency = actual_currency,
        effective_account_id = actual_account,
        effective_occurred_on = actual_date,
        expense_id = (create_result ->> 'expense_id')::uuid,
        funding_intent_id = (create_result -> 'funding' ->> 'funding_intent_id')::uuid,
        error_code = null,
        posted_at = pg_catalog.now(),
        version = version + 1
    where id = occurrence_row.id
    returning * into occurrence_row;
  exception when others then
    get stacked diagnostics failure_message = message_text;
    failure_code := private.personal_recurring_error_code(failure_message);
    update public.personal_recurring_occurrences
    set status = 'failed', error_code = failure_code,
        expense_id = null, funding_intent_id = null,
        posted_at = null, version = version + 1
    where id = occurrence_row.id
    returning * into occurrence_row;
  end;

  return pg_catalog.jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', occurrence_row.status,
    'expense_id', occurrence_row.expense_id,
    'funding_intent_id', occurrence_row.funding_intent_id,
    'error_code', occurrence_row.error_code,
    'version', occurrence_row.version
  );
end;
$$;

create or replace function private.personal_recurring_due_count(
  actor uuid,
  due_override date default null
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  rule_row public.personal_recurring_rules%rowtype;
  scheduled_date date;
  due_through date;
  result_count integer := 0;
begin
  for rule_row in
    select * from public.personal_recurring_rules
    where owner_participant_id = actor and not paused
  loop
    if due_override is not null then
      due_through := due_override;
    elsif rule_row.local_time
      <= pg_catalog.timezone(rule_row.timezone, pg_catalog.now())::time then
      due_through := pg_catalog.timezone(
        rule_row.timezone, pg_catalog.now()
      )::date;
    else
      due_through := pg_catalog.timezone(
        rule_row.timezone, pg_catalog.now()
      )::date - 1;
    end if;
    scheduled_date := rule_row.next_due_on;
    while scheduled_date <= due_through
      and (rule_row.end_on is null or scheduled_date <= rule_row.end_on)
      and result_count < 10000
    loop
      result_count := result_count + 1;
      scheduled_date := private.next_personal_recurring_date(
        scheduled_date, rule_row.cadence,
        rule_row.anchor_day_of_month, rule_row.anchor_weekday
      );
    end loop;
  end loop;
  return result_count;
end;
$$;

create or replace function private.catch_up_personal_recurring_for(
  actor uuid,
  due_override date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule_row public.personal_recurring_rules%rowtype;
  occurrence_row public.personal_recurring_occurrences%rowtype;
  next_date date;
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
    pg_catalog.hashtextextended('tabby.personal.recurring.catchup:' || actor::text, 0)
  );

  while processed_count < 24 loop
    select rule.* into rule_row
    from public.personal_recurring_rules as rule
    where rule.owner_participant_id = actor
      and not rule.paused
      and (rule.end_on is null or rule.next_due_on <= rule.end_on)
      and (
        due_override is not null and rule.next_due_on <= due_override
        or
        due_override is null and (
          rule.next_due_on < pg_catalog.timezone(rule.timezone, pg_catalog.now())::date
          or (
            rule.next_due_on = pg_catalog.timezone(rule.timezone, pg_catalog.now())::date
            and rule.local_time <= pg_catalog.timezone(rule.timezone, pg_catalog.now())::time
          )
        )
      )
    order by rule.next_due_on, rule.id
    limit 1
    for update;

    exit when rule_row.id is null;
    insert into public.personal_recurring_occurrences(
      rule_id, owner_participant_id, scheduled_for,
      expense_request_id, funding_request_id, status
    ) values (
      rule_row.id, actor, rule_row.next_due_on,
      private.personal_recurring_request_id(rule_row.id, rule_row.next_due_on, 'expense'),
      private.personal_recurring_request_id(rule_row.id, rule_row.next_due_on, 'funding'),
      'pending_review'
    )
    on conflict (rule_id, scheduled_for) do nothing;

    select * into occurrence_row
    from public.personal_recurring_occurrences
    where rule_id = rule_row.id and scheduled_for = rule_row.next_due_on
    for update;

    next_date := private.next_personal_recurring_date(
      rule_row.next_due_on, rule_row.cadence,
      rule_row.anchor_day_of_month, rule_row.anchor_weekday
    );
    update public.personal_recurring_rules
    set next_due_on = next_date, version = version + 1
    where id = rule_row.id;

    if rule_row.posting_mode = 'auto_post'
       and occurrence_row.status = 'pending_review' then
      post_result := private.post_personal_recurring_occurrence_for(
        actor, occurrence_row.id, 'pending_review'
      );
      if post_result ->> 'status' = 'failed' then
        failed_count := failed_count + 1;
      end if;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return pg_catalog.jsonb_build_object(
    'processed', processed_count,
    'failed', failed_count,
    'remaining', private.personal_recurring_due_count(actor, due_override)
  );
end;
$$;

create or replace function public.catch_up_personal_recurring()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
begin
  return private.catch_up_personal_recurring_for(actor, null);
end;
$$;

create or replace function public.post_personal_recurring_occurrence(
  target_occurrence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
begin
  return private.post_personal_recurring_occurrence_for(
    actor, target_occurrence_id, 'pending_review'
  );
end;
$$;

create or replace function public.retry_personal_recurring_occurrence(
  target_occurrence_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
begin
  return private.post_personal_recurring_occurrence_for(
    actor, target_occurrence_id, 'failed'
  );
end;
$$;

create or replace function public.update_personal_recurring_occurrence(
  target_occurrence_id uuid,
  expected_version integer,
  override_amount_minor bigint,
  override_currency text,
  override_account_id uuid,
  override_occurred_on date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  occurrence_row public.personal_recurring_occurrences%rowtype;
begin
  select * into occurrence_row
  from public.personal_recurring_occurrences
  where id = target_occurrence_id and owner_participant_id = actor
  for update;
  if occurrence_row.id is null then
    raise exception using message = 'personal_recurring_occurrence_not_found', errcode = 'P0001';
  end if;
  if occurrence_row.status not in ('pending_review', 'failed') then
    raise exception using message = 'personal_recurring_occurrence_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> occurrence_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if override_amount_minor is not null and (
    override_amount_minor <= 0 or override_amount_minor > 9007199254740991
  ) then
    raise exception using message = 'invalid_amount', errcode = 'P0001';
  end if;
  if override_currency is not null
     and pg_catalog.upper(override_currency) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;

  update public.personal_recurring_occurrences
  set effective_amount_minor = override_amount_minor,
      effective_currency = case when override_currency is null
        then null else pg_catalog.upper(override_currency) end,
      effective_account_id = override_account_id,
      effective_occurred_on = override_occurred_on,
      status = 'pending_review', error_code = null,
      version = version + 1
  where id = occurrence_row.id
  returning * into occurrence_row;

  return pg_catalog.jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', occurrence_row.status,
    'version', occurrence_row.version
  );
end;
$$;

create or replace function public.skip_personal_recurring_occurrence(
  target_rule_id uuid,
  scheduled_date date,
  expected_rule_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  rule_row public.personal_recurring_rules%rowtype;
  occurrence_row public.personal_recurring_occurrences%rowtype;
  next_date date;
begin
  select * into rule_row
  from public.personal_recurring_rules
  where id = target_rule_id and owner_participant_id = actor
  for update;
  if rule_row.id is null then
    raise exception using message = 'personal_recurring_rule_not_found', errcode = 'P0001';
  end if;

  select * into occurrence_row
  from public.personal_recurring_occurrences
  where rule_id = rule_row.id and scheduled_for = scheduled_date
  for update;

  if occurrence_row.id is null then
    if expected_rule_version is null or expected_rule_version <> rule_row.version then
      raise exception using message = 'version_conflict', errcode = 'P0001';
    end if;
    if scheduled_date <> rule_row.next_due_on then
      raise exception using message = 'recurring_skip_must_target_next_due', errcode = 'P0001';
    end if;
    insert into public.personal_recurring_occurrences(
      rule_id, owner_participant_id, scheduled_for,
      expense_request_id, funding_request_id, status, skipped_at
    ) values (
      rule_row.id, actor, scheduled_date,
      private.personal_recurring_request_id(rule_row.id, scheduled_date, 'expense'),
      private.personal_recurring_request_id(rule_row.id, scheduled_date, 'funding'),
      'skipped', pg_catalog.now()
    ) returning * into occurrence_row;

    next_date := private.next_personal_recurring_date(
      scheduled_date, rule_row.cadence,
      rule_row.anchor_day_of_month, rule_row.anchor_weekday
    );
    update public.personal_recurring_rules
    set next_due_on = next_date, version = version + 1
    where id = rule_row.id;
  elsif occurrence_row.status = 'skipped' then
    null;
  elsif occurrence_row.status in ('pending_review', 'failed') then
    update public.personal_recurring_occurrences
    set status = 'skipped', error_code = null,
        effective_amount_minor = null, effective_currency = null,
        effective_account_id = null, effective_occurred_on = null,
        skipped_at = pg_catalog.now(), version = version + 1
    where id = occurrence_row.id
    returning * into occurrence_row;
  else
    raise exception using message = 'personal_recurring_occurrence_state_conflict', errcode = 'P0001';
  end if;

  return pg_catalog.jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', occurrence_row.status,
    'scheduled_for', occurrence_row.scheduled_for
  );
end;
$$;

create or replace function public.cancel_pending_funding(
  request_id uuid,
  target_funding_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  intent_row public.personal_funding_intents%rowtype;
  fingerprint text;
  prior_event public.personal_account_events%rowtype;
  result_payload jsonb;
begin
  if request_id is null or target_funding_intent_id is null then
    raise exception using message = 'invalid_funding_cancellation', errcode = 'P0001';
  end if;
  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'funding_intent_id', target_funding_intent_id,
    'action', 'cancel_pending'
  ));

  select * into prior_event from public.personal_account_events
  where owner_participant_id = actor
    and event_type = 'funding.cancelled'
    and client_request_id = request_id;
  if prior_event.id is not null then
    if prior_event.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return prior_event.safe_diff;
  end if;

  select * into intent_row from public.personal_funding_intents
  where id = target_funding_intent_id and owner_participant_id = actor
  for update;
  if intent_row.id is null then
    raise exception using message = 'funding_intent_not_found', errcode = 'P0001';
  end if;
  if intent_row.status <> 'pending' then
    raise exception using message = 'funding_not_pending', errcode = 'P0001';
  end if;

  update public.personal_funding_intents
  set status = 'cancelled', cancelled_at = pg_catalog.now(), version = version + 1
  where id = intent_row.id
  returning * into intent_row;

  result_payload := pg_catalog.jsonb_build_object(
    'funding_intent_id', intent_row.id,
    'funding_status', intent_row.status
  );
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, funding_intent_id, event_type, safe_diff
  ) values (
    actor, request_id, fingerprint,
    intent_row.account_id, intent_row.id, 'funding.cancelled', result_payload
  );
  return result_payload;
end;
$$;

create or replace function public.reverse_personal_recurring_occurrence(
  request_id uuid,
  target_occurrence_id uuid,
  expected_version integer,
  reversal_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  occurrence_row public.personal_recurring_occurrences%rowtype;
  expense_row public.expenses%rowtype;
  funding_row public.personal_funding_intents%rowtype;
  funding_cancel_request uuid;
begin
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  select * into occurrence_row
  from public.personal_recurring_occurrences
  where id = target_occurrence_id and owner_participant_id = actor
  for update;
  if occurrence_row.id is null then
    raise exception using message = 'personal_recurring_occurrence_not_found', errcode = 'P0001';
  end if;
  if occurrence_row.status = 'reversed' then
    return pg_catalog.jsonb_build_object(
      'occurrence_id', occurrence_row.id,
      'status', occurrence_row.status,
      'version', occurrence_row.version
    );
  end if;
  if occurrence_row.status <> 'posted' then
    raise exception using message = 'personal_recurring_occurrence_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> occurrence_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  select * into expense_row from public.expenses
  where id = occurrence_row.expense_id for update;
  perform public.cancel_expense(
    expense_row.id, expense_row.version, reversal_reason
  );

  select * into funding_row from public.personal_funding_intents
  where id = occurrence_row.funding_intent_id for update;
  if funding_row.status = 'posted' then
    perform public.reverse_personal_account_transaction(
      request_id, funding_row.posted_transaction_id,
      current_date, reversal_reason
    );
  elsif funding_row.status = 'pending' then
    funding_cancel_request := private.personal_recurring_request_id(
      occurrence_row.rule_id, occurrence_row.scheduled_for, 'cancel-funding'
    );
    perform public.cancel_pending_funding(
      funding_cancel_request, funding_row.id
    );
  else
    raise exception using message = 'funding_state_conflict', errcode = 'P0001';
  end if;

  update public.personal_recurring_occurrences
  set status = 'reversed', reversed_at = pg_catalog.now(), version = version + 1
  where id = occurrence_row.id
  returning * into occurrence_row;

  return pg_catalog.jsonb_build_object(
    'occurrence_id', occurrence_row.id,
    'status', occurrence_row.status,
    'version', occurrence_row.version
  );
end;
$$;

revoke all on function private.personal_recurring_request_id(uuid, date, text) from public, anon, authenticated;
revoke all on function private.first_personal_recurring_date(date, text, integer, integer) from public, anon, authenticated;
revoke all on function private.next_personal_recurring_date(date, text, integer, integer) from public, anon, authenticated;
revoke all on function private.personal_recurring_error_code(text) from public, anon, authenticated;
revoke all on function private.validate_personal_recurring_rule() from public, anon, authenticated;
revoke all on function private.validate_personal_recurring_occurrence() from public, anon, authenticated;
revoke all on function private.post_personal_recurring_occurrence_for(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.personal_recurring_due_count(uuid, date) from public, anon, authenticated;
revoke all on function private.catch_up_personal_recurring_for(uuid, date) from public, anon, authenticated;

revoke all on function public.create_personal_recurring_rule(uuid, text, text, bigint, text, text, uuid, text, integer, integer, text, time without time zone, date, date, text) from public, anon, authenticated;
revoke all on function public.update_personal_recurring_rule(uuid, integer, text, text, bigint, text, text, uuid, text, integer, integer, text, time without time zone, date, date, text) from public, anon, authenticated;
revoke all on function public.set_personal_recurring_paused(uuid, boolean, integer) from public, anon, authenticated;
revoke all on function public.catch_up_personal_recurring() from public, anon, authenticated;
revoke all on function public.post_personal_recurring_occurrence(uuid) from public, anon, authenticated;
revoke all on function public.retry_personal_recurring_occurrence(uuid) from public, anon, authenticated;
revoke all on function public.update_personal_recurring_occurrence(uuid, integer, bigint, text, uuid, date) from public, anon, authenticated;
revoke all on function public.skip_personal_recurring_occurrence(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.cancel_pending_funding(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reverse_personal_recurring_occurrence(uuid, uuid, integer, text) from public, anon, authenticated;

grant execute on function public.create_personal_recurring_rule(uuid, text, text, bigint, text, text, uuid, text, integer, integer, text, time without time zone, date, date, text) to authenticated;
grant execute on function public.update_personal_recurring_rule(uuid, integer, text, text, bigint, text, text, uuid, text, integer, integer, text, time without time zone, date, date, text) to authenticated;
grant execute on function public.set_personal_recurring_paused(uuid, boolean, integer) to authenticated;
grant execute on function public.catch_up_personal_recurring() to authenticated;
grant execute on function public.post_personal_recurring_occurrence(uuid) to authenticated;
grant execute on function public.retry_personal_recurring_occurrence(uuid) to authenticated;
grant execute on function public.update_personal_recurring_occurrence(uuid, integer, bigint, text, uuid, date) to authenticated;
grant execute on function public.skip_personal_recurring_occurrence(uuid, date, integer) to authenticated;
grant execute on function public.cancel_pending_funding(uuid, uuid) to authenticated;
grant execute on function public.reverse_personal_recurring_occurrence(uuid, uuid, integer, text) to authenticated;

comment on table public.personal_recurring_rules is 'Typed owner-only recurring expense rules; separate from review-only recurring drafts.';
comment on table public.personal_recurring_occurrences is 'Idempotent owner-only scheduled occurrences with immutable posted snapshots.';
comment on function public.catch_up_personal_recurring() is 'Posts at most 24 due owner occurrences using server-local rule dates and times.';
