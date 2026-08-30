-- Bounded command surface for space membership, friendships, and settlements.
-- All client mutations run as security-definer functions; underlying tables
-- remain protected by the RLS policies introduced in migration 002.

create or replace function public.recompute_settlement_status(target_payment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_count integer;
  pending_count integer;
  accepted_count integer;
  declined_count integer;
  reversed_count integer;
  next_status text;
begin
  perform 1
  from public.settlement_payments as payment
  where payment.id = target_payment_id
  for update;

  if not found then
    raise exception 'settlement_not_found';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (where allocation.state = 'pending')::integer,
    pg_catalog.count(*) filter (where allocation.state = 'accepted')::integer,
    pg_catalog.count(*) filter (where allocation.state = 'declined')::integer,
    pg_catalog.count(*) filter (where allocation.state = 'reversed')::integer
  into total_count, pending_count, accepted_count, declined_count, reversed_count
  from public.settlement_allocations as allocation
  where allocation.settlement_payment_id = target_payment_id;

  if total_count = 0 then
    raise exception 'settlement_has_no_allocations';
  elsif accepted_count = total_count then
    next_status := 'confirmed';
  elsif accepted_count > 0 then
    next_status := 'partially_confirmed';
  elsif pending_count > 0 then
    next_status := 'pending';
  elsif declined_count > 0 then
    next_status := 'declined';
  elsif reversed_count = total_count then
    next_status := 'reversed';
  else
    raise exception 'invalid_allocation_state';
  end if;

  update public.settlement_payments as payment
  set
    status = next_status,
    reversed_at = case
      when next_status = 'reversed'
        then coalesce(payment.reversed_at, pg_catalog.now())
      else payment.reversed_at
    end,
    reversed_by = case
      when next_status = 'reversed'
        then coalesce(
          payment.reversed_by,
          public.current_participant_id()
        )
      else payment.reversed_by
    end
  where payment.id = target_payment_id;

  return next_status;
end;
$$;

create or replace function public.update_space(
  target_space_id uuid,
  space_name text,
  start_date date,
  end_date date,
  default_currency text,
  expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  space_row public.spaces%rowtype;
  next_version integer;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into space_row
  from public.spaces as space
  where space.id = target_space_id
  for update;

  if space_row.id is null then
    raise exception 'space_not_found';
  end if;
  if private.space_role(target_space_id, actor) not in ('owner', 'full_access') then
    raise exception 'space_write_denied';
  end if;
  if expected_version is null or expected_version <> space_row.version then
    raise exception 'version_conflict';
  end if;
  if space_name is null
     or pg_catalog.char_length(pg_catalog.btrim(space_name)) not between 1 and 120 then
    raise exception 'invalid_space_name';
  end if;
  if default_currency is null
     or pg_catalog.upper(default_currency) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;
  if end_date is not null and start_date is not null and end_date < start_date then
    raise exception 'invalid_date_range';
  end if;

  next_version := space_row.version + 1;

  update public.spaces as space
  set
    name = pg_catalog.btrim(space_name),
    start_date = update_space.start_date,
    end_date = update_space.end_date,
    default_currency = pg_catalog.upper(update_space.default_currency),
    version = next_version
  where space.id = target_space_id;

  insert into public.financial_events(
    actor_participant_id,
    space_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_space_id,
    'space.updated',
    pg_catalog.jsonb_build_object(
      'previous_version', space_row.version,
      'version', next_version
    )
  );

  return next_version;
end;
$$;

create or replace function public.add_manual_space_member(
  target_space_id uuid,
  display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  new_participant_id uuid;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;
  if private.space_role(target_space_id, actor) not in ('owner', 'full_access') then
    raise exception 'space_write_denied';
  end if;
  if display_name is null
     or pg_catalog.char_length(pg_catalog.btrim(display_name)) not between 1 and 100 then
    raise exception 'invalid_display_name';
  end if;

  perform 1
  from public.spaces as space
  where space.id = target_space_id
  for update;

  if not found then
    raise exception 'space_not_found';
  end if;

  insert into public.participants(kind, display_name, created_by)
  values ('manual', pg_catalog.btrim(display_name), (select auth.uid()))
  returning id into new_participant_id;

  insert into public.space_members(space_id, participant_id, role)
  values (target_space_id, new_participant_id, 'view');

  insert into public.financial_events(
    actor_participant_id,
    space_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_space_id,
    'space.manual_member_added',
    pg_catalog.jsonb_build_object('participant_id', new_participant_id)
  );

  return new_participant_id;
end;
$$;

create or replace function public.update_space_member_role(
  target_space_id uuid,
  target_participant_id uuid,
  member_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  member_row public.space_members%rowtype;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;
  if member_role not in ('full_access', 'view') then
    raise exception 'invalid_member_role';
  end if;
  if private.space_role(target_space_id, actor) <> 'owner' then
    raise exception 'owner_required';
  end if;

  select *
  into member_row
  from public.space_members as member
  where member.space_id = target_space_id
    and member.participant_id = target_participant_id
    and member.removed_at is null
  for update;

  if member_row.participant_id is null then
    raise exception 'active_space_member_not_found';
  end if;
  if member_row.role = 'owner' then
    raise exception 'active_owner_cannot_be_modified';
  end if;

  update public.space_members as member
  set role = update_space_member_role.member_role
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
    'space.member_role_updated',
    pg_catalog.jsonb_build_object(
      'participant_id', target_participant_id,
      'previous_role', member_row.role,
      'role', member_role
    )
  );
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
  if actor is null then
    raise exception 'not_authenticated';
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
    raise exception 'active_space_member_not_found';
  end if;
  if member_row.role = 'owner' then
    raise exception 'active_owner_cannot_be_removed';
  end if;
  if actor_role <> 'owner'
     and not (
       actor = target_participant_id
       and actor_role in ('full_access', 'view')
     ) then
    raise exception 'member_remove_denied';
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

create or replace function public.revoke_space_invite(target_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  invite_row public.space_invites%rowtype;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into invite_row
  from public.space_invites as invite
  where invite.id = target_invite_id
  for update;

  if invite_row.id is null then
    raise exception 'space_invite_not_found';
  end if;
  if private.space_role(invite_row.space_id, actor) <> 'owner' then
    raise exception 'owner_required';
  end if;
  if invite_row.revoked_at is not null or invite_row.consumed_at is not null then
    raise exception 'invite_unavailable';
  end if;

  update public.space_invites as invite
  set revoked_at = pg_catalog.now()
  where invite.id = target_invite_id;

  insert into public.financial_events(
    actor_participant_id,
    space_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    invite_row.space_id,
    'space.invite_revoked',
    pg_catalog.jsonb_build_object('invite_id', target_invite_id)
  );
end;
$$;

create or replace function public.archive_friendship(target_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  friendship_row public.friendships%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select *
  into friendship_row
  from public.friendships as friendship
  where friendship.id = target_friendship_id
  for update;

  if friendship_row.id is null then
    raise exception 'friendship_not_found';
  end if;
  if actor not in (
    friendship_row.participant_low_id,
    friendship_row.participant_high_id
  ) then
    raise exception 'friendship_write_denied';
  end if;

  update public.friendships as friendship
  set status = 'archived', archived_at = pg_catalog.now()
  where friendship.id = target_friendship_id;
end;
$$;

create or replace function public.block_friendship(target_friendship_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  friendship_row public.friendships%rowtype;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select *
  into friendship_row
  from public.friendships as friendship
  where friendship.id = target_friendship_id
  for update;

  if friendship_row.id is null then
    raise exception 'friendship_not_found';
  end if;
  if actor not in (
    friendship_row.participant_low_id,
    friendship_row.participant_high_id
  ) then
    raise exception 'friendship_write_denied';
  end if;

  update public.friendships as friendship
  set status = 'blocked', archived_at = pg_catalog.now()
  where friendship.id = target_friendship_id;
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
    raise exception 'not_authenticated';
  end if;
  if request_id is null then
    raise exception 'invalid_request_id';
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
    raise exception 'invalid_settlement_scope';
  end if;
  if total_amount_minor is null
     or total_amount_minor <= 0
     or total_amount_minor > 9007199254740991 then
    raise exception 'invalid_amount';
  end if;
  if currency_code is null
     or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;
  if payment_date is null then
    raise exception 'invalid_payment_date';
  end if;
  if creditor_ids is null
     or allocation_amounts is null
     or pg_catalog.cardinality(creditor_ids) = 0
     or pg_catalog.cardinality(creditor_ids) <> pg_catalog.cardinality(allocation_amounts) then
    raise exception 'invalid_allocation_arrays';
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
    raise exception 'invalid_allocation';
  end if;
  if pg_catalog.cardinality(creditor_ids) <> (
    select pg_catalog.count(distinct creditor.value)
    from pg_catalog.unnest(creditor_ids) as creditor(value)
  ) then
    raise exception 'duplicate_creditor';
  end if;
  if actor = any(creditor_ids) then
    raise exception 'debtor_cannot_be_creditor';
  end if;

  select coalesce(pg_catalog.sum(amount.value), 0)
  into allocation_total
  from pg_catalog.unnest(allocation_amounts) as amount(value);

  if allocation_total <> total_amount_minor then
    raise exception 'settlement_does_not_reconcile';
  end if;

  if settlement_scope = 'direct' then
    if target_space_id is not null or pg_catalog.cardinality(creditor_ids) <> 1 then
      raise exception 'invalid_direct_settlement';
    end if;
    if not exists (
      select 1
      from public.participants as participant
      where participant.id = creditor_ids[1]
        and participant.kind = 'account'
    ) then
      raise exception 'direct_creditor_not_account';
    end if;
    if not private.has_friend_history(actor, creditor_ids[1]) then
      raise exception 'direct_creditor_not_friend';
    end if;
  else
    if target_space_id is null then
      raise exception 'space_required';
    end if;
    if private.space_role(target_space_id, actor) is null then
      raise exception 'space_membership_required';
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
      raise exception 'creditor_not_in_space';
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
      raise exception 'creditor_not_found';
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

create or replace function public.respond_to_settlement(
  target_allocation_id uuid,
  response text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  allocation_row public.settlement_allocations%rowtype;
  parent_status text;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception 'invalid_response';
  end if;

  select *
  into allocation_row
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id
  for update;

  if allocation_row.id is null then
    raise exception 'allocation_not_found';
  end if;
  if allocation_row.creditor_participant_id <> actor then
    raise exception 'allocation_write_denied';
  end if;
  if allocation_row.state <> 'pending' then
    raise exception 'allocation_not_pending';
  end if;

  update public.settlement_allocations as allocation
  set
    state = respond_to_settlement.response,
    responded_at = pg_catalog.now()
  where allocation.id = target_allocation_id;

  parent_status := public.recompute_settlement_status(
    allocation_row.settlement_payment_id
  );

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    allocation_row.settlement_payment_id,
    'settlement.allocation_' || response,
    pg_catalog.jsonb_build_object(
      'allocation_id', target_allocation_id,
      'status', parent_status
    )
  );

  return parent_status;
end;
$$;

create or replace function public.reverse_settlement_allocation(
  target_allocation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  allocation_row public.settlement_allocations%rowtype;
  parent_status text;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into allocation_row
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id
  for update;

  if allocation_row.id is null then
    raise exception 'allocation_not_found';
  end if;
  if allocation_row.creditor_participant_id <> actor then
    raise exception 'allocation_write_denied';
  end if;
  if allocation_row.state <> 'accepted' then
    raise exception 'allocation_not_accepted';
  end if;

  update public.settlement_allocations as allocation
  set state = 'reversed', responded_at = pg_catalog.now()
  where allocation.id = target_allocation_id;

  parent_status := public.recompute_settlement_status(
    allocation_row.settlement_payment_id
  );

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    allocation_row.settlement_payment_id,
    'settlement.allocation_reversed',
    pg_catalog.jsonb_build_object(
      'allocation_id', target_allocation_id,
      'status', parent_status
    )
  );

  return parent_status;
end;
$$;

create or replace function public.revoke_friend_invite(target_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  invite_row public.friend_invites%rowtype;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;

  select *
  into invite_row
  from public.friend_invites as invite
  where invite.id = target_invite_id
  for update;

  if invite_row.id is null then
    raise exception 'friend_invite_not_found';
  end if;
  if invite_row.created_by <> actor then
    raise exception 'friend_invite_write_denied';
  end if;
  if invite_row.revoked_at is not null or invite_row.consumed_at is not null then
    raise exception 'invite_unavailable';
  end if;

  update public.friend_invites as invite
  set revoked_at = pg_catalog.now()
  where invite.id = target_invite_id;
end;
$$;

revoke all on function public.recompute_settlement_status(uuid) from public;
revoke all on function public.update_space(uuid, text, date, date, text, integer) from public;
revoke all on function public.add_manual_space_member(uuid, text) from public;
revoke all on function public.update_space_member_role(uuid, uuid, text) from public;
revoke all on function public.remove_space_member(uuid, uuid) from public;
revoke all on function public.revoke_space_invite(uuid) from public;
revoke all on function public.archive_friendship(uuid) from public;
revoke all on function public.block_friendship(uuid) from public;
revoke all on function public.propose_settlement(uuid, text, uuid, text, bigint, date, uuid[], bigint[], text) from public;
revoke all on function public.respond_to_settlement(uuid, text) from public;
revoke all on function public.reverse_settlement_allocation(uuid) from public;
revoke all on function public.revoke_friend_invite(uuid) from public;

grant execute on function public.update_space(uuid, text, date, date, text, integer) to authenticated;
grant execute on function public.add_manual_space_member(uuid, text) to authenticated;
grant execute on function public.update_space_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_space_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_space_invite(uuid) to authenticated;
grant execute on function public.archive_friendship(uuid) to authenticated;
grant execute on function public.block_friendship(uuid) to authenticated;
grant execute on function public.propose_settlement(uuid, text, uuid, text, bigint, date, uuid[], bigint[], text) to authenticated;
grant execute on function public.respond_to_settlement(uuid, text) to authenticated;
grant execute on function public.reverse_settlement_allocation(uuid) to authenticated;
grant execute on function public.revoke_friend_invite(uuid) to authenticated;
