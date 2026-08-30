-- Provider-facing capture entitlements. Financial records never depend on plan status.

create table if not exists public.capture_entitlements (
  participant_id uuid primary key references public.participants(id) on delete cascade,
  plan text not null default 'trial' check (plan in ('free', 'trial', 'pro')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  trial_ends_at timestamptz,
  capture_quota_monthly integer not null default 100 check (capture_quota_monthly between 0 and 10000),
  ocr_quota_monthly integer not null default 20 check (ocr_quota_monthly between 0 and 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.capture_usage (
  participant_id uuid not null references public.participants(id) on delete cascade,
  period_month date not null,
  source text not null check (source in ('natural_language', 'voice', 'ocr')),
  usage_count integer not null default 0
    constraint capture_usage_usage_count_check check (usage_count between 0 and 10000),
  provider_cost_micros bigint not null default 0
    constraint capture_usage_provider_cost_micros_check
      check (provider_cost_micros between 0 and 9007199254740991),
  updated_at timestamptz not null default now(),
  primary key (participant_id, period_month, source),
  check (period_month = pg_catalog.date_trunc('month', period_month)::date)
);

alter table public.capture_usage
  drop constraint if exists capture_usage_usage_count_check;
alter table public.capture_usage
  add constraint capture_usage_usage_count_check
  check (usage_count between 0 and 10000);
alter table public.capture_usage
  drop constraint if exists capture_usage_provider_cost_micros_check;
alter table public.capture_usage
  add constraint capture_usage_provider_cost_micros_check
  check (provider_cost_micros between 0 and 9007199254740991);

-- Kept in the non-exposed private schema. The bounded upsert in
-- consume_capture_quota serializes concurrent calls for the same minute.
create table if not exists private.capture_rate_limits (
  participant_id uuid not null references public.participants(id) on delete cascade,
  period_minute timestamptz not null,
  request_count integer not null
    constraint capture_rate_limits_request_count_check
      check (request_count between 1 and 10),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (participant_id, period_minute),
  check (
    period_minute = pg_catalog.date_trunc('minute', period_minute)
  )
);

alter table public.capture_entitlements enable row level security;
alter table public.capture_usage enable row level security;

revoke all on table public.capture_entitlements from public, anon, authenticated;
revoke all on table public.capture_usage from public, anon, authenticated;
revoke all on table private.capture_rate_limits from public, anon, authenticated;
grant select on table public.capture_entitlements to authenticated;
grant select on table public.capture_usage to authenticated;

drop policy if exists capture_entitlements_select_own on public.capture_entitlements;
create policy capture_entitlements_select_own
  on public.capture_entitlements for select to authenticated
  using (participant_id = public.current_participant_id());

drop policy if exists capture_usage_select_own on public.capture_usage;
create policy capture_usage_select_own
  on public.capture_usage for select to authenticated
  using (participant_id = public.current_participant_id());

create or replace function public.ensure_capture_entitlement()
returns public.capture_entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  entitlement public.capture_entitlements%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  insert into public.capture_entitlements(participant_id, plan, status, trial_ends_at)
  values (actor, 'trial', 'active', now() + interval '30 days')
  on conflict (participant_id) do nothing;

  select * into entitlement
  from public.capture_entitlements
  where participant_id = actor;

  return entitlement;
end;
$$;

drop function if exists public.consume_capture_quota(text);
drop function if exists public.consume_capture_quota(text, bigint);
create function public.consume_capture_quota(
  capture_source text,
  provider_cost_micros bigint default 0
)
returns table(
  plan text,
  usage_count integer,
  quota integer,
  period_month date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  entitlement public.capture_entitlements%rowtype;
  month_start date := pg_catalog.date_trunc('month', current_date)::date;
  minute_start timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now());
  next_usage integer;
  minute_usage integer;
  allowed_quota integer;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;
  if capture_source is null
     or capture_source not in ('natural_language', 'voice', 'ocr') then
    raise exception using message = 'invalid_capture_source', errcode = 'P0001';
  end if;
  if provider_cost_micros is null
     or provider_cost_micros < 0
     or provider_cost_micros > 9007199254740991 then
    raise exception using message = 'invalid_provider_cost', errcode = 'P0001';
  end if;

  select * into entitlement from public.ensure_capture_entitlement();
  if entitlement.status <> 'active'
     or entitlement.plan = 'free'
     or (
       entitlement.plan = 'trial'
       and (
         entitlement.trial_ends_at is null
         or entitlement.trial_ends_at <= pg_catalog.now()
       )
     ) then
    raise exception using message = 'pro_required', errcode = 'P0001';
  end if;

  allowed_quota := case
    when capture_source = 'ocr' then entitlement.ocr_quota_monthly
    else entitlement.capture_quota_monthly
  end;

  if allowed_quota <= 0 then
    raise exception using message = 'capture_quota_exceeded', errcode = 'P0001';
  end if;

  insert into private.capture_rate_limits(
    participant_id,
    period_minute,
    request_count
  )
  values (actor, minute_start, 1)
  on conflict on constraint capture_rate_limits_pkey
  do update set
    request_count = private.capture_rate_limits.request_count + 1,
    updated_at = pg_catalog.now()
  where private.capture_rate_limits.request_count < 10
  returning private.capture_rate_limits.request_count into minute_usage;

  if minute_usage is null then
    raise exception using message = 'capture_rate_limit_exceeded', errcode = 'P0001';
  end if;

  insert into public.capture_usage(
    participant_id,
    period_month,
    source,
    usage_count,
    provider_cost_micros
  )
  values (
    actor,
    month_start,
    capture_source,
    1,
    consume_capture_quota.provider_cost_micros
  )
  on conflict on constraint capture_usage_pkey
  do update set
    usage_count = public.capture_usage.usage_count + 1,
    provider_cost_micros = public.capture_usage.provider_cost_micros
      + consume_capture_quota.provider_cost_micros,
    updated_at = pg_catalog.now()
  where public.capture_usage.usage_count < allowed_quota
    and public.capture_usage.provider_cost_micros
      <= 9007199254740991 - consume_capture_quota.provider_cost_micros
  returning public.capture_usage.usage_count into next_usage;

  if next_usage is null then
    if exists (
      select 1
      from public.capture_usage as usage
      where usage.participant_id = actor
        and usage.period_month = month_start
        and usage.source = capture_source
        and usage.usage_count >= allowed_quota
    ) then
      raise exception using message = 'capture_quota_exceeded', errcode = 'P0001';
    end if;
    raise exception using message = 'provider_cost_limit_exceeded', errcode = 'P0001';
  end if;

  return query select entitlement.plan, next_usage, allowed_quota, month_start;
end;
$$;

revoke all on function public.ensure_capture_entitlement() from public;
revoke all on function public.ensure_capture_entitlement() from anon;
revoke all on function public.consume_capture_quota(text, bigint) from public;
revoke all on function public.consume_capture_quota(text, bigint) from anon;
grant execute on function public.ensure_capture_entitlement() to authenticated;
grant execute on function public.consume_capture_quota(text, bigint) to authenticated;
