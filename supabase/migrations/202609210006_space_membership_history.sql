-- Phase 6F: time-bounded Space membership and historical financial privacy.
--
-- A current Group/Trip membership must not unlock financial records created
-- before the participant joined or while they were removed. Accepted expense
-- participation and settlement party status remain explicit access paths.

create table if not exists public.space_membership_intervals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists space_membership_intervals_one_open_idx
  on public.space_membership_intervals(space_id, participant_id)
  where ended_at is null;

create index if not exists space_membership_intervals_lookup_idx
  on public.space_membership_intervals(
    space_id,
    participant_id,
    started_at,
    ended_at
  );

-- This is the only recoverable interval for existing rows. Earlier join/leave
-- cycles were overwritten by the legacy (space_id, participant_id) row and
-- cannot be reconstructed safely.
insert into public.space_membership_intervals(
  space_id,
  participant_id,
  started_at,
  ended_at
)
select member.space_id,
  member.participant_id,
  member.joined_at,
  member.removed_at
from public.space_members as member
where not exists (
  select 1
  from public.space_membership_intervals as interval
  where interval.space_id = member.space_id
    and interval.participant_id = member.participant_id
    and interval.started_at = member.joined_at
    and interval.ended_at is not distinct from member.removed_at
);

create or replace function private.reject_overlapping_space_membership_interval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.space_membership_intervals as existing
    where existing.space_id = new.space_id
      and existing.participant_id = new.participant_id
      and existing.id <> new.id
      and pg_catalog.tstzrange(
        existing.started_at,
        existing.ended_at,
        '[)'
      ) && pg_catalog.tstzrange(new.started_at, new.ended_at, '[)')
  ) then
    raise exception using
      message = 'space_membership_interval_overlap',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_overlapping_space_membership_interval
  on public.space_membership_intervals;
create trigger reject_overlapping_space_membership_interval
  before insert or update
  on public.space_membership_intervals
  for each row
  execute function private.reject_overlapping_space_membership_interval();

create or replace function private.sync_space_membership_interval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.space_membership_intervals(
      space_id,
      participant_id,
      started_at,
      ended_at
    )
    values (
      new.space_id,
      new.participant_id,
      new.joined_at,
      new.removed_at
    );
    return new;
  end if;

  if old.removed_at is null and new.removed_at is not null then
    update public.space_membership_intervals as interval
    set ended_at = new.removed_at
    where interval.space_id = old.space_id
      and interval.participant_id = old.participant_id
      and interval.ended_at is null;

    if not found then
      insert into public.space_membership_intervals(
        space_id,
        participant_id,
        started_at,
        ended_at
      )
      values (
        old.space_id,
        old.participant_id,
        old.joined_at,
        new.removed_at
      );
    end if;
  elsif old.removed_at is not null and new.removed_at is null then
    insert into public.space_membership_intervals(
      space_id,
      participant_id,
      started_at,
      ended_at
    )
    values (
      new.space_id,
      new.participant_id,
      new.joined_at,
      null
    );
  elsif old.removed_at is null
    and new.removed_at is null
    and new.joined_at is distinct from old.joined_at then
    update public.space_membership_intervals as interval
    set started_at = new.joined_at
    where interval.space_id = new.space_id
      and interval.participant_id = new.participant_id
      and interval.ended_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_space_membership_interval on public.space_members;
create trigger sync_space_membership_interval
  after insert or update of joined_at, removed_at
  on public.space_members
  for each row
  execute function private.sync_space_membership_interval();

create or replace function private.has_space_membership_at(
  target_space_id uuid,
  target_participant_id uuid,
  target_created_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_space_id is not null
    and target_participant_id is not null
    and target_created_at is not null
    and exists (
      select 1
      from public.space_membership_intervals as interval
      where interval.space_id = target_space_id
        and interval.participant_id = target_participant_id
        and interval.started_at <= target_created_at
        and (
          interval.ended_at is null
          or target_created_at < interval.ended_at
        )
    );
$$;

create or replace function private.can_read_expense(
  target_expense_id uuid,
  viewer_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_participant_id is not null and exists (
    select 1
    from public.expenses as expense
    where expense.id = target_expense_id
      and (
        expense.created_by = viewer_participant_id
        or exists (
          select 1
          from public.expense_participations as participation
          where participation.expense_id = expense.id
            and participation.participant_id = viewer_participant_id
            and participation.state = 'accepted'
        )
        or (
          expense.scope = 'space'
          and private.has_space_membership_at(
            expense.space_id,
            viewer_participant_id,
            expense.created_at
          )
        )
      )
  );
$$;

create or replace function private.can_read_settlement(
  target_payment_id uuid,
  viewer_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_participant_id is not null and exists (
    select 1
    from public.settlement_payments as payment
    where payment.id = target_payment_id
      and (
        payment.debtor_participant_id = viewer_participant_id
        or exists (
          select 1
          from public.settlement_allocations as allocation
          where allocation.settlement_payment_id = payment.id
            and allocation.creditor_participant_id = viewer_participant_id
        )
        or (
          payment.scope = 'space'
          and private.has_space_membership_at(
            payment.space_id,
            viewer_participant_id,
            payment.created_at
          )
        )
      )
  );
$$;

create or replace function private.can_read_financial_event(
  target_event_id uuid,
  viewer_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select viewer_participant_id is not null and exists (
    select 1
    from public.financial_events as event
    where event.id = target_event_id
      and (
        (
          event.expense_id is not null
          and private.can_read_expense(
            event.expense_id,
            viewer_participant_id
          )
        )
        or (
          event.settlement_payment_id is not null
          and private.can_read_settlement(
            event.settlement_payment_id,
            viewer_participant_id
          )
        )
        or (
          event.space_id is not null
          and private.has_space_membership_at(
            event.space_id,
            viewer_participant_id,
            event.created_at
          )
        )
      )
  );
$$;

drop policy if exists expense_participations_select_visible
  on public.expense_participations;
create policy expense_participations_select_visible
  on public.expense_participations for select to authenticated
  using (
    private.can_read_expense(
      expense_id,
      public.current_participant_id()
    )
  );

drop policy if exists expense_shares_select_visible on public.expense_shares;
create policy expense_shares_select_visible
  on public.expense_shares for select to authenticated
  using (
    private.can_read_expense(
      expense_id,
      public.current_participant_id()
    )
  );

drop policy if exists financial_events_select_visible on public.financial_events;
create policy financial_events_select_visible
  on public.financial_events for select to authenticated
  using (
    private.can_read_financial_event(
      id,
      public.current_participant_id()
    )
  );

alter table public.space_membership_intervals enable row level security;

revoke all on table public.space_membership_intervals
  from public, anon, authenticated;
revoke all on function private.has_space_membership_at(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function private.can_read_financial_event(uuid, uuid)
  from public, anon;
grant execute on function private.can_read_financial_event(uuid, uuid)
  to authenticated;
revoke all on function private.reject_overlapping_space_membership_interval()
  from public, anon, authenticated;
revoke all on function private.sync_space_membership_interval()
  from public, anon, authenticated;
