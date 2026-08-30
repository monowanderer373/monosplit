-- Private-beta security hardening.
-- This migration is forward-only and is safe to apply after migrations 001-008.

-- Reconcile constraints that CREATE TABLE IF NOT EXISTS could not add to a
-- historical MonoSplit user_profiles table.
update public.user_profiles
set
  lang = case when lang in ('en', 'zh') then lang else 'en' end,
  theme_id = coalesce(nullif(pg_catalog.btrim(theme_id), ''), 'solid-vintage'),
  default_currency = case
    when pg_catalog.upper(default_currency) ~ '^[A-Z]{3}$'
      then pg_catalog.upper(default_currency)
    else 'MYR'
  end,
  timezone = coalesce(nullif(pg_catalog.btrim(timezone), ''), 'Asia/Kuala_Lumpur');

alter table public.user_profiles
  alter column lang set default 'en',
  alter column lang set not null,
  alter column theme_id set default 'solid-vintage',
  alter column theme_id set not null,
  alter column default_currency set default 'MYR',
  alter column default_currency set not null,
  alter column timezone set default 'Asia/Kuala_Lumpur',
  alter column timezone set not null;

alter table public.user_profiles
  drop constraint if exists user_profiles_lang_check;
alter table public.user_profiles
  add constraint user_profiles_lang_check check (lang in ('en', 'zh'));
alter table public.user_profiles
  drop constraint if exists user_profiles_default_currency_check;
alter table public.user_profiles
  add constraint user_profiles_default_currency_check
  check (default_currency ~ '^[A-Z]{3}$');
alter table public.user_profiles
  drop constraint if exists user_profiles_theme_id_check;
alter table public.user_profiles
  add constraint user_profiles_theme_id_check
  check (pg_catalog.char_length(pg_catalog.btrim(theme_id)) between 1 and 100);
alter table public.user_profiles
  drop constraint if exists user_profiles_timezone_check;
alter table public.user_profiles
  add constraint user_profiles_timezone_check
  check (pg_catalog.char_length(pg_catalog.btrim(timezone)) between 1 and 100);

-- The current trigger creates both a profile and a Participant. Retire the old
-- profile-only auth trigger/function if a historical SQL-editor setup left it.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop trigger if exists user_profiles_updated_at on public.user_profiles;

do $$
begin
  if pg_catalog.to_regprocedure('public.update_updated_at()') is not null
     and not exists (
       select 1
       from pg_catalog.pg_depend as dependency
       join pg_catalog.pg_trigger as trigger_row
         on trigger_row.oid = dependency.objid
       where dependency.refobjid =
         pg_catalog.to_regprocedure('public.update_updated_at()')
         and dependency.classid = 'pg_catalog.pg_trigger'::pg_catalog.regclass
         and not trigger_row.tgisinternal
     ) then
    drop function public.update_updated_at();
  end if;
end
$$;

create or replace function private.is_anonymous_participant(
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(
      nullif(pg_catalog.to_jsonb(auth_user) ->> 'is_anonymous', '')::boolean,
      false
    )
    or coalesce(
      auth_user.raw_app_meta_data ->> 'provider' = 'anonymous',
      false
    )
  from public.participants as participant
  join auth.users as auth_user on auth_user.id = participant.auth_user_id
  where participant.id = target_participant_id;
$$;

-- The invite bug could only create anonymous full-access memberships. Downgrade
-- those rows before enforcing the invariant for all future writes.
update public.space_members as member
set role = 'view'
where member.role = 'full_access'
  and private.is_anonymous_participant(member.participant_id);

do $$
begin
  if exists (
    select 1
    from public.spaces as space
    where private.is_anonymous_participant(space.owner_participant_id)
  ) or exists (
    select 1
    from public.space_members as member
    where member.role = 'owner'
      and private.is_anonymous_participant(member.participant_id)
  ) then
    raise exception using
      message = 'anonymous_space_owner_requires_remediation',
      errcode = 'P0001';
  end if;
end
$$;

create or replace function private.enforce_space_member_role_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in ('owner', 'full_access')
     and private.is_anonymous_participant(new.participant_id) then
    if new.role = 'owner' then
      raise exception using
        message = 'anonymous_space_owner_denied',
        errcode = 'P0001';
    end if;

    raise exception using
      message = 'anonymous_full_access_denied',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_space_member_role_eligibility
  on public.space_members;
create trigger enforce_space_member_role_eligibility
  before insert or update of participant_id, role
  on public.space_members
  for each row
  execute function private.enforce_space_member_role_eligibility();

create or replace function private.enforce_space_owner_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_anonymous_participant(new.owner_participant_id) then
    raise exception using
      message = 'anonymous_space_owner_denied',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_space_owner_eligibility on public.spaces;
create trigger enforce_space_owner_eligibility
  before insert or update of owner_participant_id
  on public.spaces
  for each row
  execute function private.enforce_space_owner_eligibility();

create or replace function private.enforce_permanent_space_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  target_scope text;
begin
  -- Direct operator/migration writes have no JWT. Browser mutations by a
  -- permanent account continue through their command-level authorization.
  if (select auth.uid()) is null or public.is_permanent_account() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'space_members' then
    -- Anonymous accounts may accept or reactivate a view-only invitation.
    if tg_op = 'INSERT'
       and new.participant_id = actor
       and new.role = 'view'
       and new.removed_at is null then
      return new;
    end if;
    if tg_op = 'UPDATE'
       and old.space_id = new.space_id
       and old.participant_id = new.participant_id
       and new.participant_id = actor
       and old.role = 'view'
       and new.role = 'view'
       and new.removed_at is null then
      return new;
    end if;
  elsif tg_table_name = 'space_invites' then
    -- The matching invitation consumption is the second half of the same
    -- view-only acceptance transaction.
    if tg_op = 'UPDATE'
       and old.id = new.id
       and old.role = 'view'
       and new.role = old.role
       and new.space_id = old.space_id
       and new.created_by = old.created_by
       and new.expires_at = old.expires_at
       and new.revoked_at is not distinct from old.revoked_at
       and old.consumed_at is null
       and old.consumed_by is null
       and new.consumed_at is not null
       and new.consumed_by = actor then
      return new;
    end if;
  elsif tg_table_name = 'expenses' then
    target_scope := case when tg_op = 'DELETE' then old.scope else new.scope end;
    if target_scope <> 'space' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  elsif tg_table_name = 'settlement_payments' then
    target_scope := case when tg_op = 'DELETE' then old.scope else new.scope end;
    if target_scope <> 'space' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  elsif tg_table_name = 'settlement_allocations' then
    select payment.scope
    into target_scope
    from public.settlement_payments as payment
    where payment.id = case
      when tg_op = 'DELETE' then old.settlement_payment_id
      else new.settlement_payment_id
    end;

    if target_scope <> 'space' then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  end if;

  raise exception using
    message = 'permanent_account_required',
    errcode = 'P0001';
end;
$$;

drop trigger if exists enforce_permanent_space_mutation on public.spaces;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.spaces
  for each row execute function private.enforce_permanent_space_mutation();

drop trigger if exists enforce_permanent_space_mutation
  on public.space_members;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.space_members
  for each row execute function private.enforce_permanent_space_mutation();

drop trigger if exists enforce_permanent_space_mutation
  on public.space_invites;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.space_invites
  for each row execute function private.enforce_permanent_space_mutation();

drop trigger if exists enforce_permanent_space_mutation on public.expenses;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.expenses
  for each row execute function private.enforce_permanent_space_mutation();

drop trigger if exists enforce_permanent_space_mutation
  on public.settlement_payments;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.settlement_payments
  for each row execute function private.enforce_permanent_space_mutation();

drop trigger if exists enforce_permanent_space_mutation
  on public.settlement_allocations;
create trigger enforce_permanent_space_mutation
  before insert or update or delete on public.settlement_allocations
  for each row execute function private.enforce_permanent_space_mutation();

create or replace function public.accept_space_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  invite_row public.space_invites%rowtype;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  select *
  into invite_row
  from public.space_invites as invite
  where invite.token_digest = extensions.digest(raw_token, 'sha256')
  for update;

  if invite_row.id is null
     or invite_row.revoked_at is not null
     or invite_row.consumed_at is not null
     or invite_row.expires_at <= pg_catalog.now() then
    raise exception using message = 'invite_unavailable', errcode = 'P0001';
  end if;

  if invite_row.role = 'full_access'
     and not public.is_permanent_account() then
    raise exception using
      message = 'anonymous_full_access_invite_denied',
      errcode = 'P0001';
  end if;

  insert into public.space_members(space_id, participant_id, role)
  values (invite_row.space_id, actor, invite_row.role)
  on conflict (space_id, participant_id)
  do update set
    role = case
      when space_members.role = 'owner' then 'owner'
      else excluded.role
    end,
    removed_at = null,
    joined_at = case
      when space_members.role = 'owner' then space_members.joined_at
      else pg_catalog.now()
    end;

  update public.space_invites as invite
  set consumed_at = pg_catalog.now(), consumed_by = actor
  where invite.id = invite_row.id;

  return invite_row.space_id;
end;
$$;

create or replace function public.remove_space_member(
  target_space_id uuid,
  target_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  actor_role text;
  member_row public.space_members%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using
      message = 'permanent_account_required',
      errcode = 'P0001';
  end if;

  actor_role := private.space_role(target_space_id, actor);

  select *
  into member_row
  from public.space_members as member
  where member.space_id = target_space_id
    and member.participant_id = target_participant_id
    and member.removed_at is null
  for update;

  if member_row.participant_id is null then
    raise exception using
      message = 'active_space_member_not_found',
      errcode = 'P0001';
  end if;
  if member_row.role = 'owner' then
    raise exception using
      message = 'active_owner_cannot_be_removed',
      errcode = 'P0001';
  end if;
  if actor_role <> 'owner'
     and not (
       actor = target_participant_id
       and actor_role in ('full_access', 'view')
     ) then
    raise exception using message = 'member_remove_denied', errcode = 'P0001';
  end if;

  update public.space_members as member
  set removed_at = pg_catalog.now()
  where member.space_id = target_space_id
    and member.participant_id = target_participant_id;

  insert into public.financial_events(
    actor_participant_id,
    space_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_space_id,
    'space.member_removed',
    pg_catalog.jsonb_build_object('participant_id', target_participant_id)
  );
end;
$$;

create or replace function public.propose_settlement(
  request_id uuid,
  settlement_scope text,
  target_space_id uuid,
  currency_code text,
  total_amount_minor bigint,
  payment_date date,
  creditor_ids uuid[],
  allocation_amounts bigint[],
  settlement_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  existing_id uuid;
  new_settlement_id uuid;
  creditor_id uuid;
  creditor_kind text;
  allocation_total numeric;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || ':' || request_id::text, 0)
  );

  select payment.id
  into existing_id
  from public.settlement_payments as payment
  where payment.debtor_participant_id = actor
    and payment.client_request_id = request_id;

  if existing_id is not null then
    return existing_id;
  end if;

  if settlement_scope not in ('direct', 'space') then
    raise exception using message = 'invalid_settlement_scope', errcode = 'P0001';
  end if;
  if total_amount_minor is null
     or total_amount_minor <= 0
     or total_amount_minor > 9007199254740991 then
    raise exception using message = 'invalid_amount', errcode = 'P0001';
  end if;
  if currency_code is null
     or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;
  if payment_date is null then
    raise exception using message = 'invalid_payment_date', errcode = 'P0001';
  end if;
  if creditor_ids is null
     or allocation_amounts is null
     or pg_catalog.cardinality(creditor_ids) = 0
     or pg_catalog.cardinality(creditor_ids)
       <> pg_catalog.cardinality(allocation_amounts) then
    raise exception using
      message = 'invalid_allocation_arrays',
      errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(creditor_ids) as creditor(value)
    where creditor.value is null
  ) or exists (
    select 1
    from pg_catalog.unnest(allocation_amounts) as amount(value)
    where amount.value is null
      or amount.value <= 0
      or amount.value > 9007199254740991
  ) then
    raise exception using message = 'invalid_allocation', errcode = 'P0001';
  end if;
  if pg_catalog.cardinality(creditor_ids) <> (
    select pg_catalog.count(distinct creditor.value)
    from pg_catalog.unnest(creditor_ids) as creditor(value)
  ) then
    raise exception using message = 'duplicate_creditor', errcode = 'P0001';
  end if;
  if actor = any(creditor_ids) then
    raise exception using
      message = 'debtor_cannot_be_creditor',
      errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.sum(amount.value), 0)
  into allocation_total
  from pg_catalog.unnest(allocation_amounts) as amount(value);

  if allocation_total <> total_amount_minor then
    raise exception using
      message = 'settlement_does_not_reconcile',
      errcode = 'P0001';
  end if;

  if settlement_scope = 'direct' then
    if target_space_id is not null
       or pg_catalog.cardinality(creditor_ids) <> 1 then
      raise exception using
        message = 'invalid_direct_settlement',
        errcode = 'P0001';
    end if;
    if not exists (
      select 1
      from public.participants as participant
      where participant.id = creditor_ids[1]
        and participant.kind = 'account'
    ) then
      raise exception using
        message = 'direct_creditor_not_account',
        errcode = 'P0001';
    end if;
    if not private.has_friend_history(actor, creditor_ids[1]) then
      raise exception using
        message = 'direct_creditor_not_friend',
        errcode = 'P0001';
    end if;
  else
    if not public.is_permanent_account() then
      raise exception using
        message = 'permanent_account_required',
        errcode = 'P0001';
    end if;
    if target_space_id is null then
      raise exception using message = 'space_required', errcode = 'P0001';
    end if;
    if private.space_role(target_space_id, actor) is null
       or private.space_role(target_space_id, actor)
         not in ('owner', 'full_access') then
      raise exception using message = 'space_write_denied', errcode = 'P0001';
    end if;
    if exists (
      select 1
      from pg_catalog.unnest(creditor_ids) as creditor(value)
      where not exists (
        select 1
        from public.space_members as member
        join public.participants as participant
          on participant.id = member.participant_id
        where member.space_id = target_space_id
          and member.participant_id = creditor.value
          and member.removed_at is null
          and participant.kind in ('account', 'manual')
      )
    ) then
      raise exception using message = 'creditor_not_in_space', errcode = 'P0001';
    end if;
  end if;

  insert into public.settlement_payments(
    client_request_id,
    scope,
    space_id,
    debtor_participant_id,
    currency,
    amount_minor,
    payment_date,
    note
  )
  values (
    request_id,
    settlement_scope,
    target_space_id,
    actor,
    pg_catalog.upper(currency_code),
    total_amount_minor,
    payment_date,
    nullif(pg_catalog.btrim(settlement_note), '')
  )
  returning id into new_settlement_id;

  for item_index in 1..pg_catalog.cardinality(creditor_ids)
  loop
    creditor_id := creditor_ids[item_index];

    select participant.kind
    into creditor_kind
    from public.participants as participant
    where participant.id = creditor_id;

    if creditor_kind is null then
      raise exception using message = 'creditor_not_found', errcode = 'P0001';
    end if;

    insert into public.settlement_allocations(
      settlement_payment_id,
      creditor_participant_id,
      amount_minor,
      state,
      responded_at
    )
    values (
      new_settlement_id,
      creditor_id,
      allocation_amounts[item_index],
      case when creditor_kind = 'manual' then 'accepted' else 'pending' end,
      case when creditor_kind = 'manual' then pg_catalog.now() else null end
    );
  end loop;

  perform public.recompute_settlement_status(new_settlement_id);

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    new_settlement_id,
    'settlement.proposed',
    pg_catalog.jsonb_build_object(
      'scope', settlement_scope,
      'currency', pg_catalog.upper(currency_code),
      'amount_minor', total_amount_minor,
      'allocation_count', pg_catalog.cardinality(creditor_ids)
    )
  );

  return new_settlement_id;
end;
$$;

-- Natural-language and voice capture share one serialized monthly bucket while
-- capture_usage retains one row per source for analytics.
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
  current_usage integer;
  next_usage integer;
  source_usage integer;
  minute_usage integer;
  allowed_quota integer;
  quota_bucket text;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception using
      message = 'permanent_account_required',
      errcode = 'P0001';
  end if;
  if capture_source is null
     or capture_source not in ('natural_language', 'voice', 'ocr') then
    raise exception using
      message = 'invalid_capture_source',
      errcode = 'P0001';
  end if;
  if provider_cost_micros is null
     or provider_cost_micros < 0
     or provider_cost_micros > 9007199254740991 then
    raise exception using
      message = 'invalid_provider_cost',
      errcode = 'P0001';
  end if;

  select * into entitlement from public.ensure_capture_entitlement();
  if entitlement.status <> 'active' then
    raise exception using
      message = 'capture_entitlement_inactive',
      errcode = 'P0001';
  end if;

  allowed_quota := case
    when capture_source = 'ocr' then entitlement.ocr_quota_monthly
    else entitlement.capture_quota_monthly
  end;
  quota_bucket := case
    when capture_source = 'ocr' then 'ocr'
    else 'text_voice'
  end;

  if allowed_quota <= 0 then
    raise exception using
      message = 'capture_quota_exceeded',
      errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      actor::text || ':' || month_start::text || ':' || quota_bucket,
      0
    )
  );

  select coalesce(pg_catalog.sum(usage.usage_count), 0)::integer
  into current_usage
  from public.capture_usage as usage
  where usage.participant_id = actor
    and usage.period_month = month_start
    and (
      (quota_bucket = 'ocr' and usage.source = 'ocr')
      or (
        quota_bucket = 'text_voice'
        and usage.source in ('natural_language', 'voice')
      )
    );

  if current_usage >= allowed_quota then
    raise exception using
      message = 'capture_quota_exceeded',
      errcode = 'P0001';
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
    raise exception using
      message = 'capture_rate_limit_exceeded',
      errcode = 'P0001';
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
  where public.capture_usage.provider_cost_micros
    <= 9007199254740991 - consume_capture_quota.provider_cost_micros
  returning public.capture_usage.usage_count into source_usage;

  if source_usage is null then
    raise exception using
      message = 'provider_cost_limit_exceeded',
      errcode = 'P0001';
  end if;

  next_usage := current_usage + 1;
  return query
  select entitlement.plan, next_usage, allowed_quota, month_start;
end;
$$;

-- Internal mutators are callable only by their owning definer functions.
revoke all on function public.recompute_settlement_status(uuid) from public;
revoke all on function public.recompute_settlement_status(uuid) from anon;
revoke all on function public.recompute_settlement_status(uuid) from authenticated;
revoke all on function private.is_anonymous_participant(uuid) from public;
revoke all on function private.is_anonymous_participant(uuid) from anon;
revoke all on function private.is_anonymous_participant(uuid) from authenticated;
revoke all on function private.enforce_space_member_role_eligibility() from public;
revoke all on function private.enforce_space_member_role_eligibility() from anon;
revoke all on function private.enforce_space_member_role_eligibility() from authenticated;
revoke all on function private.enforce_space_owner_eligibility() from public;
revoke all on function private.enforce_space_owner_eligibility() from anon;
revoke all on function private.enforce_space_owner_eligibility() from authenticated;
revoke all on function private.enforce_permanent_space_mutation() from public;
revoke all on function private.enforce_permanent_space_mutation() from anon;
revoke all on function private.enforce_permanent_space_mutation()
  from authenticated;

revoke all on function public.accept_space_invite(text) from public;
revoke all on function public.accept_space_invite(text) from anon;
revoke all on function public.remove_space_member(uuid, uuid) from public;
revoke all on function public.remove_space_member(uuid, uuid) from anon;
revoke all on function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) from public;
revoke all on function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) from anon;
revoke all on function public.consume_capture_quota(text, bigint) from public;
revoke all on function public.consume_capture_quota(text, bigint) from anon;

grant execute on function public.accept_space_invite(text) to authenticated;
grant execute on function public.remove_space_member(uuid, uuid) to authenticated;
grant execute on function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) to authenticated;
grant execute on function public.consume_capture_quota(text, bigint)
  to authenticated;
