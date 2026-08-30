-- Make provider-backed capture available to every active permanent account.
-- This is forward-only: historical migrations remain unchanged.

alter table public.capture_entitlements
  alter column plan set default 'free';

-- During the beta, trials did not represent paid access. Preserve status and
-- quota customizations while moving those rows to the free plan.
update public.capture_entitlements
set
  plan = 'free',
  trial_ends_at = null,
  updated_at = pg_catalog.now()
where plan = 'trial';

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
    raise exception using message = 'permanent_account_required', errcode = 'P0001';
  end if;

  insert into public.capture_entitlements(
    participant_id,
    plan,
    status,
    trial_ends_at,
    capture_quota_monthly,
    ocr_quota_monthly
  )
  values (actor, 'free', 'active', null, 100, 20)
  on conflict (participant_id) do nothing;

  select * into entitlement
  from public.capture_entitlements
  where participant_id = actor;

  return entitlement;
end;
$$;

create or replace function public.consume_capture_quota(
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
  if entitlement.status <> 'active' then
    raise exception using message = 'capture_entitlement_inactive', errcode = 'P0001';
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
