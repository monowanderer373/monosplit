-- Tabby Tally command functions and RLS.
-- Financial child tables intentionally have no direct client write policies.
-- Mutations go through the functions below so validation, audit, and writes
-- happen in one PostgreSQL transaction.

create schema if not exists private;
revoke all on schema private from public;

create or replace function public.current_participant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.participants as p
  where p.auth_user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_permanent_account()
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

create or replace function private.space_role(target_space_id uuid, target_participant_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select sm.role
  from public.space_members as sm
  where sm.space_id = target_space_id
    and sm.participant_id = target_participant_id
    and sm.removed_at is null
  limit 1;
$$;

create or replace function private.is_active_space_member(target_space_id uuid, target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members as sm
    where sm.space_id = target_space_id
      and sm.participant_id = target_participant_id
      and sm.removed_at is null
  );
$$;

create or replace function private.are_friends(first_participant_id uuid, second_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships as f
    where f.participant_low_id = least(first_participant_id, second_participant_id)
      and f.participant_high_id = greatest(first_participant_id, second_participant_id)
      and f.status = 'accepted'
  );
$$;

create or replace function private.has_friend_history(first_participant_id uuid, second_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships as f
    where f.participant_low_id = least(first_participant_id, second_participant_id)
      and f.participant_high_id = greatest(first_participant_id, second_participant_id)
      and f.status in ('accepted', 'archived')
  );
$$;

create or replace function private.can_read_expense(target_expense_id uuid, viewer_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses as e
    where e.id = target_expense_id
      and (
        e.created_by = viewer_participant_id
        or (
          e.scope = 'space'
          and private.is_active_space_member(e.space_id, viewer_participant_id)
        )
        or exists (
          select 1
          from public.expense_participations as ep
          where ep.expense_id = e.id
            and ep.participant_id = viewer_participant_id
        )
      )
  );
$$;

create or replace function private.is_historical_space_expense_participant(
  target_expense_id uuid,
  viewer_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.expenses as e
    join public.expense_participations as ep on ep.expense_id = e.id
    where e.id = target_expense_id
      and e.scope = 'space'
      and ep.participant_id = viewer_participant_id
      and ep.state = 'accepted'
  );
$$;

create or replace function private.can_read_settlement(target_payment_id uuid, viewer_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.settlement_payments as sp
    where sp.id = target_payment_id
      and (
        sp.debtor_participant_id = viewer_participant_id
        or (
          sp.scope = 'space'
          and private.is_active_space_member(sp.space_id, viewer_participant_id)
        )
        or exists (
          select 1
          from public.settlement_allocations as sa
          where sa.settlement_payment_id = sp.id
            and sa.creditor_participant_id = viewer_participant_id
        )
      )
  );
$$;

alter table public.user_profiles enable row level security;
alter table public.participants enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.friendships enable row level security;
alter table public.space_invites enable row level security;
alter table public.friend_invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participations enable row level security;
alter table public.payer_contributions enable row level security;
alter table public.expense_shares enable row level security;
alter table public.settlement_payments enable row level security;
alter table public.settlement_allocations enable row level security;
alter table public.financial_events enable row level security;
alter table public.product_events enable row level security;

do $$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'user_profiles', 'participants', 'spaces', 'space_members', 'friendships',
    'space_invites', 'friend_invites', 'expenses', 'expense_participations',
    'payer_contributions', 'expense_shares', 'settlement_payments',
    'settlement_allocations', 'financial_events', 'product_events'
  ]
  loop
    for policy_row in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, target_table);
    end loop;
  end loop;
end $$;

create policy user_profiles_select_own
  on public.user_profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy user_profiles_update_own
  on public.user_profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy participants_select_visible
  on public.participants for select to authenticated
  using (
    auth_user_id = (select auth.uid())
    or created_by = (select auth.uid())
    or private.has_friend_history(id, public.current_participant_id())
    or exists (
      select 1
      from public.space_members as mine
      join public.space_members as theirs on theirs.space_id = mine.space_id
      where mine.participant_id = public.current_participant_id()
        and mine.removed_at is null
        and theirs.participant_id = participants.id
        and theirs.removed_at is null
    )
  );

create policy spaces_select_member
  on public.spaces for select to authenticated
  using (private.is_active_space_member(id, public.current_participant_id()));

create policy space_members_select_related
  on public.space_members for select to authenticated
  using (
    participant_id = public.current_participant_id()
    or private.is_active_space_member(space_id, public.current_participant_id())
  );

create policy friendships_select_self
  on public.friendships for select to authenticated
  using (
    participant_low_id = public.current_participant_id()
    or participant_high_id = public.current_participant_id()
  );

create policy expenses_select_visible
  on public.expenses for select to authenticated
  using (private.can_read_expense(id, public.current_participant_id()));

create policy expense_participations_select_visible
  on public.expense_participations for select to authenticated
  using (
    participant_id = public.current_participant_id()
    or private.is_historical_space_expense_participant(
      expense_id,
      public.current_participant_id()
    )
    or exists (
      select 1
      from public.expenses as e
      where e.id = expense_participations.expense_id
        and (
          e.created_by = public.current_participant_id()
          or (
            e.scope = 'space'
            and private.is_active_space_member(e.space_id, public.current_participant_id())
          )
        )
    )
    or exists (
      select 1
      from public.payer_contributions as pc
      where pc.expense_participation_id = expense_participations.id
        and private.can_read_expense(pc.expense_id, public.current_participant_id())
    )
  );

create policy payer_contributions_select_visible
  on public.payer_contributions for select to authenticated
  using (private.can_read_expense(expense_id, public.current_participant_id()));

create policy expense_shares_select_visible
  on public.expense_shares for select to authenticated
  using (
    exists (
      select 1
      from public.expense_participations as ep
      where ep.id = expense_shares.expense_participation_id
        and (
          ep.participant_id = public.current_participant_id()
          or private.is_historical_space_expense_participant(
            ep.expense_id,
            public.current_participant_id()
          )
          or exists (
            select 1
            from public.expenses as e
            where e.id = ep.expense_id
              and (
                e.created_by = public.current_participant_id()
                or (
                  e.scope = 'space'
                  and private.is_active_space_member(e.space_id, public.current_participant_id())
                )
              )
          )
        )
    )
  );

create policy settlement_payments_select_visible
  on public.settlement_payments for select to authenticated
  using (private.can_read_settlement(id, public.current_participant_id()));

create policy settlement_allocations_select_visible
  on public.settlement_allocations for select to authenticated
  using (private.can_read_settlement(settlement_payment_id, public.current_participant_id()));

create policy financial_events_select_visible
  on public.financial_events for select to authenticated
  using (
    (expense_id is not null and private.can_read_expense(expense_id, public.current_participant_id()))
    or (
      settlement_payment_id is not null
      and private.can_read_settlement(settlement_payment_id, public.current_participant_id())
    )
    or (
      space_id is not null
      and private.is_active_space_member(space_id, public.current_participant_id())
    )
  );

create policy product_events_insert_self
  on public.product_events for insert to authenticated
  with check (
    participant_id is null
    or participant_id = public.current_participant_id()
  );
create policy product_events_select_self
  on public.product_events for select to authenticated
  using (participant_id = public.current_participant_id());

create or replace function public.create_manual_participant(display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(trim(display_name)) not between 1 and 100 then
    raise exception 'invalid_display_name';
  end if;

  insert into public.participants(kind, display_name, created_by)
  values ('manual', trim(display_name), (select auth.uid()))
  returning id into participant_id;
  return participant_id;
end;
$$;

create or replace function public.create_space(
  space_type text,
  space_name text,
  start_date date default null,
  end_date date default null,
  default_currency text default 'MYR'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  new_space_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;
  if space_type not in ('group', 'trip') then
    raise exception 'invalid_space_type';
  end if;

  insert into public.spaces(type, name, owner_participant_id, start_date, end_date, default_currency)
  values (space_type, trim(space_name), actor, start_date, end_date, upper(default_currency))
  returning id into new_space_id;

  insert into public.space_members(space_id, participant_id, role)
  values (new_space_id, actor, 'owner');

  insert into public.financial_events(actor_participant_id, space_id, event_type)
  values (actor, new_space_id, 'space.created');

  return new_space_id;
end;
$$;

create or replace function public.create_space_invite(
  target_space_id uuid,
  invite_role text,
  ttl interval default interval '7 days'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  raw_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
begin
  if private.space_role(target_space_id, actor) <> 'owner' then
    raise exception 'owner_required';
  end if;
  if invite_role not in ('full_access', 'view') then
    raise exception 'invalid_invite_role';
  end if;
  if ttl <= interval '0 seconds' or ttl > interval '30 days' then
    raise exception 'invalid_invite_ttl';
  end if;

  insert into public.space_invites(token_digest, space_id, role, created_by, expires_at)
  values (extensions.digest(raw_token, 'sha256'), target_space_id, invite_role, actor, now() + ttl);
  return raw_token;
end;
$$;

create or replace function public.preview_space_invite(raw_token text)
returns table(space_id uuid, space_name text, space_type text, invite_role text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.type, i.role, i.expires_at
  from public.space_invites as i
  join public.spaces as s on s.id = i.space_id
  where i.token_digest = extensions.digest(raw_token, 'sha256')
    and i.revoked_at is null
    and i.consumed_at is null
    and i.expires_at > now()
  limit 1;
$$;

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
    raise exception 'not_authenticated';
  end if;

  select *
  into invite_row
  from public.space_invites
  where token_digest = extensions.digest(raw_token, 'sha256')
  for update;

  if invite_row.id is null
     or invite_row.revoked_at is not null
     or invite_row.consumed_at is not null
     or invite_row.expires_at <= now() then
    raise exception 'invite_unavailable';
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
      else now()
    end;

  update public.space_invites
  set consumed_at = now(), consumed_by = actor
  where id = invite_row.id;

  return invite_row.space_id;
end;
$$;

create or replace function public.create_friend_invite(ttl interval default interval '7 days')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  raw_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;
  if ttl <= interval '0 seconds' or ttl > interval '30 days' then
    raise exception 'invalid_invite_ttl';
  end if;

  insert into public.friend_invites(token_digest, created_by, expires_at)
  values (extensions.digest(raw_token, 'sha256'), actor, now() + ttl);
  return raw_token;
end;
$$;

create or replace function public.accept_friend_invite(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  invite_row public.friend_invites%rowtype;
  friendship_id uuid;
  low_id uuid;
  high_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select *
  into invite_row
  from public.friend_invites
  where token_digest = extensions.digest(raw_token, 'sha256')
  for update;

  if invite_row.id is null
     or invite_row.revoked_at is not null
     or invite_row.consumed_at is not null
     or invite_row.expires_at <= now()
     or invite_row.created_by = actor then
    raise exception 'invite_unavailable';
  end if;

  low_id := least(invite_row.created_by, actor);
  high_id := greatest(invite_row.created_by, actor);

  insert into public.friendships(
    participant_low_id, participant_high_id, requested_by, status, accepted_at
  )
  values (low_id, high_id, invite_row.created_by, 'accepted', now())
  on conflict (participant_low_id, participant_high_id)
  do update set status = 'accepted', accepted_at = now(), archived_at = null
  returning id into friendship_id;

  update public.friend_invites
  set consumed_at = now(), consumed_by = actor
  where id = invite_row.id;

  return friendship_id;
end;
$$;

create or replace function public.create_expense(
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
  share_amounts bigint[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  existing_id uuid;
  new_expense_id uuid;
  participation_id uuid;
  item_participant uuid;
  item_state text;
  item_tracking text;
  contribution_total numeric;
  share_total numeric;
  participant_name text;
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

  select e.id into existing_id
  from public.expenses as e
  where e.created_by = actor and e.client_request_id = request_id;
  if existing_id is not null then
    return existing_id;
  end if;

  if expense_scope not in ('personal', 'direct', 'space') then
    raise exception 'invalid_expense_scope';
  end if;
  if expense_scope in ('personal', 'direct') and not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;
  if total_minor <= 0 or total_minor > 9007199254740991 then
    raise exception 'invalid_amount';
  end if;
  if cardinality(participant_ids) = 0
     or cardinality(participant_ids) <> cardinality(share_amounts)
     or cardinality(participant_ids) <> cardinality(contribution_amounts) then
    raise exception 'invalid_participant_arrays';
  end if;
  if cardinality(participant_ids) <> (
    select count(distinct value) from unnest(participant_ids) as value
  ) then
    raise exception 'duplicate_participant';
  end if;

  select coalesce(sum(value), 0) into contribution_total
  from unnest(contribution_amounts) as value;
  select coalesce(sum(value), 0) into share_total
  from unnest(share_amounts) as value;
  if contribution_total <> total_minor or share_total <> total_minor then
    raise exception 'expense_does_not_reconcile';
  end if;
  if exists (select 1 from unnest(contribution_amounts) as value where value < 0)
     or exists (select 1 from unnest(share_amounts) as value where value < 0) then
    raise exception 'negative_amount';
  end if;

  if expense_scope = 'personal' then
    if target_space_id is not null
       or cardinality(participant_ids) <> 1
       or participant_ids[1] <> actor then
      raise exception 'invalid_personal_expense';
    end if;
  elsif expense_scope = 'space' then
    if target_space_id is null
       or private.space_role(target_space_id, actor) not in ('owner', 'full_access') then
      raise exception 'space_write_denied';
    end if;
    if exists (
      select 1
      from unnest(participant_ids) as value
      where not private.is_active_space_member(target_space_id, value)
    ) then
      raise exception 'participant_not_in_space';
    end if;
  else
    if target_space_id is not null or not actor = any(participant_ids) then
      raise exception 'invalid_direct_expense';
    end if;
    if exists (
      select 1
      from unnest(participant_ids) as value
      join public.participants as p on p.id = value
      where value <> actor
        and (
          (p.kind = 'account' and not private.are_friends(actor, value))
          or (
            p.kind = 'manual'
            and p.created_by is distinct from (select auth.uid())
          )
        )
    ) then
      raise exception 'direct_participant_not_friend';
    end if;
  end if;

  insert into public.expenses(
    client_request_id, scope, space_id, created_by, total_minor, participant_count,
    currency, description, category, occurred_on
  )
  values (
    request_id, expense_scope, target_space_id, actor, total_minor, cardinality(participant_ids),
    upper(currency_code), nullif(trim(description), ''), coalesce(nullif(trim(category), ''), 'Other'), occurred_on
  )
  returning id into new_expense_id;

  for item_index in 1..cardinality(participant_ids)
  loop
    item_participant := participant_ids[item_index];
    select p.display_name into participant_name
    from public.participants as p where p.id = item_participant;
    if participant_name is null then
      raise exception 'participant_not_found';
    end if;

    if expense_scope in ('personal', 'space') or item_participant = actor then
      item_state := 'accepted';
      item_tracking := 'tracked';
    elsif exists (
      select 1 from public.participants as p
      where p.id = item_participant and p.kind = 'manual'
    ) then
      item_state := 'untracked';
      item_tracking := 'untracked';
    else
      item_state := 'pending';
      item_tracking := 'tracked';
    end if;

    insert into public.expense_participations(
      expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
    )
    values (
      new_expense_id, item_participant, participant_name, item_index - 1, item_state, item_tracking
    )
    returning id into participation_id;

    if contribution_amounts[item_index] > 0 then
      insert into public.payer_contributions(expense_participation_id, expense_id, amount_minor)
      values (participation_id, new_expense_id, contribution_amounts[item_index]);
    end if;

    insert into public.expense_shares(expense_participation_id, expense_id, amount_minor)
    values (participation_id, new_expense_id, share_amounts[item_index]);
  end loop;

  insert into public.financial_events(actor_participant_id, expense_id, event_type)
  values (actor, new_expense_id, 'expense.created');

  return new_expense_id;
end;
$$;

create or replace function public.respond_to_direct_expense(target_expense_id uuid, response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
begin
  if response not in ('accepted', 'declined') then
    raise exception 'invalid_response';
  end if;

  update public.expense_participations as ep
  set state = response, updated_at = now()
  from public.expenses as e
  where ep.expense_id = e.id
    and e.id = target_expense_id
    and e.scope = 'direct'
    and e.status = 'active'
    and ep.participant_id = actor
    and ep.state = 'pending';

  if not found then
    raise exception 'pending_participation_not_found';
  end if;

  insert into public.financial_events(actor_participant_id, expense_id, event_type)
  values (actor, target_expense_id, 'direct.' || response);
end;
$$;

create or replace function public.void_expense(target_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
begin
  select * into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null then
    raise exception 'expense_not_found';
  end if;
  if expense_row.created_by <> actor
     and not (
       expense_row.scope = 'space'
       and private.space_role(expense_row.space_id, actor) = 'owner'
     ) then
    raise exception 'expense_write_denied';
  end if;

  update public.expenses
  set status = 'voided', voided_at = now(), voided_by = actor, version = version + 1
  where id = target_expense_id and status = 'active';
  if not found then
    return;
  end if;

  insert into public.financial_events(actor_participant_id, expense_id, event_type)
  values (actor, target_expense_id, 'expense.voided');
end;
$$;

revoke all on function public.current_participant_id() from public;
revoke all on function public.is_permanent_account() from public;
revoke all on function private.space_role(uuid, uuid) from public;
revoke all on function private.is_active_space_member(uuid, uuid) from public;
revoke all on function private.are_friends(uuid, uuid) from public;
revoke all on function private.has_friend_history(uuid, uuid) from public;
revoke all on function private.can_read_expense(uuid, uuid) from public;
revoke all on function private.is_historical_space_expense_participant(uuid, uuid) from public;
revoke all on function private.can_read_settlement(uuid, uuid) from public;
revoke all on function public.create_manual_participant(text) from public;
revoke all on function public.create_space(text, text, date, date, text) from public;
revoke all on function public.create_space_invite(uuid, text, interval) from public;
revoke all on function public.preview_space_invite(text) from public;
revoke all on function public.accept_space_invite(text) from public;
revoke all on function public.create_friend_invite(interval) from public;
revoke all on function public.accept_friend_invite(text) from public;
revoke all on function public.create_expense(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[]) from public;
revoke all on function public.respond_to_direct_expense(uuid, text) from public;
revoke all on function public.void_expense(uuid) from public;

grant execute on function public.current_participant_id() to authenticated;
grant execute on function public.is_permanent_account() to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.space_role(uuid, uuid) to authenticated;
grant execute on function private.is_active_space_member(uuid, uuid) to authenticated;
grant execute on function private.are_friends(uuid, uuid) to authenticated;
grant execute on function private.has_friend_history(uuid, uuid) to authenticated;
grant execute on function private.can_read_expense(uuid, uuid) to authenticated;
grant execute on function private.is_historical_space_expense_participant(uuid, uuid) to authenticated;
grant execute on function private.can_read_settlement(uuid, uuid) to authenticated;
grant execute on function public.create_manual_participant(text) to authenticated;
grant execute on function public.create_space(text, text, date, date, text) to authenticated;
grant execute on function public.create_space_invite(uuid, text, interval) to authenticated;
grant execute on function public.preview_space_invite(text) to anon, authenticated;
grant execute on function public.accept_space_invite(text) to authenticated;
grant execute on function public.create_friend_invite(interval) to authenticated;
grant execute on function public.accept_friend_invite(text) to authenticated;
grant execute on function public.create_expense(uuid, text, uuid, bigint, text, text, text, date, uuid[], bigint[], bigint[]) to authenticated;
grant execute on function public.respond_to_direct_expense(uuid, text) to authenticated;
grant execute on function public.void_expense(uuid) to authenticated;
