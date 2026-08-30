-- Capture templates and recurring-draft commands.
-- Templates never persist an amount. Recurrence materializes pending drafts
-- only; accepting a draft does not create an expense.

create or replace function public.jsonb_contains_amount_key(target jsonb)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  item record;
  normalized_key text;
begin
  if pg_catalog.jsonb_typeof(target) = 'object' then
    for item in
      select entry.key, entry.value
      from pg_catalog.jsonb_each(target) as entry
    loop
      normalized_key := pg_catalog.lower(
        pg_catalog.replace(pg_catalog.replace(item.key, '_', ''), '-', '')
      );
      if normalized_key in (
        'amount',
        'amountminor',
        'totalamount',
        'totalamountminor',
        'totalminor'
      ) then
        return true;
      end if;
      if public.jsonb_contains_amount_key(item.value) then
        return true;
      end if;
    end loop;
  elsif pg_catalog.jsonb_typeof(target) = 'array' then
    for item in
      select element.value
      from pg_catalog.jsonb_array_elements(target) as element(value)
    loop
      if public.jsonb_contains_amount_key(item.value) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

create or replace function public.next_recurring_local_date(
  scheduled_for date,
  cadence text,
  anchor_day integer
)
returns date
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  target_month date;
  target_month_last_day integer;
begin
  if cadence = 'weekly' then
    return scheduled_for + 7;
  end if;
  if cadence <> 'monthly' or anchor_day not between 1 and 31 then
    raise exception using message = 'invalid_recurring_cadence', errcode = 'P0001';
  end if;

  target_month := (
    pg_catalog.date_trunc('month', scheduled_for::timestamp)
    + interval '1 month'
  )::date;
  target_month_last_day := extract(
    day from target_month + interval '1 month - 1 day'
  )::integer;

  return pg_catalog.make_date(
    extract(year from target_month)::integer,
    extract(month from target_month)::integer,
    least(anchor_day, target_month_last_day)
  );
end;
$$;

create table if not exists public.capture_templates (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  scope text check (scope in ('personal', 'direct', 'space')),
  space_id uuid references public.spaces(id) on delete cascade,
  label text not null check (pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 100),
  description text,
  category text,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  participant_defaults jsonb not null default '[]'::jsonb,
  payer_defaults jsonb not null default '[]'::jsonb,
  share_defaults jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (
    (scope = 'space' and space_id is not null)
    or (scope is distinct from 'space' and space_id is null)
  ),
  check (pg_catalog.jsonb_typeof(participant_defaults) = 'array'),
  check (pg_catalog.jsonb_typeof(payer_defaults) = 'array'),
  check (pg_catalog.jsonb_typeof(share_defaults) = 'object'),
  check (
    not public.jsonb_contains_amount_key(participant_defaults)
    and not public.jsonb_contains_amount_key(payer_defaults)
    and not public.jsonb_contains_amount_key(share_defaults)
  )
);

create table if not exists public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  capture_template_id uuid references public.capture_templates(id) on delete set null,
  default_draft_fields jsonb not null default '{}'::jsonb,
  cadence text not null check (cadence in ('weekly', 'monthly')),
  local_time time without time zone not null,
  timezone text not null check (pg_catalog.char_length(pg_catalog.btrim(timezone)) between 1 and 100),
  next_due_on date not null,
  anchor_day integer not null check (anchor_day between 1 and 31),
  end_on date,
  active boolean not null default true,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  check (pg_catalog.jsonb_typeof(default_draft_fields) = 'object'),
  check (not public.jsonb_contains_amount_key(default_draft_fields))
);

create table if not exists public.recurring_drafts (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.recurring_rules(id) on delete cascade,
  owner_participant_id uuid not null references public.participants(id),
  scheduled_for date not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  responded_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (rule_id, scheduled_for),
  check (pg_catalog.jsonb_typeof(payload) = 'object'),
  check (
    (status = 'pending' and responded_at is null)
    or (status in ('accepted', 'dismissed') and responded_at is not null)
  )
);

create index if not exists capture_templates_owner_active_idx
  on public.capture_templates(owner_participant_id, active, updated_at desc);
create index if not exists capture_templates_space_active_idx
  on public.capture_templates(space_id, updated_at desc)
  where active and scope = 'space';
create index if not exists recurring_rules_owner_due_idx
  on public.recurring_rules(owner_participant_id, next_due_on)
  where active;
create index if not exists recurring_drafts_owner_status_due_idx
  on public.recurring_drafts(owner_participant_id, status, scheduled_for);
create index if not exists recurring_drafts_rule_status_idx
  on public.recurring_drafts(rule_id, status, scheduled_for);

drop trigger if exists capture_templates_set_updated_at on public.capture_templates;
create trigger capture_templates_set_updated_at
  before update on public.capture_templates
  for each row execute function public.set_updated_at();

drop trigger if exists recurring_rules_set_updated_at on public.recurring_rules;
create trigger recurring_rules_set_updated_at
  before update on public.recurring_rules
  for each row execute function public.set_updated_at();

drop trigger if exists recurring_drafts_set_updated_at on public.recurring_drafts;
create trigger recurring_drafts_set_updated_at
  before update on public.recurring_drafts
  for each row execute function public.set_updated_at();

alter table public.capture_templates enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.recurring_drafts enable row level security;

drop policy if exists capture_templates_select_visible on public.capture_templates;
create policy capture_templates_select_visible
  on public.capture_templates for select to authenticated
  using (
    owner_participant_id = public.current_participant_id()
    or (
      active
      and scope = 'space'
      and private.is_active_space_member(space_id, public.current_participant_id())
    )
  );

drop policy if exists recurring_rules_select_own on public.recurring_rules;
create policy recurring_rules_select_own
  on public.recurring_rules for select to authenticated
  using (owner_participant_id = public.current_participant_id());

drop policy if exists recurring_drafts_select_own on public.recurring_drafts;
create policy recurring_drafts_select_own
  on public.recurring_drafts for select to authenticated
  using (owner_participant_id = public.current_participant_id());

create or replace function public.create_capture_template(
  p_scope text,
  p_space_id uuid,
  p_label text,
  p_description text default null,
  p_category text default null,
  p_currency text default null,
  p_participant_defaults jsonb default '[]'::jsonb,
  p_payer_defaults jsonb default '[]'::jsonb,
  p_share_defaults jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  new_template_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if p_scope is not null and p_scope not in ('personal', 'direct', 'space') then
    raise exception using message = 'invalid_template_scope', errcode = 'P0001';
  end if;
  if (p_scope = 'space' and p_space_id is null)
     or (p_scope is distinct from 'space' and p_space_id is not null) then
    raise exception using message = 'invalid_template_space', errcode = 'P0001';
  end if;
  if p_label is null
     or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 100 then
    raise exception using message = 'invalid_template_label', errcode = 'P0001';
  end if;
  if p_currency is not null and pg_catalog.upper(p_currency) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;
  if p_participant_defaults is null
     or pg_catalog.jsonb_typeof(p_participant_defaults) <> 'array'
     or p_payer_defaults is null
     or pg_catalog.jsonb_typeof(p_payer_defaults) <> 'array'
     or p_share_defaults is null
     or pg_catalog.jsonb_typeof(p_share_defaults) <> 'object' then
    raise exception using message = 'invalid_template_defaults', errcode = 'P0001';
  end if;
  if public.jsonb_contains_amount_key(p_participant_defaults)
     or public.jsonb_contains_amount_key(p_payer_defaults)
     or public.jsonb_contains_amount_key(p_share_defaults) then
    raise exception using message = 'template_amount_not_allowed', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_participant_defaults) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or (item.value #>> '{}') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payer_defaults) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or (item.value #>> '{}') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) then
    raise exception using message = 'invalid_template_participant', errcode = 'P0001';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
  ) <> (
    select pg_catalog.count(distinct item.value)
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
  ) or (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements_text(p_payer_defaults) as item(value)
  ) <> (
    select pg_catalog.count(distinct item.value)
    from pg_catalog.jsonb_array_elements_text(p_payer_defaults) as item(value)
  ) then
    raise exception using message = 'duplicate_template_participant', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payer_defaults) as payer(value)
    where not p_participant_defaults @> pg_catalog.jsonb_build_array(payer.value)
  ) then
    raise exception using message = 'template_payer_not_participant', errcode = 'P0001';
  end if;
  if p_scope is null and (
    pg_catalog.jsonb_array_length(p_participant_defaults) > 0
    or pg_catalog.jsonb_array_length(p_payer_defaults) > 0
  ) then
    raise exception using message = 'unscoped_template_has_participants', errcode = 'P0001';
  end if;

  if p_scope = 'space'
     and coalesce(private.space_role(p_space_id, actor), '')
       not in ('owner', 'full_access') then
    raise exception using message = 'space_write_denied', errcode = 'P0001';
  end if;
  if p_scope = 'personal' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(
      p_participant_defaults || p_payer_defaults
    ) as item(value)
    where item.value::uuid <> actor
  ) then
    raise exception using message = 'invalid_personal_template', errcode = 'P0001';
  end if;
  if p_scope = 'direct' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
    where not exists (
      select 1
      from public.participants as participant
      where participant.id = item.value::uuid
        and (
          participant.id = actor
          or (
            participant.kind = 'account'
            and private.are_friends(actor, participant.id)
          )
          or (
            participant.kind = 'manual'
            and participant.created_by = (select auth.uid())
          )
        )
    )
  ) then
    raise exception using message = 'direct_template_participant_denied', errcode = 'P0001';
  end if;
  if p_scope = 'space' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
    where not private.is_active_space_member(p_space_id, item.value::uuid)
  ) then
    raise exception using message = 'space_template_participant_denied', errcode = 'P0001';
  end if;

  insert into public.capture_templates(
    owner_participant_id,
    scope,
    space_id,
    label,
    description,
    category,
    currency,
    participant_defaults,
    payer_defaults,
    share_defaults
  )
  values (
    actor,
    p_scope,
    p_space_id,
    pg_catalog.btrim(p_label),
    nullif(pg_catalog.btrim(p_description), ''),
    nullif(pg_catalog.btrim(p_category), ''),
    case when p_currency is null then null else pg_catalog.upper(p_currency) end,
    p_participant_defaults,
    p_payer_defaults,
    p_share_defaults
  )
  returning id into new_template_id;

  return new_template_id;
end;
$$;

create or replace function public.update_capture_template(
  p_template_id uuid,
  p_scope text,
  p_space_id uuid,
  p_label text,
  p_description text default null,
  p_category text default null,
  p_currency text default null,
  p_participant_defaults jsonb default '[]'::jsonb,
  p_payer_defaults jsonb default '[]'::jsonb,
  p_share_defaults jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  template_row public.capture_templates%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;

  select *
  into template_row
  from public.capture_templates as template
  where template.id = p_template_id
  for update;

  if template_row.id is null then
    raise exception using message = 'capture_template_not_found', errcode = 'P0001';
  end if;
  if template_row.owner_participant_id <> actor then
    raise exception using message = 'capture_template_write_denied', errcode = 'P0001';
  end if;
  if not template_row.active then
    raise exception using message = 'capture_template_archived', errcode = 'P0001';
  end if;
  if p_scope is not null and p_scope not in ('personal', 'direct', 'space') then
    raise exception using message = 'invalid_template_scope', errcode = 'P0001';
  end if;
  if (p_scope = 'space' and p_space_id is null)
     or (p_scope is distinct from 'space' and p_space_id is not null) then
    raise exception using message = 'invalid_template_space', errcode = 'P0001';
  end if;
  if p_label is null
     or pg_catalog.char_length(pg_catalog.btrim(p_label)) not between 1 and 100 then
    raise exception using message = 'invalid_template_label', errcode = 'P0001';
  end if;
  if p_currency is not null and pg_catalog.upper(p_currency) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;
  if p_participant_defaults is null
     or pg_catalog.jsonb_typeof(p_participant_defaults) <> 'array'
     or p_payer_defaults is null
     or pg_catalog.jsonb_typeof(p_payer_defaults) <> 'array'
     or p_share_defaults is null
     or pg_catalog.jsonb_typeof(p_share_defaults) <> 'object' then
    raise exception using message = 'invalid_template_defaults', errcode = 'P0001';
  end if;
  if public.jsonb_contains_amount_key(p_participant_defaults)
     or public.jsonb_contains_amount_key(p_payer_defaults)
     or public.jsonb_contains_amount_key(p_share_defaults) then
    raise exception using message = 'template_amount_not_allowed', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_participant_defaults) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or (item.value #>> '{}') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payer_defaults) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
      or (item.value #>> '{}') !~
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  ) then
    raise exception using message = 'invalid_template_participant', errcode = 'P0001';
  end if;
  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
  ) <> (
    select pg_catalog.count(distinct item.value)
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
  ) or (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements_text(p_payer_defaults) as item(value)
  ) <> (
    select pg_catalog.count(distinct item.value)
    from pg_catalog.jsonb_array_elements_text(p_payer_defaults) as item(value)
  ) then
    raise exception using message = 'duplicate_template_participant', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_payer_defaults) as payer(value)
    where not p_participant_defaults @> pg_catalog.jsonb_build_array(payer.value)
  ) then
    raise exception using message = 'template_payer_not_participant', errcode = 'P0001';
  end if;
  if p_scope is null and (
    pg_catalog.jsonb_array_length(p_participant_defaults) > 0
    or pg_catalog.jsonb_array_length(p_payer_defaults) > 0
  ) then
    raise exception using message = 'unscoped_template_has_participants', errcode = 'P0001';
  end if;

  if p_scope = 'space'
     and coalesce(private.space_role(p_space_id, actor), '')
       not in ('owner', 'full_access') then
    raise exception using message = 'space_write_denied', errcode = 'P0001';
  end if;
  if p_scope = 'personal' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(
      p_participant_defaults || p_payer_defaults
    ) as item(value)
    where item.value::uuid <> actor
  ) then
    raise exception using message = 'invalid_personal_template', errcode = 'P0001';
  end if;
  if p_scope = 'direct' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
    where not exists (
      select 1
      from public.participants as participant
      where participant.id = item.value::uuid
        and (
          participant.id = actor
          or (
            participant.kind = 'account'
            and private.are_friends(actor, participant.id)
          )
          or (
            participant.kind = 'manual'
            and participant.created_by = (select auth.uid())
          )
        )
    )
  ) then
    raise exception using message = 'direct_template_participant_denied', errcode = 'P0001';
  end if;
  if p_scope = 'space' and exists (
    select 1
    from pg_catalog.jsonb_array_elements_text(p_participant_defaults) as item(value)
    where not private.is_active_space_member(p_space_id, item.value::uuid)
  ) then
    raise exception using message = 'space_template_participant_denied', errcode = 'P0001';
  end if;

  update public.capture_templates as template
  set
    scope = p_scope,
    space_id = p_space_id,
    label = pg_catalog.btrim(p_label),
    description = nullif(pg_catalog.btrim(p_description), ''),
    category = nullif(pg_catalog.btrim(p_category), ''),
    currency = case
      when p_currency is null then null
      else pg_catalog.upper(p_currency)
    end,
    participant_defaults = p_participant_defaults,
    payer_defaults = p_payer_defaults,
    share_defaults = p_share_defaults
  where template.id = p_template_id;
end;
$$;

create or replace function public.archive_capture_template(p_template_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;

  update public.capture_templates as template
  set active = false
  where template.id = p_template_id
    and template.owner_participant_id = actor
    and template.active;

  if not found then
    if not exists (
      select 1
      from public.capture_templates as template
      where template.id = p_template_id
    ) then
      raise exception using message = 'capture_template_not_found', errcode = 'P0001';
    end if;
    raise exception using message = 'capture_template_archive_denied', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_recurring_rule(
  p_capture_template_id uuid,
  p_default_draft_fields jsonb,
  p_cadence text,
  p_local_time time without time zone,
  p_timezone text,
  p_next_due_on date,
  p_end_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  new_rule_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if p_capture_template_id is not null and not exists (
    select 1
    from public.capture_templates as template
    where template.id = p_capture_template_id
      and template.owner_participant_id = actor
      and template.active
  ) then
    raise exception using message = 'capture_template_unavailable', errcode = 'P0001';
  end if;
  if p_default_draft_fields is null
     or pg_catalog.jsonb_typeof(p_default_draft_fields) <> 'object' then
    raise exception using message = 'invalid_recurring_draft_fields', errcode = 'P0001';
  end if;
  if p_cadence is null or p_cadence not in ('weekly', 'monthly') then
    raise exception using message = 'invalid_recurring_cadence', errcode = 'P0001';
  end if;
  if p_local_time is null or p_timezone is null or not exists (
    select 1
    from pg_catalog.pg_timezone_names as zone
    where zone.name = pg_catalog.btrim(p_timezone)
  ) then
    raise exception using message = 'invalid_recurring_local_time', errcode = 'P0001';
  end if;
  if p_next_due_on is null then
    raise exception using message = 'invalid_recurring_due_date', errcode = 'P0001';
  end if;
  if p_end_on is not null and p_end_on < p_next_due_on then
    raise exception using message = 'invalid_recurring_end_date', errcode = 'P0001';
  end if;

  insert into public.recurring_rules(
    owner_participant_id,
    capture_template_id,
    default_draft_fields,
    cadence,
    local_time,
    timezone,
    next_due_on,
    anchor_day,
    end_on
  )
  values (
    actor,
    p_capture_template_id,
    p_default_draft_fields,
    p_cadence,
    p_local_time,
    pg_catalog.btrim(p_timezone),
    p_next_due_on,
    extract(day from p_next_due_on)::integer,
    p_end_on
  )
  returning id into new_rule_id;

  return new_rule_id;
end;
$$;

create or replace function public.pause_recurring_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;

  update public.recurring_rules as rule
  set active = false
  where rule.id = p_rule_id
    and rule.owner_participant_id = actor
    and rule.active;

  if not found then
    if not exists (
      select 1 from public.recurring_rules as rule where rule.id = p_rule_id
    ) then
      raise exception using message = 'recurring_rule_not_found', errcode = 'P0001';
    end if;
    raise exception using message = 'recurring_rule_pause_denied', errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.generate_due_recurring_drafts(
  p_due_through date default current_date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  rule_row public.recurring_rules%rowtype;
  template_row public.capture_templates%rowtype;
  scheduled_date date;
  template_payload jsonb;
  draft_payload jsonb;
  inserted_count integer := 0;
  inserted_rows integer;
  visited_count integer := 0;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if p_due_through is null then
    raise exception using message = 'invalid_recurring_due_date', errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('recurring-drafts:' || actor::text, 0)
  );

  for rule_row in
    select rule.*
    from public.recurring_rules as rule
    where rule.owner_participant_id = actor
      and rule.active
      and rule.next_due_on <= p_due_through
    order by rule.next_due_on, rule.id
    for update
  loop
    scheduled_date := rule_row.next_due_on;
    template_payload := '{}'::jsonb;

    if rule_row.capture_template_id is not null then
      select *
      into template_row
      from public.capture_templates as template
      where template.id = rule_row.capture_template_id
        and template.owner_participant_id = actor;

      if template_row.id is null then
        raise exception using message = 'capture_template_unavailable', errcode = 'P0001';
      end if;

      template_payload := pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'scope', template_row.scope,
          'spaceId', template_row.space_id,
          'description', template_row.description,
          'category', template_row.category,
          'currency', template_row.currency,
          'participantIds', template_row.participant_defaults,
          'payerParticipantIds', template_row.payer_defaults,
          'shareDefaults', template_row.share_defaults
        )
      );
    end if;

    while scheduled_date <= p_due_through
      and (rule_row.end_on is null or scheduled_date <= rule_row.end_on)
    loop
      visited_count := visited_count + 1;
      if visited_count > 3660 then
        raise exception using
          message = 'recurring_generation_limit_exceeded',
          errcode = 'P0001';
      end if;

      draft_payload := template_payload
        || rule_row.default_draft_fields
        || pg_catalog.jsonb_build_object(
          'kind', 'recurring_draft',
          'ruleId', rule_row.id,
          'scheduledFor', scheduled_date
        );

      insert into public.recurring_drafts(
        rule_id,
        owner_participant_id,
        scheduled_for,
        status,
        payload
      )
      values (
        rule_row.id,
        actor,
        scheduled_date,
        'pending',
        draft_payload
      )
      on conflict (rule_id, scheduled_for) do nothing;

      get diagnostics inserted_rows = row_count;
      inserted_count := inserted_count + inserted_rows;
      scheduled_date := public.next_recurring_local_date(
        scheduled_date,
        rule_row.cadence,
        rule_row.anchor_day
      );
    end loop;

    update public.recurring_rules as rule
    set
      next_due_on = scheduled_date,
      active = case
        when rule_row.end_on is not null and scheduled_date > rule_row.end_on
          then false
        else rule.active
      end
    where rule.id = rule_row.id;
  end loop;

  return inserted_count;
end;
$$;

create or replace function public.respond_to_recurring_draft(
  p_draft_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  draft_row public.recurring_drafts%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if p_response is null or p_response not in ('accepted', 'dismissed') then
    raise exception using message = 'invalid_recurring_draft_response', errcode = 'P0001';
  end if;

  select *
  into draft_row
  from public.recurring_drafts as draft
  where draft.id = p_draft_id
  for update;

  if draft_row.id is null then
    raise exception using message = 'recurring_draft_not_found', errcode = 'P0001';
  end if;
  if draft_row.owner_participant_id <> actor then
    raise exception using message = 'recurring_draft_write_denied', errcode = 'P0001';
  end if;
  if draft_row.status <> 'pending' then
    raise exception using message = 'recurring_draft_not_pending', errcode = 'P0001';
  end if;

  update public.recurring_drafts as draft
  set status = p_response, responded_at = pg_catalog.now()
  where draft.id = p_draft_id;

  return draft_row.payload;
end;
$$;

revoke all on function public.jsonb_contains_amount_key(jsonb) from public;
revoke all on function public.next_recurring_local_date(date, text, integer) from public;
revoke all on function public.create_capture_template(
  text, uuid, text, text, text, text, jsonb, jsonb, jsonb
) from public;
revoke all on function public.update_capture_template(
  uuid, text, uuid, text, text, text, text, jsonb, jsonb, jsonb
) from public;
revoke all on function public.archive_capture_template(uuid) from public;
revoke all on function public.create_recurring_rule(
  uuid, jsonb, text, time without time zone, text, date, date
) from public;
revoke all on function public.pause_recurring_rule(uuid) from public;
revoke all on function public.generate_due_recurring_drafts(date) from public;
revoke all on function public.respond_to_recurring_draft(uuid, text) from public;

grant execute on function public.create_capture_template(
  text, uuid, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.update_capture_template(
  uuid, text, uuid, text, text, text, text, jsonb, jsonb, jsonb
) to authenticated;
grant execute on function public.archive_capture_template(uuid) to authenticated;
grant execute on function public.create_recurring_rule(
  uuid, jsonb, text, time without time zone, text, date, date
) to authenticated;
grant execute on function public.pause_recurring_rule(uuid) to authenticated;
grant execute on function public.generate_due_recurring_drafts(date) to authenticated;
grant execute on function public.respond_to_recurring_draft(uuid, text) to authenticated;
