-- Phase 5B1 financial-trust foundation.
-- Additive schema only: no historical financial row, Participant, Person,
-- Space membership, correction lineage, or reversal fact is backfilled.

-- Expense lifecycle and authoritative correction lineage.
alter table public.expenses
  add column if not exists corrects_expense_id uuid,
  add column if not exists termination_kind text;

alter table public.expenses
  drop constraint if exists expenses_status_check;
alter table public.expenses
  add constraint expenses_status_check
  check (status in ('active', 'correction_pending', 'voided')) not valid;
alter table public.expenses
  validate constraint expenses_status_check;

alter table public.expenses
  add constraint expenses_corrects_expense_fk
  foreign key (corrects_expense_id)
  references public.expenses(id)
  on delete restrict
  not valid;
alter table public.expenses
  validate constraint expenses_corrects_expense_fk;

alter table public.expenses
  add constraint expenses_no_self_correction_check
  check (corrects_expense_id is null or corrects_expense_id <> id) not valid;
alter table public.expenses
  validate constraint expenses_no_self_correction_check;

alter table public.expenses
  add constraint expenses_termination_kind_check
  check (termination_kind is null or termination_kind in ('cancelled', 'corrected'))
  not valid;
alter table public.expenses
  validate constraint expenses_termination_kind_check;

alter table public.expenses
  add constraint expenses_lifecycle_shape_check
  check (
    (status in ('active', 'correction_pending') and termination_kind is null)
    or status = 'voided'
  ) not valid;
alter table public.expenses
  validate constraint expenses_lifecycle_shape_check;

alter table public.expenses
  add constraint expenses_pending_candidate_lineage_check
  check (status <> 'correction_pending' or corrects_expense_id is null) not valid;
alter table public.expenses
  validate constraint expenses_pending_candidate_lineage_check;

alter table public.expenses
  add constraint expenses_pending_candidate_scope_check
  check (status <> 'correction_pending' or scope = 'direct') not valid;
alter table public.expenses
  validate constraint expenses_pending_candidate_scope_check;

create unique index if not exists expenses_one_authoritative_child_idx
  on public.expenses(corrects_expense_id)
  where corrects_expense_id is not null;

-- Direct correction/cancellation workflow and authority history. Phase 5B2
-- security-definer RPCs are the only supported future writers.
create table if not exists public.direct_expense_change_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  kind text not null check (kind in ('correction', 'cancellation')),
  state text not null default 'pending'
    check (state in ('pending', 'authoritative', 'declined', 'cancelled')),
  proposed_by uuid not null
    references public.participants(id) on delete restrict,
  target_expense_id uuid not null
    references public.expenses(id) on delete restrict,
  replacement_expense_id uuid
    references public.expenses(id) on delete restrict,
  target_version integer not null check (target_version > 0),
  version integer not null default 1 check (version > 0),
  payload_fingerprint text not null
    check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  reason text check (
    reason is null
    or char_length(pg_catalog.btrim(reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint direct_expense_change_request_actor_idempotency
    unique (proposed_by, client_request_id),
  constraint direct_expense_change_request_kind_shape
    check (
      (kind = 'correction' and replacement_expense_id is not null)
      or (kind = 'cancellation' and replacement_expense_id is null)
    ),
  constraint direct_expense_change_request_distinct_expenses
    check (
      replacement_expense_id is null
      or replacement_expense_id <> target_expense_id
    )
);

create table if not exists public.direct_expense_change_approvals (
  request_id uuid not null
    references public.direct_expense_change_requests(id) on delete restrict,
  participant_id uuid not null
    references public.participants(id) on delete restrict,
  state text not null default 'pending'
    check (state in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (request_id, participant_id),
  constraint direct_expense_change_approval_response_shape
    check (
      (state = 'pending' and responded_at is null)
      or (state in ('accepted', 'declined') and responded_at is not null)
    )
);

create unique index if not exists direct_change_replacement_once_idx
  on public.direct_expense_change_requests(replacement_expense_id)
  where replacement_expense_id is not null;
create unique index if not exists direct_change_one_pending_target_idx
  on public.direct_expense_change_requests(target_expense_id)
  where state = 'pending';
create unique index if not exists direct_change_one_authoritative_target_idx
  on public.direct_expense_change_requests(target_expense_id)
  where state = 'authoritative';
create index if not exists direct_change_proposer_updated_idx
  on public.direct_expense_change_requests(proposed_by, updated_at desc);
create index if not exists direct_change_approval_participant_idx
  on public.direct_expense_change_approvals(participant_id, state, request_id);

-- Settlement workflow expansion. PostgreSQL can install the constant version
-- default without a table rewrite on supported versions; existing rows read 1.
alter table public.settlement_payments
  add column if not exists version integer not null default 1;

alter table public.settlement_payments
  add constraint settlement_payments_version_positive_check
  check (version > 0) not valid;
alter table public.settlement_payments
  validate constraint settlement_payments_version_positive_check;

alter table public.settlement_payments
  drop constraint if exists settlement_payments_status_check;
alter table public.settlement_payments
  add constraint settlement_payments_status_check
  check (
    status in (
      'pending',
      'partially_confirmed',
      'confirmed',
      'declined',
      'reversed',
      'cancelled',
      'mixed_closed'
    )
  ) not valid;
alter table public.settlement_payments
  validate constraint settlement_payments_status_check;

alter table public.settlement_allocations
  drop constraint if exists settlement_allocations_state_check;
alter table public.settlement_allocations
  add constraint settlement_allocations_state_check
  check (state in ('pending', 'accepted', 'declined', 'reversed', 'cancelled'))
  not valid;
alter table public.settlement_allocations
  validate constraint settlement_allocations_state_check;

-- One immutable full reversal fact per accepted allocation. Matching the
-- snapshotted amount to the accepted allocation and requiring accepted state
-- are cross-row invariants owned by the Phase 5B2 reversal RPC.
create table if not exists public.settlement_allocation_reversals (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  settlement_allocation_id uuid not null
    references public.settlement_allocations(id) on delete restrict,
  reversed_by uuid not null
    references public.participants(id) on delete restrict,
  amount_minor bigint not null
    check (amount_minor > 0 and amount_minor <= 9007199254740991),
  reason text check (
    reason is null
    or char_length(pg_catalog.btrim(reason)) between 1 and 500
  ),
  created_at timestamptz not null default now(),
  constraint settlement_reversal_actor_idempotency
    unique (reversed_by, client_request_id),
  constraint settlement_reversal_one_per_allocation
    unique (settlement_allocation_id)
);

create index if not exists settlement_reversal_actor_created_idx
  on public.settlement_allocation_reversals(reversed_by, created_at desc);

-- RLS helpers deliberately depend only on Participant-based expense and
-- settlement visibility. Person relationships never authorize financial data.
create or replace function private.can_read_direct_expense_change(
  target_request_id uuid,
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
    from public.direct_expense_change_requests as request
    where request.id = target_request_id
      and private.can_read_expense(
        request.target_expense_id,
        viewer_participant_id
      )
      and (
        request.proposed_by = viewer_participant_id
        or exists (
          select 1
          from public.direct_expense_change_approvals as approval
          where approval.request_id = request.id
            and approval.participant_id = viewer_participant_id
        )
      )
  );
$$;

create or replace function private.can_read_settlement_reversal(
  target_reversal_id uuid,
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
    from public.settlement_allocation_reversals as reversal
    join public.settlement_allocations as allocation
      on allocation.id = reversal.settlement_allocation_id
    where reversal.id = target_reversal_id
      and private.can_read_settlement(
        allocation.settlement_payment_id,
        viewer_participant_id
      )
  );
$$;

create or replace function private.can_read_direct_expense_approval(
  target_request_id uuid,
  approval_participant_id uuid,
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
    from public.direct_expense_change_requests as request
    where request.id = target_request_id
      and private.can_read_expense(
        request.target_expense_id,
        viewer_participant_id
      )
      and (
        request.proposed_by = viewer_participant_id
        or approval_participant_id = viewer_participant_id
      )
  );
$$;

alter table public.direct_expense_change_requests enable row level security;
alter table public.direct_expense_change_approvals enable row level security;
alter table public.settlement_allocation_reversals enable row level security;

drop policy if exists direct_expense_change_requests_select_involved
  on public.direct_expense_change_requests;
create policy direct_expense_change_requests_select_involved
  on public.direct_expense_change_requests for select to authenticated
  using (
    private.can_read_direct_expense_change(
      id,
      public.current_participant_id()
    )
  );

drop policy if exists direct_expense_change_approvals_select_involved
  on public.direct_expense_change_approvals;
create policy direct_expense_change_approvals_select_involved
  on public.direct_expense_change_approvals for select to authenticated
  using (
    private.can_read_direct_expense_approval(
      request_id,
      participant_id,
      public.current_participant_id()
    )
  );

drop policy if exists settlement_allocation_reversals_select_visible
  on public.settlement_allocation_reversals;
create policy settlement_allocation_reversals_select_visible
  on public.settlement_allocation_reversals for select to authenticated
  using (
    private.can_read_settlement_reversal(
      id,
      public.current_participant_id()
    )
  );

revoke all on table public.direct_expense_change_requests
  from public, anon, authenticated;
revoke all on table public.direct_expense_change_approvals
  from public, anon, authenticated;
revoke all on table public.settlement_allocation_reversals
  from public, anon, authenticated;
grant select on table public.direct_expense_change_requests to authenticated;
grant select on table public.direct_expense_change_approvals to authenticated;
grant select on table public.settlement_allocation_reversals to authenticated;

-- Phase 5C listens only for invalidation and always refetches the complete
-- authoritative request/expense snapshot. It never applies row events as
-- financial truth.
do $$
declare
  target_table text;
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach target_table in array array[
      'direct_expense_change_requests',
      'direct_expense_change_approvals'
    ]
    loop
      if not exists (
        select 1
        from pg_catalog.pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute pg_catalog.format(
          'alter publication supabase_realtime add table public.%I',
          target_table
        );
      end if;
    end loop;
  end if;
end;
$$;

revoke all on function private.can_read_direct_expense_change(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_read_settlement_reversal(uuid, uuid)
  from public, anon, authenticated;
revoke all on function private.can_read_direct_expense_approval(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.can_read_direct_expense_change(uuid, uuid)
  to authenticated;
grant execute on function private.can_read_settlement_reversal(uuid, uuid)
  to authenticated;
grant execute on function private.can_read_direct_expense_approval(uuid, uuid, uuid)
  to authenticated;

comment on column public.expenses.corrects_expense_id is
  'Authoritative correction lineage only; pending candidates remain NULL.';
comment on table public.direct_expense_change_requests is
  'Direct correction/cancellation workflow and authority history; RPC-only writes.';
comment on table public.direct_expense_change_approvals is
  'Participant authority snapshot for a Direct expense change request.';
comment on table public.settlement_allocation_reversals is
  'Immutable full reversal facts; accepted settlement allocations remain unchanged.';

-- Phase 5B2 writer-owned cross-row invariants:
-- * request target and replacement are Direct Expenses with identical currency,
--   Participant UUID membership, and stored participant_order;
-- * a pending correction owns a correction_pending B whose lineage is NULL;
-- * required approvals are exactly the non-proposer account Participants;
-- * final approval atomically marks the request authoritative, supersedes A,
--   activates B, and sets B.corrects_expense_id = A.id;
-- * cancellation requests have no B and authority atomically cancels A;
-- * a reversal references an accepted allocation and snapshots its full amount.
-- The focused pgTAP suite contains detection queries for request/lineage drift.

-- Deployment boundary:
-- The schema declarations above precede the guarded Phase 5B2 writers below.
-- Phase 5B2 replaces/guards and explicitly revokes the old overloads for:
--   replace_expense_financials
--   void_expense
--   respond_to_direct_expense
--   respond_to_settlement
--   reverse_settlement_allocation
-- New reversal writes use immutable settlement_allocation_reversals facts.

-- Phase 5B2 shared writer primitives.
create or replace function private.lock_expense_target(target_expense_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.expense:' || target_expense_id::text,
      0
    )
  );
$$;

create or replace function private.assert_reconciled_expense_payload(
  next_total_minor bigint,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[]
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  contribution_total numeric;
  share_total numeric;
begin
  if next_total_minor is null
     or next_total_minor <= 0
     or next_total_minor > 9007199254740991 then
    raise exception using message = 'invalid_amount', errcode = 'P0001';
  end if;
  if participant_ids is null
     or contribution_amounts is null
     or share_amounts is null
     or pg_catalog.cardinality(participant_ids) = 0
     or pg_catalog.cardinality(participant_ids)
       <> pg_catalog.cardinality(contribution_amounts)
     or pg_catalog.cardinality(participant_ids)
       <> pg_catalog.cardinality(share_amounts) then
    raise exception using
      message = 'invalid_participant_arrays',
      errcode = 'P0001';
  end if;
  if pg_catalog.cardinality(participant_ids) <> (
    select pg_catalog.count(distinct participant_id)
    from pg_catalog.unnest(participant_ids) as participant(participant_id)
  ) then
    raise exception using message = 'duplicate_participant', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(participant_ids) as participant(participant_id)
    where participant.participant_id is null
       or not exists (
         select 1
         from public.participants as known
         where known.id = participant.participant_id
       )
  ) then
    raise exception using message = 'participant_not_found', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(contribution_amounts) as amount(value)
    where amount.value is null or amount.value < 0
  ) or exists (
    select 1
    from pg_catalog.unnest(share_amounts) as amount(value)
    where amount.value is null or amount.value < 0
  ) then
    raise exception using message = 'negative_amount', errcode = 'P0001';
  end if;

  select coalesce(pg_catalog.sum(amount.value), 0)
    into contribution_total
  from pg_catalog.unnest(contribution_amounts) as amount(value);
  select coalesce(pg_catalog.sum(amount.value), 0)
    into share_total
  from pg_catalog.unnest(share_amounts) as amount(value);

  if contribution_total <> next_total_minor
     or share_total <> next_total_minor then
    raise exception using
      message = 'expense_does_not_reconcile',
      errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.insert_expense_financial_rows(
  target_expense_id uuid,
  expense_creator uuid,
  expense_scope text,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  item_participant uuid;
  participant_name text;
  participant_kind text;
  participation_id uuid;
  item_state text;
  item_tracking text;
begin
  for item_index in 1..pg_catalog.cardinality(participant_ids)
  loop
    item_participant := participant_ids[item_index];
    select participant.display_name, participant.kind
      into participant_name, participant_kind
    from public.participants as participant
    where participant.id = item_participant;

    if participant_name is null then
      raise exception using message = 'participant_not_found', errcode = 'P0001';
    end if;

    if expense_scope in ('personal', 'space')
       or item_participant = expense_creator then
      item_state := 'accepted';
      item_tracking := 'tracked';
    elsif participant_kind = 'manual' then
      item_state := 'untracked';
      item_tracking := 'untracked';
    else
      item_state := 'pending';
      item_tracking := 'tracked';
    end if;

    insert into public.expense_participations(
      expense_id,
      participant_id,
      name_snapshot,
      participant_order,
      state,
      tracking_mode
    )
    values (
      target_expense_id,
      item_participant,
      participant_name,
      item_index - 1,
      item_state,
      item_tracking
    )
    returning id into participation_id;

    if contribution_amounts[item_index] > 0 then
      insert into public.payer_contributions(
        expense_participation_id,
        expense_id,
        amount_minor
      )
      values (
        participation_id,
        target_expense_id,
        contribution_amounts[item_index]
      );
    end if;

    insert into public.expense_shares(
      expense_participation_id,
      expense_id,
      amount_minor
    )
    values (
      participation_id,
      target_expense_id,
      share_amounts[item_index]
    );
  end loop;
end;
$$;

create or replace function private.direct_change_payload_fingerprint(
  target_expense_id uuid,
  expected_target_version integer,
  change_kind text,
  change_reason text,
  replacement_total_minor bigint,
  replacement_currency text,
  replacement_description text,
  replacement_category text,
  replacement_occurred_on date,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[]
)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.jsonb_build_object(
        'target_expense_id', target_expense_id,
        'target_version', expected_target_version,
        'kind', change_kind,
        'reason', nullif(pg_catalog.btrim(change_reason), ''),
        'total_minor', replacement_total_minor,
        'currency', case
          when replacement_currency is null then null
          else pg_catalog.upper(replacement_currency)
        end,
        'description', nullif(pg_catalog.btrim(replacement_description), ''),
        'category', case
          when change_kind = 'correction'
            then coalesce(
              nullif(pg_catalog.btrim(replacement_category), ''),
              'Other'
            )
          else null
        end,
        'occurred_on', replacement_occurred_on,
        'participant_ids', participant_ids,
        'contribution_amounts', contribution_amounts,
        'share_amounts', share_amounts
      )::text,
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.direct_revision_chain_is_consistent(
  first_revision_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive chain as (
    select
      expense.id,
      expense.status,
      expense.termination_kind,
      array[expense.id] as visited_ids,
      false as has_cycle
    from public.expenses as expense
    where expense.id = first_revision_id
      and expense.scope = 'direct'

    union all

    select
      child.id,
      child.status,
      child.termination_kind,
      chain.visited_ids || child.id,
      child.id = any(chain.visited_ids)
    from chain
    join public.direct_expense_change_requests as authority
      on authority.target_expense_id = chain.id
     and authority.kind = 'correction'
     and authority.state = 'authoritative'
    join public.expenses as child
      on child.id = authority.replacement_expense_id
     and child.corrects_expense_id = chain.id
     and child.scope = 'direct'
    where not chain.has_cycle
  ),
  facts as (
    select
      chain.*,
      authority.kind as authority_kind,
      authority.replacement_expense_id,
      child.id as child_id
    from chain
    left join public.direct_expense_change_requests as authority
      on authority.target_expense_id = chain.id
     and authority.state = 'authoritative'
    left join public.expenses as child
      on child.id = authority.replacement_expense_id
     and child.corrects_expense_id = chain.id
  )
  select
    pg_catalog.count(*) > 0
    and not coalesce(pg_catalog.bool_or(facts.has_cycle), false)
    and coalesce(
      pg_catalog.bool_and(
        (
          facts.status = 'active'
          and facts.termination_kind is null
          and facts.authority_kind is null
        )
        or (
          facts.status = 'voided'
          and facts.termination_kind = 'corrected'
          and facts.authority_kind = 'correction'
          and facts.replacement_expense_id is not null
          and facts.child_id is not null
        )
        or (
          facts.status = 'voided'
          and facts.termination_kind = 'cancelled'
          and facts.authority_kind = 'cancellation'
          and facts.replacement_expense_id is null
          and facts.child_id is null
        )
      ),
      false
    )
  from facts;
$$;

create or replace function private.assert_direct_change_invariants(
  target_expense_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_row public.expenses%rowtype;
  request_row public.direct_expense_change_requests%rowtype;
  replacement_row public.expenses%rowtype;
  target_participants uuid[];
  replacement_participants uuid[];
  expected_approvers uuid[];
  actual_approvers uuid[];
begin
  select *
    into target_row
  from public.expenses
  where id = target_expense_id;

  if target_row.id is null or target_row.scope <> 'direct' then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  if target_row.corrects_expense_id is not null
     and not exists (
       select 1
       from public.direct_expense_change_requests as authority
       where authority.kind = 'correction'
         and authority.state = 'authoritative'
         and authority.target_expense_id = target_row.corrects_expense_id
         and authority.replacement_expense_id = target_row.id
     ) then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.expenses as child
    where child.corrects_expense_id = target_row.id
      and child.scope = 'direct'
      and not exists (
        select 1
        from public.direct_expense_change_requests as authority
        where authority.kind = 'correction'
          and authority.state = 'authoritative'
          and authority.target_expense_id = target_row.id
          and authority.replacement_expense_id = child.id
      )
  ) then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  select coalesce(
      pg_catalog.array_agg(
        participation.participant_id
        order by participation.participant_order
      ),
      array[]::uuid[]
    )
    into target_participants
  from public.expense_participations as participation
  where participation.expense_id = target_row.id;

  for request_row in
    select request.*
    from public.direct_expense_change_requests as request
    where request.target_expense_id = target_row.id
    order by request.created_at, request.id
  loop
    if request_row.proposed_by <> target_row.created_by then
      raise exception using
        message = 'financial_invariant_violation',
        errcode = 'P0001';
    end if;

    if request_row.kind = 'correction' then
      select *
        into replacement_row
      from public.expenses
      where id = request_row.replacement_expense_id;

      if replacement_row.id is null
         or replacement_row.scope <> 'direct'
         or replacement_row.currency <> target_row.currency then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;

      select coalesce(
          pg_catalog.array_agg(
            participation.participant_id
            order by participation.participant_order
          ),
          array[]::uuid[]
        )
        into replacement_participants
      from public.expense_participations as participation
      where participation.expense_id = replacement_row.id;

      if replacement_participants <> target_participants then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;

      select coalesce(
          pg_catalog.array_agg(
            participation.participant_id
            order by participation.participant_id
          ),
          array[]::uuid[]
        )
        into expected_approvers
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = replacement_row.id
        and participation.participant_id <> request_row.proposed_by
        and participant.kind = 'account';
    else
      if request_row.replacement_expense_id is not null then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;

      select coalesce(
          pg_catalog.array_agg(
            participation.participant_id
            order by participation.participant_id
          ),
          array[]::uuid[]
        )
        into expected_approvers
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = target_row.id
        and participation.participant_id <> request_row.proposed_by
        and participation.state = 'accepted'
        and participation.tracking_mode = 'tracked'
        and participant.kind = 'account';
    end if;

    select coalesce(
        pg_catalog.array_agg(
          approval.participant_id
          order by approval.participant_id
        ),
        array[]::uuid[]
      )
      into actual_approvers
    from public.direct_expense_change_approvals as approval
    where approval.request_id = request_row.id;

    if actual_approvers <> expected_approvers
       or pg_catalog.cardinality(expected_approvers) = 0 then
      raise exception using
        message = 'financial_invariant_violation',
        errcode = 'P0001';
    end if;

    if request_row.state = 'pending' then
      if target_row.status <> 'active'
         or target_row.version <> request_row.target_version
         or exists (
           select 1
           from public.direct_expense_change_approvals as approval
           where approval.request_id = request_row.id
             and approval.state = 'declined'
         )
         or (
           request_row.kind = 'correction'
           and (
             replacement_row.status <> 'correction_pending'
             or replacement_row.corrects_expense_id is not null
             or replacement_row.version <> 1
           )
         ) then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;
    elsif request_row.state in ('declined', 'cancelled') then
      if request_row.kind = 'correction'
         and (
           replacement_row.status <> 'voided'
           or replacement_row.corrects_expense_id is not null
           or replacement_row.termination_kind is not null
         ) then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;
    elsif request_row.state = 'authoritative' then
      if exists (
        select 1
        from public.direct_expense_change_approvals as approval
        where approval.request_id = request_row.id
          and approval.state <> 'accepted'
      ) then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;

      if request_row.kind = 'correction' then
        if target_row.status <> 'voided'
           or target_row.termination_kind <> 'corrected'
           or replacement_row.corrects_expense_id <> target_row.id
           or not private.direct_revision_chain_is_consistent(
             replacement_row.id
           ) then
          raise exception using
            message = 'financial_invariant_violation',
            errcode = 'P0001';
        end if;
      elsif target_row.status <> 'voided'
            or target_row.termination_kind <> 'cancelled' then
        raise exception using
          message = 'financial_invariant_violation',
          errcode = 'P0001';
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.propose_direct_expense_change(
  request_id uuid,
  target_expense_id uuid,
  expected_target_version integer,
  change_kind text,
  change_reason text default null,
  replacement_total_minor bigint default null,
  replacement_currency text default null,
  replacement_description text default null,
  replacement_category text default null,
  replacement_occurred_on date default null,
  participant_ids uuid[] default null,
  contribution_amounts bigint[] default null,
  share_amounts bigint[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  target_row public.expenses%rowtype;
  existing_request public.direct_expense_change_requests%rowtype;
  new_request_id uuid;
  replacement_id uuid;
  fingerprint text;
  target_participants uuid[];
  approver_ids uuid[];
  approver_id uuid;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  if change_kind not in ('correction', 'cancellation') then
    raise exception using message = 'invalid_change_kind', errcode = 'P0001';
  end if;

  if change_kind = 'correction' then
    perform private.assert_reconciled_expense_payload(
      replacement_total_minor,
      participant_ids,
      contribution_amounts,
      share_amounts
    );
    if replacement_currency is null
       or pg_catalog.upper(replacement_currency) !~ '^[A-Z]{3}$' then
      raise exception using message = 'invalid_currency', errcode = 'P0001';
    end if;
    if replacement_occurred_on is null then
      raise exception using message = 'invalid_expense_date', errcode = 'P0001';
    end if;
  elsif replacement_total_minor is not null
        or replacement_currency is not null
        or replacement_description is not null
        or replacement_category is not null
        or replacement_occurred_on is not null
        or participant_ids is not null
        or contribution_amounts is not null
        or share_amounts is not null then
    raise exception using
      message = 'cancellation_replacement_forbidden',
      errcode = 'P0001';
  end if;

  fingerprint := private.direct_change_payload_fingerprint(
    target_expense_id,
    expected_target_version,
    change_kind,
    change_reason,
    replacement_total_minor,
    replacement_currency,
    replacement_description,
    replacement_category,
    replacement_occurred_on,
    participant_ids,
    contribution_amounts,
    share_amounts
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.direct.request:' || actor::text || ':' || request_id::text,
      0
    )
  );

  select *
    into existing_request
  from public.direct_expense_change_requests as request
  where request.proposed_by = actor
    and request.client_request_id = request_id;

  if existing_request.id is not null then
    if existing_request.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    perform private.lock_expense_target(existing_request.target_expense_id);
    perform private.assert_direct_change_invariants(
      existing_request.target_expense_id
    );
    return pg_catalog.jsonb_build_object(
      'request_id', existing_request.id,
      'request_version', existing_request.version,
      'request_state', existing_request.state,
      'replacement_expense_id', existing_request.replacement_expense_id
    );
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into target_row
  from public.expenses
  where id = target_expense_id
  for update;

  if target_row.id is null
     or target_row.scope <> 'direct'
     or target_row.status <> 'active' then
    raise exception using
      message = 'effective_direct_expense_required',
      errcode = 'P0001';
  end if;
  if target_row.created_by <> actor then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;
  if expected_target_version is null
     or target_row.version <> expected_target_version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  perform private.assert_direct_change_invariants(target_row.id);

  if exists (
    select 1
    from public.direct_expense_change_requests as request
    where request.target_expense_id = target_row.id
      and request.state in ('pending', 'authoritative')
  ) or exists (
    select 1
    from public.expenses as child
    where child.corrects_expense_id = target_row.id
  ) then
    raise exception using message = 'change_request_exists', errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.expense_participations as participation
    join public.participants as participant
      on participant.id = participation.participant_id
    where participation.expense_id = target_row.id
      and participation.participant_id <> actor
      and participation.state = 'accepted'
      and participation.tracking_mode = 'tracked'
      and participant.kind = 'account'
  ) then
    raise exception using
      message = 'confirmed_direct_required',
      errcode = 'P0001';
  end if;

  select coalesce(
      pg_catalog.array_agg(
        participation.participant_id
        order by participation.participant_order
      ),
      array[]::uuid[]
    )
    into target_participants
  from public.expense_participations as participation
  where participation.expense_id = target_row.id;

  if change_kind = 'correction' then
    if pg_catalog.upper(replacement_currency) <> target_row.currency then
      raise exception using
        message = 'currency_change_requires_cancel_and_new',
        errcode = 'P0001';
    end if;
    if participant_ids <> target_participants then
      raise exception using
        message = 'participant_order_mismatch',
        errcode = 'P0001';
    end if;

    replacement_id := pg_catalog.gen_random_uuid();
    insert into public.expenses(
      id,
      client_request_id,
      scope,
      space_id,
      created_by,
      total_minor,
      participant_count,
      currency,
      description,
      category,
      occurred_on,
      status
    )
    values (
      replacement_id,
      request_id,
      'direct',
      null,
      actor,
      replacement_total_minor,
      pg_catalog.cardinality(participant_ids),
      target_row.currency,
      nullif(pg_catalog.btrim(replacement_description), ''),
      coalesce(
        nullif(pg_catalog.btrim(replacement_category), ''),
        'Other'
      ),
      replacement_occurred_on,
      'correction_pending'
    );

    perform private.insert_expense_financial_rows(
      replacement_id,
      actor,
      'direct',
      participant_ids,
      contribution_amounts,
      share_amounts
    );

    select coalesce(
        pg_catalog.array_agg(
          participation.participant_id
          order by participation.participant_id
        ),
        array[]::uuid[]
      )
      into approver_ids
    from public.expense_participations as participation
    join public.participants as participant
      on participant.id = participation.participant_id
    where participation.expense_id = replacement_id
      and participation.participant_id <> actor
      and participant.kind = 'account';
  else
    select coalesce(
        pg_catalog.array_agg(
          participation.participant_id
          order by participation.participant_id
        ),
        array[]::uuid[]
      )
      into approver_ids
    from public.expense_participations as participation
    join public.participants as participant
      on participant.id = participation.participant_id
    where participation.expense_id = target_row.id
      and participation.participant_id <> actor
      and participation.state = 'accepted'
      and participation.tracking_mode = 'tracked'
      and participant.kind = 'account';
  end if;

  if pg_catalog.cardinality(approver_ids) = 0 then
    raise exception using
      message = 'confirmed_direct_required',
      errcode = 'P0001';
  end if;

  insert into public.direct_expense_change_requests(
    client_request_id,
    kind,
    state,
    proposed_by,
    target_expense_id,
    replacement_expense_id,
    target_version,
    payload_fingerprint,
    reason
  )
  values (
    request_id,
    change_kind,
    'pending',
    actor,
    target_row.id,
    replacement_id,
    target_row.version,
    fingerprint,
    nullif(pg_catalog.btrim(change_reason), '')
  )
  returning id into new_request_id;

  foreach approver_id in array approver_ids
  loop
    insert into public.direct_expense_change_approvals(
      request_id,
      participant_id
    )
    values (new_request_id, approver_id);
  end loop;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_row.id,
    case
      when change_kind = 'correction' then 'expense.correction_proposed'
      else 'expense.cancellation_requested'
    end,
    pg_catalog.jsonb_build_object(
      'request_id', new_request_id,
      'replacement_expense_id', replacement_id,
      'target_version', target_row.version,
      'required_approval_count', pg_catalog.cardinality(approver_ids)
    )
  );

  perform private.assert_direct_change_invariants(target_row.id);

  return pg_catalog.jsonb_build_object(
    'request_id', new_request_id,
    'request_version', 1,
    'request_state', 'pending',
    'replacement_expense_id', replacement_id,
    'required_approver_ids', approver_ids
  );
end;
$$;

create or replace function public.respond_to_direct_expense_change(
  target_request_id uuid,
  response text,
  expected_request_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  request_hint record;
  request_row public.direct_expense_change_requests%rowtype;
  target_row public.expenses%rowtype;
  replacement_row public.expenses%rowtype;
  approval_row public.direct_expense_change_approvals%rowtype;
  remaining_approvals integer;
  next_request_version integer;
  effective_expense_id uuid;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception using message = 'invalid_response', errcode = 'P0001';
  end if;

  select request.target_expense_id
    into request_hint
  from public.direct_expense_change_requests as request
  where request.id = target_request_id;

  if request_hint.target_expense_id is null then
    raise exception using
      message = 'change_request_not_found',
      errcode = 'P0001';
  end if;

  perform private.lock_expense_target(request_hint.target_expense_id);

  select *
    into target_row
  from public.expenses
  where id = request_hint.target_expense_id
  for update;

  select *
    into request_row
  from public.direct_expense_change_requests
  where id = target_request_id
  for update;

  if request_row.id is null
     or request_row.target_expense_id <> target_row.id then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  if request_row.replacement_expense_id is not null then
    select *
      into replacement_row
    from public.expenses
    where id = request_row.replacement_expense_id
    for update;
  end if;

  perform 1
  from public.direct_expense_change_approvals as approval
  where approval.request_id = request_row.id
  order by approval.participant_id
  for update;

  perform private.assert_direct_change_invariants(target_row.id);

  select *
    into approval_row
  from public.direct_expense_change_approvals as approval
  where approval.request_id = request_row.id
    and approval.participant_id = actor;

  if approval_row.request_id is null then
    raise exception using message = 'approval_write_denied', errcode = 'P0001';
  end if;

  if approval_row.state = response then
    effective_expense_id := case
      when request_row.state = 'authoritative'
           and request_row.kind = 'correction'
        then request_row.replacement_expense_id
      when request_row.state = 'authoritative'
           and request_row.kind = 'cancellation'
        then null
      else request_row.target_expense_id
    end;
    return pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_state', request_row.state,
      'request_version', request_row.version,
      'effective_expense_id', effective_expense_id
    );
  end if;

  if approval_row.state <> 'pending' then
    raise exception using
      message = 'approval_response_conflict',
      errcode = 'P0001';
  end if;
  if request_row.state <> 'pending' then
    raise exception using message = 'request_not_pending', errcode = 'P0001';
  end if;
  if expected_request_version is null
     or expected_request_version <> request_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if target_row.status <> 'active'
     or target_row.version <> request_row.target_version then
    raise exception using message = 'target_changed', errcode = 'P0001';
  end if;
  if request_row.kind = 'correction'
     and (
       replacement_row.id is null
       or replacement_row.status <> 'correction_pending'
       or replacement_row.corrects_expense_id is not null
       or replacement_row.version <> 1
     ) then
    raise exception using message = 'replacement_changed', errcode = 'P0001';
  end if;

  next_request_version := request_row.version + 1;

  if response = 'declined' then
    update public.direct_expense_change_approvals
    set state = 'declined', responded_at = pg_catalog.now()
    where request_id = request_row.id
      and participant_id = actor;

    update public.direct_expense_change_requests
    set
      state = 'declined',
      version = next_request_version,
      updated_at = pg_catalog.now()
    where id = request_row.id;

    if request_row.kind = 'correction' then
      update public.expenses
      set
        status = 'voided',
        termination_kind = null,
        voided_at = pg_catalog.now(),
        voided_by = actor,
        version = version + 1
      where id = replacement_row.id;
    end if;

    insert into public.financial_events(
      actor_participant_id,
      expense_id,
      event_type,
      safe_diff
    )
    values (
      actor,
      target_row.id,
      case
        when request_row.kind = 'correction'
          then 'expense.correction_declined'
        else 'expense.cancellation_declined'
      end,
      pg_catalog.jsonb_build_object(
        'request_id', request_row.id,
        'request_version', next_request_version,
        'replacement_expense_id', request_row.replacement_expense_id
      )
    );

    perform private.assert_direct_change_invariants(target_row.id);
    return pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_state', 'declined',
      'request_version', next_request_version,
      'effective_expense_id', target_row.id
    );
  end if;

  update public.direct_expense_change_approvals
  set state = 'accepted', responded_at = pg_catalog.now()
  where request_id = request_row.id
    and participant_id = actor;

  select pg_catalog.count(*)::integer
    into remaining_approvals
  from public.direct_expense_change_approvals as approval
  where approval.request_id = request_row.id
    and approval.state <> 'accepted';

  if remaining_approvals > 0 then
    update public.direct_expense_change_requests
    set
      version = next_request_version,
      updated_at = pg_catalog.now()
    where id = request_row.id;

    insert into public.financial_events(
      actor_participant_id,
      expense_id,
      event_type,
      safe_diff
    )
    values (
      actor,
      target_row.id,
      case
        when request_row.kind = 'correction'
          then 'expense.correction_approval_accepted'
        else 'expense.cancellation_approval_accepted'
      end,
      pg_catalog.jsonb_build_object(
        'request_id', request_row.id,
        'request_version', next_request_version,
        'remaining_approvals', remaining_approvals
      )
    );

    perform private.assert_direct_change_invariants(target_row.id);
    return pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_state', 'pending',
      'request_version', next_request_version,
      'effective_expense_id', target_row.id
    );
  end if;

  if request_row.kind = 'correction' then
    update public.expenses
    set
      status = 'voided',
      termination_kind = 'corrected',
      voided_at = pg_catalog.now(),
      voided_by = actor,
      version = version + 1
    where id = target_row.id;

    update public.expense_participations as participation
    set state = 'accepted'
    from public.participants as participant
    where participation.expense_id = replacement_row.id
      and participant.id = participation.participant_id
      and participant.kind = 'account'
      and participation.tracking_mode = 'tracked';

    update public.expenses
    set
      status = 'active',
      corrects_expense_id = target_row.id,
      version = version + 1
    where id = replacement_row.id;

    effective_expense_id := replacement_row.id;
  else
    update public.expenses
    set
      status = 'voided',
      termination_kind = 'cancelled',
      voided_at = pg_catalog.now(),
      voided_by = actor,
      version = version + 1
    where id = target_row.id;

    effective_expense_id := null;
  end if;

  update public.direct_expense_change_requests
  set
    state = 'authoritative',
    version = next_request_version,
    updated_at = pg_catalog.now()
  where id = request_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_row.id,
    case
      when request_row.kind = 'correction' then 'expense.corrected'
      else 'expense.cancelled'
    end,
    pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_version', next_request_version,
      'previous_version', target_row.version,
      'replacement_expense_id', request_row.replacement_expense_id
    )
  );

  perform private.assert_direct_change_invariants(target_row.id);

  return pg_catalog.jsonb_build_object(
    'request_id', request_row.id,
    'request_state', 'authoritative',
    'request_version', next_request_version,
    'effective_expense_id', effective_expense_id
  );
end;
$$;

create or replace function public.cancel_direct_expense_change(
  target_request_id uuid,
  expected_request_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  request_hint record;
  request_row public.direct_expense_change_requests%rowtype;
  target_row public.expenses%rowtype;
  replacement_row public.expenses%rowtype;
  next_request_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  select request.target_expense_id
    into request_hint
  from public.direct_expense_change_requests as request
  where request.id = target_request_id;

  if request_hint.target_expense_id is null then
    raise exception using
      message = 'change_request_not_found',
      errcode = 'P0001';
  end if;

  perform private.lock_expense_target(request_hint.target_expense_id);

  select *
    into target_row
  from public.expenses
  where id = request_hint.target_expense_id
  for update;

  select *
    into request_row
  from public.direct_expense_change_requests
  where id = target_request_id
  for update;

  if request_row.proposed_by <> actor then
    raise exception using
      message = 'change_request_cancel_denied',
      errcode = 'P0001';
  end if;

  if request_row.replacement_expense_id is not null then
    select *
      into replacement_row
    from public.expenses
    where id = request_row.replacement_expense_id
    for update;
  end if;

  perform 1
  from public.direct_expense_change_approvals as approval
  where approval.request_id = request_row.id
  order by approval.participant_id
  for update;

  perform private.assert_direct_change_invariants(target_row.id);

  if request_row.state = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_state', request_row.state,
      'request_version', request_row.version,
      'effective_expense_id', target_row.id
    );
  end if;
  if request_row.state <> 'pending' then
    raise exception using
      message = 'change_request_terminal_conflict',
      errcode = 'P0001';
  end if;
  if expected_request_version is null
     or expected_request_version <> request_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if target_row.status <> 'active'
     or target_row.version <> request_row.target_version then
    raise exception using message = 'target_changed', errcode = 'P0001';
  end if;

  next_request_version := request_row.version + 1;

  if request_row.kind = 'correction' then
    if replacement_row.status <> 'correction_pending'
       or replacement_row.corrects_expense_id is not null then
      raise exception using message = 'replacement_changed', errcode = 'P0001';
    end if;
    update public.expenses
    set
      status = 'voided',
      termination_kind = null,
      voided_at = pg_catalog.now(),
      voided_by = actor,
      version = version + 1
    where id = replacement_row.id;
  end if;

  update public.direct_expense_change_requests
  set
    state = 'cancelled',
    version = next_request_version,
    updated_at = pg_catalog.now()
  where id = request_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_row.id,
    case
      when request_row.kind = 'correction'
        then 'expense.correction_proposal_cancelled'
      else 'expense.cancellation_request_cancelled'
    end,
    pg_catalog.jsonb_build_object(
      'request_id', request_row.id,
      'request_version', next_request_version,
      'replacement_expense_id', request_row.replacement_expense_id
    )
  );

  perform private.assert_direct_change_invariants(target_row.id);

  return pg_catalog.jsonb_build_object(
    'request_id', request_row.id,
    'request_state', 'cancelled',
    'request_version', next_request_version,
    'effective_expense_id', target_row.id
  );
end;
$$;

create or replace function public.correct_space_expense(
  request_id uuid,
  target_expense_id uuid,
  expected_version integer,
  next_total_minor bigint,
  next_currency text,
  next_description text,
  next_category text,
  next_occurred_on date,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  target_row public.expenses%rowtype;
  existing_row public.expenses%rowtype;
  replacement_id uuid;
  existing_participants uuid[];
  existing_contributions bigint[];
  existing_shares bigint[];
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if not public.is_permanent_account() then
    raise exception using
      message = 'permanent_account_required',
      errcode = 'P0001';
  end if;
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;

  perform private.assert_reconciled_expense_payload(
    next_total_minor,
    participant_ids,
    contribution_amounts,
    share_amounts
  );
  if next_currency is null
     or pg_catalog.upper(next_currency) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;
  if next_occurred_on is null then
    raise exception using message = 'invalid_expense_date', errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.space.correction:' || actor::text || ':' || request_id::text,
      0
    )
  );

  select *
    into existing_row
  from public.expenses
  where created_by = actor
    and client_request_id = request_id;

  if existing_row.id is not null then
    select
      pg_catalog.array_agg(
        participation.participant_id
        order by participation.participant_order
      ),
      pg_catalog.array_agg(
        coalesce(contribution.amount_minor, 0)
        order by participation.participant_order
      ),
      pg_catalog.array_agg(
        share.amount_minor
        order by participation.participant_order
      )
      into
        existing_participants,
        existing_contributions,
        existing_shares
    from public.expense_participations as participation
    left join public.payer_contributions as contribution
      on contribution.expense_participation_id = participation.id
    join public.expense_shares as share
      on share.expense_participation_id = participation.id
    where participation.expense_id = existing_row.id;

    if existing_row.scope <> 'space'
       or existing_row.corrects_expense_id <> target_expense_id
       or existing_row.total_minor <> next_total_minor
       or existing_row.currency <> pg_catalog.upper(next_currency)
       or existing_row.description is distinct from
          nullif(pg_catalog.btrim(next_description), '')
       or existing_row.category <> coalesce(
         nullif(pg_catalog.btrim(next_category), ''),
         'Other'
       )
       or existing_row.occurred_on <> next_occurred_on
       or existing_participants <> participant_ids
       or existing_contributions <> contribution_amounts
       or existing_shares <> share_amounts then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;

    return pg_catalog.jsonb_build_object(
      'replacement_expense_id', existing_row.id,
      'replacement_version', existing_row.version
    );
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into target_row
  from public.expenses
  where id = target_expense_id
  for update;

  if target_row.id is null
     or target_row.scope <> 'space'
     or target_row.status <> 'active' then
    raise exception using
      message = 'effective_space_expense_required',
      errcode = 'P0001';
  end if;
  if target_row.created_by <> actor
     and private.space_role(target_row.space_id, actor) <> 'owner' then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> target_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if pg_catalog.upper(next_currency) <> target_row.currency then
    raise exception using
      message = 'currency_change_requires_cancel_and_new',
      errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.expenses as child
    where child.corrects_expense_id = target_row.id
  ) then
    raise exception using message = 'authoritative_child_exists', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(participant_ids) as item(participant_id)
    where not exists (
      select 1
      from public.space_members as member
      where member.space_id = target_row.space_id
        and member.participant_id = item.participant_id
        and member.removed_at is null
    )
  ) then
    raise exception using message = 'participant_not_in_space', errcode = 'P0001';
  end if;

  replacement_id := pg_catalog.gen_random_uuid();
  insert into public.expenses(
    id,
    client_request_id,
    scope,
    space_id,
    created_by,
    total_minor,
    participant_count,
    currency,
    description,
    category,
    occurred_on,
    status,
    corrects_expense_id
  )
  values (
    replacement_id,
    request_id,
    'space',
    target_row.space_id,
    actor,
    next_total_minor,
    pg_catalog.cardinality(participant_ids),
    target_row.currency,
    nullif(pg_catalog.btrim(next_description), ''),
    coalesce(nullif(pg_catalog.btrim(next_category), ''), 'Other'),
    next_occurred_on,
    'active',
    target_row.id
  );

  perform private.insert_expense_financial_rows(
    replacement_id,
    actor,
    'space',
    participant_ids,
    contribution_amounts,
    share_amounts
  );

  update public.expenses
  set
    status = 'voided',
    termination_kind = 'corrected',
    voided_at = pg_catalog.now(),
    voided_by = actor,
    version = version + 1
  where id = target_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    target_row.id,
    'expense.corrected',
    pg_catalog.jsonb_build_object(
      'replacement_expense_id', replacement_id,
      'previous_version', target_row.version,
      'participant_order_changed', (
        select pg_catalog.array_agg(
          participation.participant_id
          order by participation.participant_order
        )
        from public.expense_participations as participation
        where participation.expense_id = target_row.id
      ) <> participant_ids
    )
  );

  return pg_catalog.jsonb_build_object(
    'replacement_expense_id', replacement_id,
    'replacement_version', 1
  );
end;
$$;

create or replace function public.cancel_expense(
  target_expense_id uuid,
  expected_version integer,
  cancellation_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null then
    raise exception using message = 'expense_not_found', errcode = 'P0001';
  end if;
  if expense_row.created_by <> actor
     and not (
       expense_row.scope = 'space'
       and private.space_role(expense_row.space_id, actor) = 'owner'
     ) then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;
  if expense_row.status = 'voided'
     and expense_row.termination_kind = 'cancelled' then
    return expense_row.version;
  end if;
  if expense_row.status = 'correction_pending' then
    raise exception using
      message = 'correction_pending_expense',
      errcode = 'P0001';
  end if;
  if expense_row.status <> 'active' then
    raise exception using
      message = 'expense_terminal_conflict',
      errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> expense_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  if expense_row.scope = 'direct' then
    perform private.assert_direct_change_invariants(expense_row.id);
    if exists (
      select 1
      from public.direct_expense_change_requests as request
      where request.target_expense_id = expense_row.id
        and request.state = 'pending'
    ) then
      raise exception using
        message = 'open_change_request',
        errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = expense_row.id
        and participation.participant_id <> expense_row.created_by
        and participation.state = 'accepted'
        and participation.tracking_mode = 'tracked'
        and participant.kind = 'account'
    ) then
      raise exception using
        message = 'confirmed_direct_requires_change_request',
        errcode = 'P0001';
    end if;
  end if;

  next_version := expense_row.version + 1;
  update public.expenses
  set
    status = 'voided',
    termination_kind = 'cancelled',
    voided_at = pg_catalog.now(),
    voided_by = actor,
    version = next_version
  where id = expense_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    expense_row.id,
    'expense.cancelled',
    pg_catalog.jsonb_build_object(
      'previous_version', expense_row.version,
      'version', next_version,
      'reason', nullif(pg_catalog.btrim(cancellation_reason), '')
    )
  );

  return next_version;
end;
$$;

create or replace function public.restore_owner_local_expense(
  target_expense_id uuid,
  expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null then
    raise exception using message = 'expense_not_found', errcode = 'P0001';
  end if;
  if expense_row.created_by <> actor then
    raise exception using message = 'expense_restore_denied', errcode = 'P0001';
  end if;

  -- A retry of the same successful restore is an idempotent read. An active
  -- expense without this exact restoration event is not treated as restored.
  if expense_row.status = 'active' then
    if exists (
      select 1
      from public.financial_events as event
      where event.expense_id = expense_row.id
        and event.event_type = 'expense.restored'
        and (event.safe_diff ->> 'previous_version')::integer = expected_version
        and (event.safe_diff ->> 'version')::integer = expense_row.version
    ) then
      return expense_row.version;
    end if;
    raise exception using message = 'expense_not_restorable', errcode = 'P0001';
  end if;

  if expected_version is null or expected_version <> expense_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if expense_row.status <> 'voided'
     or expense_row.termination_kind <> 'cancelled'
     or expense_row.corrects_expense_id is not null then
    raise exception using message = 'expense_not_restorable', errcode = 'P0001';
  end if;
  if expense_row.scope not in ('personal', 'direct') then
    raise exception using message = 'expense_not_restorable', errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.expenses as revision
    where revision.corrects_expense_id = expense_row.id
  ) or exists (
    select 1
    from public.direct_expense_change_requests as request
    where request.target_expense_id = expense_row.id
       or request.replacement_expense_id = expense_row.id
  ) then
    raise exception using message = 'expense_not_restorable', errcode = 'P0001';
  end if;

  if expense_row.scope = 'direct' and (
    not exists (
      select 1
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = expense_row.id
        and participation.participant_id <> expense_row.created_by
        and participant.kind = 'manual'
        and participation.state = 'untracked'
        and participation.tracking_mode = 'untracked'
    )
    or exists (
      select 1
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = expense_row.id
        and participation.participant_id <> expense_row.created_by
        and (
          participant.kind <> 'manual'
          or participation.state <> 'untracked'
          or participation.tracking_mode <> 'untracked'
        )
    )
  ) then
    raise exception using message = 'expense_not_restorable', errcode = 'P0001';
  end if;

  next_version := expense_row.version + 1;
  update public.expenses
  set
    status = 'active',
    termination_kind = null,
    voided_at = null,
    voided_by = null,
    version = next_version
  where id = expense_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    expense_row.id,
    'expense.restored',
    pg_catalog.jsonb_build_object(
      'previous_version', expense_row.version,
      'version', next_version
    )
  );

  return next_version;
end;
$$;

create or replace function public.update_expense_metadata(
  target_expense_id uuid,
  next_description text,
  next_category text,
  next_occurred_on date,
  expected_version integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if next_occurred_on is null then
    raise exception using message = 'invalid_expense_date', errcode = 'P0001';
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null then
    raise exception using message = 'expense_not_found', errcode = 'P0001';
  end if;
  if expense_row.status = 'correction_pending' then
    raise exception using
      message = 'correction_pending_expense',
      errcode = 'P0001';
  end if;
  if expense_row.status <> 'active' then
    raise exception using
      message = 'expense_terminal_conflict',
      errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> expense_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if expense_row.created_by <> actor
     and not (
       expense_row.scope = 'space'
       and private.space_role(expense_row.space_id, actor) = 'owner'
     ) then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;
  if expense_row.scope = 'direct' then
    perform private.assert_direct_change_invariants(expense_row.id);
    if exists (
      select 1
      from public.direct_expense_change_requests as request
      where (
        request.target_expense_id = expense_row.id
        or request.replacement_expense_id = expense_row.id
      )
        and request.state = 'pending'
    ) then
      raise exception using
        message = 'open_change_request',
        errcode = 'P0001';
    end if;
  end if;

  next_version := expense_row.version + 1;
  update public.expenses
  set
    description = nullif(pg_catalog.btrim(next_description), ''),
    category = coalesce(nullif(pg_catalog.btrim(next_category), ''), 'Other'),
    occurred_on = next_occurred_on,
    version = next_version
  where id = expense_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    expense_row.id,
    'expense.metadata_updated',
    pg_catalog.jsonb_build_object(
      'previous_version', expense_row.version,
      'version', next_version
    )
  );

  return next_version;
end;
$$;

create or replace function public.replace_expense_financials(
  target_expense_id uuid,
  expected_version integer,
  next_total_minor bigint,
  next_currency text,
  participant_ids uuid[],
  contribution_amounts bigint[],
  share_amounts bigint[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
  historical_manual_ids uuid[];
  next_manual_ids uuid[];
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  perform private.assert_reconciled_expense_payload(
    next_total_minor,
    participant_ids,
    contribution_amounts,
    share_amounts
  );
  if next_currency is null
     or pg_catalog.upper(next_currency) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_currency', errcode = 'P0001';
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null then
    raise exception using message = 'expense_not_found', errcode = 'P0001';
  end if;
  if expense_row.status = 'correction_pending' then
    raise exception using
      message = 'correction_pending_expense',
      errcode = 'P0001';
  end if;
  if expense_row.status <> 'active' then
    raise exception using
      message = 'expense_terminal_conflict',
      errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> expense_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  if expense_row.created_by <> actor then
    raise exception using message = 'expense_write_denied', errcode = 'P0001';
  end if;
  if expense_row.scope = 'space' then
    raise exception using
      message = 'space_correction_required',
      errcode = 'P0001';
  end if;
  if participant_ids[1] is distinct from actor then
    raise exception using
      message = 'creator_must_be_first_participant',
      errcode = 'P0001';
  end if;

  if expense_row.scope = 'personal' then
    if pg_catalog.cardinality(participant_ids) <> 1 then
      raise exception using
        message = 'invalid_personal_expense',
        errcode = 'P0001';
    end if;
  else
    perform private.assert_direct_change_invariants(expense_row.id);
    if exists (
      select 1
      from public.direct_expense_change_requests as request
      where (
        request.target_expense_id = expense_row.id
        or request.replacement_expense_id = expense_row.id
      )
        and request.state = 'pending'
    ) then
      raise exception using
        message = 'open_change_request',
        errcode = 'P0001';
    end if;
    if exists (
      select 1
      from public.expense_participations as participation
      join public.participants as participant
        on participant.id = participation.participant_id
      where participation.expense_id = expense_row.id
        and participation.participant_id <> actor
        and participation.state = 'accepted'
        and participation.tracking_mode = 'tracked'
        and participant.kind = 'account'
    ) then
      raise exception using
        message = 'confirmed_direct_financials_immutable',
        errcode = 'P0001';
    end if;
    if exists (
      select 1
      from pg_catalog.unnest(participant_ids) as item(participant_id)
      join public.participants as participant
        on participant.id = item.participant_id
      where item.participant_id <> actor
        and (
          (
            participant.kind = 'account'
            and not private.are_friends(actor, item.participant_id)
          )
          or (
            participant.kind = 'manual'
            and participant.created_by is distinct from (select auth.uid())
          )
        )
    ) then
      raise exception using
        message = 'direct_participant_not_friend',
        errcode = 'P0001';
    end if;

    select coalesce(
        pg_catalog.array_agg(
          participation.participant_id
          order by participation.participant_id
        ),
        array[]::uuid[]
      )
      into historical_manual_ids
    from public.expense_participations as participation
    join public.participants as participant
      on participant.id = participation.participant_id
    where participation.expense_id = expense_row.id
      and participant.kind = 'manual';

    select coalesce(
        pg_catalog.array_agg(
          item.participant_id
          order by item.participant_id
        ),
        array[]::uuid[]
      )
      into next_manual_ids
    from pg_catalog.unnest(participant_ids) as item(participant_id)
    join public.participants as participant
      on participant.id = item.participant_id
    where participant.kind = 'manual';

    if not historical_manual_ids <@ next_manual_ids then
      raise exception using
        message = 'historical_manual_participant_required',
        errcode = 'P0001';
    end if;
  end if;

  delete from public.expense_participations
  where expense_id = expense_row.id;

  perform private.insert_expense_financial_rows(
    expense_row.id,
    actor,
    expense_row.scope,
    participant_ids,
    contribution_amounts,
    share_amounts
  );

  next_version := expense_row.version + 1;
  update public.expenses
  set
    total_minor = next_total_minor,
    participant_count = pg_catalog.cardinality(participant_ids),
    currency = pg_catalog.upper(next_currency),
    version = next_version
  where id = expense_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    expense_row.id,
    'expense.financials_replaced',
    pg_catalog.jsonb_build_object(
      'previous_version', expense_row.version,
      'version', next_version,
      'direct_confirmations_reset', expense_row.scope = 'direct'
    )
  );

  return next_version;
end;
$$;

create or replace function public.respond_to_direct_expense(
  target_expense_id uuid,
  response text,
  expected_expense_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  expense_row public.expenses%rowtype;
  participation_row public.expense_participations%rowtype;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception using message = 'invalid_response', errcode = 'P0001';
  end if;

  perform private.lock_expense_target(target_expense_id);

  select *
    into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null
     or expense_row.scope <> 'direct'
     or expense_row.status <> 'active' then
    raise exception using
      message = 'active_direct_expense_not_found',
      errcode = 'P0001';
  end if;

  perform private.assert_direct_change_invariants(expense_row.id);

  if exists (
    select 1
    from public.direct_expense_change_requests as request
    where (
      request.target_expense_id = expense_row.id
      or request.replacement_expense_id = expense_row.id
    )
      and request.state = 'pending'
  ) then
    raise exception using message = 'open_change_request', errcode = 'P0001';
  end if;

  select *
    into participation_row
  from public.expense_participations as participation
  where participation.expense_id = expense_row.id
    and participation.participant_id = actor
  for update;

  if participation_row.id is null
     or participation_row.tracking_mode <> 'tracked' then
    raise exception using
      message = 'direct_participation_not_found',
      errcode = 'P0001';
  end if;

  if participation_row.state = response then
    return pg_catalog.jsonb_build_object(
      'expense_version', expense_row.version,
      'participation_state', participation_row.state
    );
  end if;
  if participation_row.state <> 'pending' then
    raise exception using
      message = 'participation_response_conflict',
      errcode = 'P0001';
  end if;
  if expected_expense_version is null
     or expected_expense_version <> expense_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.expense_participations
  set state = response
  where id = participation_row.id;

  next_version := expense_row.version + 1;
  update public.expenses
  set version = next_version
  where id = expense_row.id;

  insert into public.financial_events(
    actor_participant_id,
    expense_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    expense_row.id,
    'direct.' || response,
    pg_catalog.jsonb_build_object(
      'previous_version', expense_row.version,
      'version', next_version
    )
  );

  return pg_catalog.jsonb_build_object(
    'expense_version', next_version,
    'participation_state', response
  );
end;
$$;

create or replace function public.recompute_settlement_status(
  target_payment_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_count integer;
  pending_count integer;
  effective_accepted_count integer;
  historical_accepted_count integer;
  reversed_effect_count integer;
  declined_count integer;
  cancelled_count integer;
  next_status text;
begin
  perform 1
  from public.settlement_payments as payment
  where payment.id = target_payment_id
  for update;

  if not found then
    raise exception using message = 'settlement_not_found', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.settlement_allocation_reversals as reversal
    join public.settlement_allocations as allocation
      on allocation.id = reversal.settlement_allocation_id
    where allocation.settlement_payment_id = target_payment_id
      and (
        allocation.state <> 'accepted'
        or reversal.amount_minor <> allocation.amount_minor
      )
  ) then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(*) filter (
      where allocation.state = 'pending'
    )::integer,
    pg_catalog.count(*) filter (
      where allocation.state = 'accepted'
        and reversal.id is null
    )::integer,
    pg_catalog.count(*) filter (
      where allocation.state in ('accepted', 'reversed')
    )::integer,
    pg_catalog.count(*) filter (
      where allocation.state = 'reversed'
         or (
           allocation.state = 'accepted'
           and reversal.id is not null
         )
    )::integer,
    pg_catalog.count(*) filter (
      where allocation.state = 'declined'
    )::integer,
    pg_catalog.count(*) filter (
      where allocation.state = 'cancelled'
    )::integer
  into
    total_count,
    pending_count,
    effective_accepted_count,
    historical_accepted_count,
    reversed_effect_count,
    declined_count,
    cancelled_count
  from public.settlement_allocations as allocation
  left join public.settlement_allocation_reversals as reversal
    on reversal.settlement_allocation_id = allocation.id
  where allocation.settlement_payment_id = target_payment_id;

  if total_count = 0 then
    raise exception using
      message = 'settlement_has_no_allocations',
      errcode = 'P0001';
  elsif pending_count > 0 and effective_accepted_count = 0 then
    next_status := 'pending';
  elsif pending_count > 0 and effective_accepted_count > 0 then
    next_status := 'partially_confirmed';
  elsif effective_accepted_count = total_count then
    next_status := 'confirmed';
  elsif cancelled_count = total_count then
    next_status := 'cancelled';
  elsif declined_count = total_count then
    next_status := 'declined';
  elsif historical_accepted_count = total_count
        and reversed_effect_count = total_count then
    next_status := 'reversed';
  else
    next_status := 'mixed_closed';
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

create or replace function public.respond_to_settlement(
  target_allocation_id uuid,
  response text,
  expected_payment_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  payment_id uuid;
  payment_row public.settlement_payments%rowtype;
  allocation_row public.settlement_allocations%rowtype;
  next_status text;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception using message = 'invalid_response', errcode = 'P0001';
  end if;

  select allocation.settlement_payment_id
    into payment_id
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id;

  if payment_id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;

  select *
    into payment_row
  from public.settlement_payments
  where id = payment_id
  for update;

  select *
    into allocation_row
  from public.settlement_allocations
  where id = target_allocation_id
    and settlement_payment_id = payment_row.id
  for update;

  if allocation_row.id is null then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;
  if allocation_row.creditor_participant_id <> actor then
    raise exception using
      message = 'allocation_write_denied',
      errcode = 'P0001';
  end if;

  if allocation_row.state = response then
    return pg_catalog.jsonb_build_object(
      'allocation_state', allocation_row.state,
      'payment_status', payment_row.status,
      'payment_version', payment_row.version
    );
  end if;
  if allocation_row.state <> 'pending' then
    raise exception using
      message = 'settlement_response_conflict',
      errcode = 'P0001';
  end if;
  if expected_payment_version is null
     or expected_payment_version <> payment_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.settlement_allocations
  set state = response, responded_at = pg_catalog.now()
  where id = allocation_row.id;

  next_status := public.recompute_settlement_status(payment_row.id);
  next_version := payment_row.version + 1;
  update public.settlement_payments
  set version = next_version
  where id = payment_row.id;

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    payment_row.id,
    'settlement.allocation_' || response,
    pg_catalog.jsonb_build_object(
      'allocation_id', allocation_row.id,
      'previous_version', payment_row.version,
      'version', next_version,
      'status', next_status
    )
  );

  return pg_catalog.jsonb_build_object(
    'allocation_state', response,
    'payment_status', next_status,
    'payment_version', next_version
  );
end;
$$;

create or replace function public.cancel_pending_settlement_allocation(
  target_allocation_id uuid,
  expected_payment_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  payment_id uuid;
  payment_row public.settlement_payments%rowtype;
  allocation_row public.settlement_allocations%rowtype;
  next_status text;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;

  select allocation.settlement_payment_id
    into payment_id
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id;

  if payment_id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;

  select *
    into payment_row
  from public.settlement_payments
  where id = payment_id
  for update;

  select *
    into allocation_row
  from public.settlement_allocations
  where id = target_allocation_id
    and settlement_payment_id = payment_row.id
  for update;

  if allocation_row.id is null then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;
  if payment_row.debtor_participant_id <> actor then
    raise exception using
      message = 'settlement_cancel_denied',
      errcode = 'P0001';
  end if;

  if allocation_row.state = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'allocation_state', allocation_row.state,
      'payment_status', payment_row.status,
      'payment_version', payment_row.version
    );
  end if;
  if allocation_row.state <> 'pending' then
    raise exception using
      message = 'allocation_not_pending',
      errcode = 'P0001';
  end if;
  if expected_payment_version is null
     or expected_payment_version <> payment_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.settlement_allocations
  set state = 'cancelled', responded_at = pg_catalog.now()
  where id = allocation_row.id;

  next_status := public.recompute_settlement_status(payment_row.id);
  next_version := payment_row.version + 1;
  update public.settlement_payments
  set version = next_version
  where id = payment_row.id;

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    payment_row.id,
    'settlement.allocation_cancelled',
    pg_catalog.jsonb_build_object(
      'allocation_id', allocation_row.id,
      'previous_version', payment_row.version,
      'version', next_version,
      'status', next_status
    )
  );

  return pg_catalog.jsonb_build_object(
    'allocation_state', 'cancelled',
    'payment_status', next_status,
    'payment_version', next_version
  );
end;
$$;

create or replace function public.reverse_settlement_allocation(
  reversal_request_id uuid,
  target_allocation_id uuid,
  expected_payment_version integer,
  reversal_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  payment_id uuid;
  payment_row public.settlement_payments%rowtype;
  allocation_row public.settlement_allocations%rowtype;
  creditor_kind text;
  existing_reversal public.settlement_allocation_reversals%rowtype;
  reversal_id uuid;
  next_status text;
  next_version integer;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if reversal_request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;

  select allocation.settlement_payment_id
    into payment_id
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id;

  if payment_id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;

  select *
    into payment_row
  from public.settlement_payments
  where id = payment_id
  for update;

  select *
    into allocation_row
  from public.settlement_allocations
  where id = target_allocation_id
    and settlement_payment_id = payment_row.id
  for update;

  if allocation_row.id is null then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'tabby.settlement.reversal:' || actor::text || ':'
        || reversal_request_id::text,
      0
    )
  );

  select *
    into existing_reversal
  from public.settlement_allocation_reversals as reversal
  where reversal.reversed_by = actor
    and reversal.client_request_id = reversal_request_id;

  if existing_reversal.id is not null then
    if existing_reversal.settlement_allocation_id <> allocation_row.id
       or existing_reversal.amount_minor <> allocation_row.amount_minor
       or existing_reversal.reason is distinct from
          nullif(pg_catalog.btrim(reversal_reason), '') then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return pg_catalog.jsonb_build_object(
      'reversal_id', existing_reversal.id,
      'payment_status', payment_row.status,
      'payment_version', payment_row.version
    );
  end if;

  select participant.kind
    into creditor_kind
  from public.participants as participant
  where participant.id = allocation_row.creditor_participant_id;

  if not (
    (creditor_kind = 'account'
      and allocation_row.creditor_participant_id = actor)
    or (creditor_kind = 'manual'
      and payment_row.debtor_participant_id = actor)
  ) then
    raise exception using
      message = 'settlement_reversal_denied',
      errcode = 'P0001';
  end if;
  if allocation_row.state <> 'accepted' then
    raise exception using
      message = 'allocation_not_accepted',
      errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.settlement_allocation_reversals as reversal
    where reversal.settlement_allocation_id = allocation_row.id
  ) then
    raise exception using
      message = 'allocation_already_reversed',
      errcode = 'P0001';
  end if;
  if expected_payment_version is null
     or expected_payment_version <> payment_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  insert into public.settlement_allocation_reversals(
    client_request_id,
    settlement_allocation_id,
    reversed_by,
    amount_minor,
    reason
  )
  values (
    reversal_request_id,
    allocation_row.id,
    actor,
    allocation_row.amount_minor,
    nullif(pg_catalog.btrim(reversal_reason), '')
  )
  returning id into reversal_id;

  next_status := public.recompute_settlement_status(payment_row.id);
  next_version := payment_row.version + 1;
  update public.settlement_payments
  set version = next_version
  where id = payment_row.id;

  insert into public.financial_events(
    actor_participant_id,
    settlement_payment_id,
    event_type,
    safe_diff
  )
  values (
    actor,
    payment_row.id,
    'settlement.allocation_reversed',
    pg_catalog.jsonb_build_object(
      'allocation_id', allocation_row.id,
      'reversal_id', reversal_id,
      'amount_minor', allocation_row.amount_minor,
      'previous_version', payment_row.version,
      'version', next_version,
      'status', next_status
    )
  );

  return pg_catalog.jsonb_build_object(
    'reversal_id', reversal_id,
    'payment_status', next_status,
    'payment_version', next_version
  );
end;
$$;

-- Internal writers and invariant checks are never client-callable.
revoke all on function private.lock_expense_target(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_reconciled_expense_payload(
  bigint, uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function private.insert_expense_financial_rows(
  uuid, uuid, text, uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function private.direct_change_payload_fingerprint(
  uuid, integer, text, text, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function private.direct_revision_chain_is_consistent(uuid)
  from public, anon, authenticated;
revoke all on function private.assert_direct_change_invariants(uuid)
  from public, anon, authenticated;

-- Retire every unsafe Phase 4 overload after compatible guarded replacements
-- exist. PostgreSQL overloads remain separate privileges, so revoke and drop
-- each obsolete signature explicitly.
revoke all on function public.void_expense(uuid)
  from public, anon, authenticated;
revoke all on function public.respond_to_direct_expense(uuid, text)
  from public, anon, authenticated;
revoke all on function public.respond_to_settlement(uuid, text)
  from public, anon, authenticated;
revoke all on function public.reverse_settlement_allocation(uuid)
  from public, anon, authenticated;

drop function public.void_expense(uuid);
drop function public.respond_to_direct_expense(uuid, text);
drop function public.respond_to_settlement(uuid, text);
drop function public.reverse_settlement_allocation(uuid);

revoke all on function public.propose_direct_expense_change(
  uuid, uuid, integer, text, text, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function public.respond_to_direct_expense_change(
  uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.cancel_direct_expense_change(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.correct_space_expense(
  uuid, uuid, integer, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function public.cancel_expense(uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.restore_owner_local_expense(uuid, integer)
  from public, anon, authenticated;
revoke all on function public.update_expense_metadata(
  uuid, text, text, date, integer
) from public, anon, authenticated;
revoke all on function public.replace_expense_financials(
  uuid, integer, bigint, text, uuid[], bigint[], bigint[]
) from public, anon, authenticated;
revoke all on function public.respond_to_direct_expense(
  uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.recompute_settlement_status(uuid)
  from public, anon, authenticated;
revoke all on function public.respond_to_settlement(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.cancel_pending_settlement_allocation(
  uuid, integer
) from public, anon, authenticated;
revoke all on function public.reverse_settlement_allocation(
  uuid, uuid, integer, text
) from public, anon, authenticated;

grant execute on function public.propose_direct_expense_change(
  uuid, uuid, integer, text, text, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) to authenticated;
grant execute on function public.respond_to_direct_expense_change(
  uuid, text, integer
) to authenticated;
grant execute on function public.cancel_direct_expense_change(uuid, integer)
  to authenticated;
grant execute on function public.correct_space_expense(
  uuid, uuid, integer, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) to authenticated;
grant execute on function public.cancel_expense(uuid, integer, text)
  to authenticated;
grant execute on function public.restore_owner_local_expense(uuid, integer)
  to authenticated;
grant execute on function public.update_expense_metadata(
  uuid, text, text, date, integer
) to authenticated;
grant execute on function public.replace_expense_financials(
  uuid, integer, bigint, text, uuid[], bigint[], bigint[]
) to authenticated;
grant execute on function public.respond_to_direct_expense(
  uuid, text, integer
) to authenticated;
grant execute on function public.respond_to_settlement(uuid, text, integer)
  to authenticated;
grant execute on function public.cancel_pending_settlement_allocation(
  uuid, integer
) to authenticated;
grant execute on function public.reverse_settlement_allocation(
  uuid, uuid, integer, text
) to authenticated;

comment on function public.propose_direct_expense_change(
  uuid, uuid, integer, text, text, bigint, text, text, text, date,
  uuid[], bigint[], bigint[]
) is 'Proposes a confirmed Direct correction or cancellation without changing financial effect.';
comment on function public.respond_to_direct_expense_change(
  uuid, text, integer
) is 'Records required Participant authority and atomically finalizes Direct change requests.';
comment on function public.cancel_pending_settlement_allocation(
  uuid, integer
) is 'Debtor-only versioned cancellation of a still-pending settlement allocation.';
comment on function public.reverse_settlement_allocation(
  uuid, uuid, integer, text
) is 'Records one immutable full reversal fact without mutating accepted allocation history.';
comment on function public.restore_owner_local_expense(uuid, integer)
  is 'Restores only creator-cancelled Personal or exact all-manual Direct expenses with no shared authority history.';

-- Wrap the Phase 4 settlement proposer so actor/request retries are checked
-- against the complete semantic payload instead of silently accepting a
-- reused request ID with different money.
alter function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) rename to phase4_propose_settlement_unsafe;

revoke all on function public.phase4_propose_settlement_unsafe(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) from public, anon, authenticated;

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
  existing_payment public.settlement_payments%rowtype;
  allocation_total numeric;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if request_id is null then
    raise exception using message = 'invalid_request_id', errcode = 'P0001';
  end if;
  if settlement_scope not in ('direct', 'space') then
    raise exception using
      message = 'invalid_settlement_scope',
      errcode = 'P0001';
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
    raise exception using
      message = 'invalid_payment_date',
      errcode = 'P0001';
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

  select coalesce(pg_catalog.sum(amount.value), 0)
    into allocation_total
  from pg_catalog.unnest(allocation_amounts) as amount(value);
  if allocation_total <> total_amount_minor then
    raise exception using
      message = 'settlement_does_not_reconcile',
      errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor::text || ':' || request_id::text, 0)
  );

  select *
    into existing_payment
  from public.settlement_payments as payment
  where payment.debtor_participant_id = actor
    and payment.client_request_id = request_id;

  if existing_payment.id is not null then
    if existing_payment.scope <> settlement_scope
       or existing_payment.space_id is distinct from target_space_id
       or existing_payment.currency <> pg_catalog.upper(currency_code)
       or existing_payment.amount_minor <> total_amount_minor
       or existing_payment.payment_date <> payment_date
       or existing_payment.note is distinct from
          nullif(pg_catalog.btrim(settlement_note), '')
       or (
         select pg_catalog.count(*)
         from public.settlement_allocations as allocation
         where allocation.settlement_payment_id = existing_payment.id
       ) <> pg_catalog.cardinality(creditor_ids)
       or exists (
         select 1
         from pg_catalog.unnest(creditor_ids)
           with ordinality as supplied_creditor(creditor_id, item_order)
         join pg_catalog.unnest(allocation_amounts)
           with ordinality as supplied_amount(amount_minor, item_order)
           using (item_order)
         where not exists (
           select 1
           from public.settlement_allocations as allocation
           where allocation.settlement_payment_id = existing_payment.id
             and allocation.creditor_participant_id =
               supplied_creditor.creditor_id
             and allocation.amount_minor = supplied_amount.amount_minor
         )
       ) then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return existing_payment.id;
  end if;

  return public.phase4_propose_settlement_unsafe(
    request_id,
    settlement_scope,
    target_space_id,
    currency_code,
    total_amount_minor,
    payment_date,
    creditor_ids,
    allocation_amounts,
    settlement_note
  );
end;
$$;

revoke all on function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) from public, anon, authenticated;
grant execute on function public.propose_settlement(
  uuid, text, uuid, text, bigint, date, uuid[], bigint[], text
) to authenticated;
