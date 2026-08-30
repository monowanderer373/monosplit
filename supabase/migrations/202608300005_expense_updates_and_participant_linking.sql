-- Material expense correction and consent-based historical manual-person linking.

create table if not exists public.participant_link_requests (
  id uuid primary key default gen_random_uuid(),
  manual_participant_id uuid not null references public.participants(id),
  target_participant_id uuid not null references public.participants(id),
  requested_by uuid not null references public.participants(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint participant_link_manual_target_unique
    unique (manual_participant_id, target_participant_id)
);

create index if not exists participant_link_target_status_idx
  on public.participant_link_requests(target_participant_id, status, created_at desc);
create unique index if not exists participant_link_one_active_per_manual_idx
  on public.participant_link_requests(manual_participant_id)
  where status in ('pending', 'accepted');

alter table public.participant_link_requests enable row level security;

drop policy if exists participant_link_requests_select_involved
  on public.participant_link_requests;
create policy participant_link_requests_select_involved
  on public.participant_link_requests for select to authenticated
  using (
    requested_by = public.current_participant_id()
    or target_participant_id = public.current_participant_id()
  );

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
    raise exception 'not_authenticated';
  end if;

  select * into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null or expense_row.status <> 'active' then
    raise exception 'active_expense_not_found';
  end if;
  if expected_version is null or expected_version <> expense_row.version then
    raise exception 'version_conflict';
  end if;
  if next_occurred_on is null then
    raise exception 'invalid_expense_date';
  end if;
  if expense_row.created_by <> actor
     and not (
       expense_row.scope = 'space'
       and private.space_role(expense_row.space_id, actor) = 'owner'
     ) then
    raise exception 'expense_write_denied';
  end if;

  next_version := expense_row.version + 1;
  update public.expenses
  set
    description = nullif(pg_catalog.btrim(next_description), ''),
    category = coalesce(nullif(pg_catalog.btrim(next_category), ''), 'Other'),
    occurred_on = next_occurred_on,
    version = next_version
  where id = target_expense_id;

  insert into public.financial_events(actor_participant_id, expense_id, event_type, safe_diff)
  values (
    actor,
    target_expense_id,
    'expense.metadata_updated',
    pg_catalog.jsonb_build_object('previous_version', expense_row.version, 'version', next_version)
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
  item_participant uuid;
  participant_name text;
  participant_kind text;
  participation_id uuid;
  item_state text;
  item_tracking text;
  contribution_total numeric;
  share_total numeric;
  next_version integer;
begin
  if actor is null then
    raise exception 'not_authenticated';
  end if;

  select * into expense_row
  from public.expenses
  where id = target_expense_id
  for update;

  if expense_row.id is null or expense_row.status <> 'active' then
    raise exception 'active_expense_not_found';
  end if;
  if expected_version is null or expected_version <> expense_row.version then
    raise exception 'version_conflict';
  end if;
  if expense_row.created_by <> actor
     and not (
       expense_row.scope = 'space'
       and private.space_role(expense_row.space_id, actor) = 'owner'
     ) then
    raise exception 'expense_write_denied';
  end if;
  if next_total_minor is null
     or next_total_minor <= 0
     or next_total_minor > 9007199254740991 then
    raise exception 'invalid_amount';
  end if;
  if next_currency is null or pg_catalog.upper(next_currency) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;
  if participant_ids is null
     or contribution_amounts is null
     or share_amounts is null
     or pg_catalog.cardinality(participant_ids) = 0
     or pg_catalog.cardinality(participant_ids) <> pg_catalog.cardinality(contribution_amounts)
     or pg_catalog.cardinality(participant_ids) <> pg_catalog.cardinality(share_amounts) then
    raise exception 'invalid_participant_arrays';
  end if;
  if pg_catalog.cardinality(participant_ids) <> (
    select pg_catalog.count(distinct value)
    from pg_catalog.unnest(participant_ids) as value
  ) then
    raise exception 'duplicate_participant';
  end if;
  if exists (
    select 1 from pg_catalog.unnest(contribution_amounts) as value
    where value is null or value < 0
  ) or exists (
    select 1 from pg_catalog.unnest(share_amounts) as value
    where value is null or value < 0
  ) then
    raise exception 'negative_amount';
  end if;

  select coalesce(pg_catalog.sum(value), 0)
    into contribution_total from pg_catalog.unnest(contribution_amounts) as value;
  select coalesce(pg_catalog.sum(value), 0)
    into share_total from pg_catalog.unnest(share_amounts) as value;
  if contribution_total <> next_total_minor or share_total <> next_total_minor then
    raise exception 'expense_does_not_reconcile';
  end if;

  if expense_row.scope = 'personal' then
    if pg_catalog.cardinality(participant_ids) <> 1 or participant_ids[1] <> actor then
      raise exception 'invalid_personal_expense';
    end if;
  elsif expense_row.scope = 'space' then
    if exists (
      select 1
      from pg_catalog.unnest(participant_ids) as value
      where not private.is_active_space_member(expense_row.space_id, value)
        and not exists (
          select 1
          from public.participants as participant
          join public.space_members as member
            on member.participant_id = participant.id
          where participant.id = value
            and participant.kind = 'manual'
            and member.space_id = expense_row.space_id
            and member.removed_at is null
        )
    ) then
      raise exception 'participant_not_in_space';
    end if;
  else
    if not actor = any(participant_ids) then
      raise exception 'invalid_direct_expense';
    end if;
    if exists (
      select 1
      from pg_catalog.unnest(participant_ids) as value
      join public.participants as participant on participant.id = value
      where value <> actor
        and (
          (participant.kind = 'account' and not private.are_friends(actor, value))
          or (
            participant.kind = 'manual'
            and participant.created_by is distinct from (select auth.uid())
          )
        )
    ) then
      raise exception 'direct_participant_not_friend';
    end if;
  end if;

  delete from public.expense_participations where expense_id = target_expense_id;

  for item_index in 1..pg_catalog.cardinality(participant_ids)
  loop
    item_participant := participant_ids[item_index];
    select display_name, kind
      into participant_name, participant_kind
    from public.participants
    where id = item_participant;

    if participant_name is null then
      raise exception 'participant_not_found';
    end if;

    if expense_row.scope in ('personal', 'space') or item_participant = actor then
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
      expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
    )
    values (
      target_expense_id, item_participant, participant_name, item_index - 1, item_state, item_tracking
    )
    returning id into participation_id;

    if contribution_amounts[item_index] > 0 then
      insert into public.payer_contributions(expense_participation_id, expense_id, amount_minor)
      values (participation_id, target_expense_id, contribution_amounts[item_index]);
    end if;
    insert into public.expense_shares(expense_participation_id, expense_id, amount_minor)
    values (participation_id, target_expense_id, share_amounts[item_index]);
  end loop;

  next_version := expense_row.version + 1;
  update public.expenses
  set
    total_minor = next_total_minor,
    participant_count = pg_catalog.cardinality(participant_ids),
    currency = pg_catalog.upper(next_currency),
    version = next_version
  where id = target_expense_id;

  insert into public.financial_events(actor_participant_id, expense_id, event_type, safe_diff)
  values (
    actor,
    target_expense_id,
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

create or replace function public.request_manual_participant_link(
  manual_participant_id uuid,
  target_participant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  manual_row public.participants%rowtype;
  target_row public.participants%rowtype;
  request_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select * into manual_row
  from public.participants
  where id = manual_participant_id
  for update;
  select * into target_row from public.participants where id = target_participant_id;
  if manual_row.id is null or manual_row.kind <> 'manual' then
    raise exception 'manual_participant_not_found';
  end if;
  if manual_row.created_by <> (select auth.uid()) then
    raise exception 'manual_participant_write_denied';
  end if;
  if target_row.id is null or target_row.kind <> 'account' then
    raise exception 'target_account_not_found';
  end if;
  if not private.are_friends(actor, target_participant_id) then
    raise exception 'target_not_friend';
  end if;
  if exists (
    select 1
    from public.participant_link_requests
    where participant_link_requests.manual_participant_id = request_manual_participant_link.manual_participant_id
      and status in ('pending', 'accepted')
      and participant_link_requests.target_participant_id <> request_manual_participant_link.target_participant_id
  ) then
    raise exception 'manual_participant_link_already_active';
  end if;
  select id into request_id
  from public.participant_link_requests
  where participant_link_requests.manual_participant_id = request_manual_participant_link.manual_participant_id
    and participant_link_requests.target_participant_id = request_manual_participant_link.target_participant_id
    and status in ('pending', 'accepted');
  if request_id is not null then
    return request_id;
  end if;

  insert into public.participant_link_requests(
    manual_participant_id, target_participant_id, requested_by, status, responded_at
  )
  values (
    request_manual_participant_link.manual_participant_id,
    request_manual_participant_link.target_participant_id,
    actor,
    'pending',
    null
  )
  on conflict on constraint participant_link_manual_target_unique
  do update set status = 'pending', responded_at = null, created_at = now()
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.respond_manual_participant_link(
  target_request_id uuid,
  response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  request_row public.participant_link_requests%rowtype;
  linked_expense_ids uuid[];
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception 'invalid_response';
  end if;

  select * into request_row
  from public.participant_link_requests
  where id = target_request_id
  for update;

  if request_row.id is null or request_row.status <> 'pending' then
    raise exception 'pending_link_request_not_found';
  end if;
  if request_row.target_participant_id <> actor then
    raise exception 'link_request_write_denied';
  end if;

  if response = 'accepted' then
    perform 1
    from public.participants
    where id = request_row.manual_participant_id
    for update;

    if exists (
      select 1
      from public.expense_participations as manual_entry
      join public.expense_participations as account_entry
        on account_entry.expense_id = manual_entry.expense_id
       and account_entry.participant_id = request_row.target_participant_id
      where manual_entry.participant_id = request_row.manual_participant_id
    ) then
      raise exception 'expense_participant_link_conflict';
    end if;

    select coalesce(pg_catalog.array_agg(participation.expense_id), array[]::uuid[])
      into linked_expense_ids
    from public.expense_participations as participation
    join public.expenses as expense on expense.id = participation.expense_id
    where participation.participant_id = request_row.manual_participant_id
      and (
        expense.scope = 'direct'
        or (
          expense.scope = 'space'
          and private.is_active_space_member(expense.space_id, request_row.target_participant_id)
        )
      );

    update public.expense_participations as participation
    set
      participant_id = request_row.target_participant_id,
      tracking_mode = 'tracked',
      state = case
        when expense.scope = 'direct' then 'pending'
        else 'accepted'
      end
    from public.expenses as expense
    where participation.expense_id = expense.id
      and participation.participant_id = request_row.manual_participant_id
      and participation.expense_id = any(linked_expense_ids);

    update public.space_members
    set removed_at = now()
    where participant_id = request_row.manual_participant_id
      and removed_at is null;

    insert into public.financial_events(actor_participant_id, expense_id, event_type, safe_diff)
    select
      actor,
      participation.expense_id,
      'expense.manual_participant_linked',
      pg_catalog.jsonb_build_object(
        'manual_participant_id', request_row.manual_participant_id,
        'participant_id', request_row.target_participant_id,
        'direct_confirmation_required', expense.scope = 'direct'
      )
    from public.expense_participations as participation
    join public.expenses as expense on expense.id = participation.expense_id
    where participation.participant_id = request_row.target_participant_id
      and participation.expense_id = any(linked_expense_ids);
  end if;

  update public.participant_link_requests
  set status = response, responded_at = now()
  where id = target_request_id;
end;
$$;

revoke all on function public.update_expense_metadata(uuid, text, text, date, integer) from public;
revoke all on function public.replace_expense_financials(uuid, integer, bigint, text, uuid[], bigint[], bigint[]) from public;
revoke all on function public.request_manual_participant_link(uuid, uuid) from public;
revoke all on function public.respond_manual_participant_link(uuid, text) from public;

grant execute on function public.update_expense_metadata(uuid, text, text, date, integer) to authenticated;
grant execute on function public.replace_expense_financials(uuid, integer, bigint, text, uuid[], bigint[], bigint[]) to authenticated;
grant execute on function public.request_manual_participant_link(uuid, uuid) to authenticated;
grant execute on function public.respond_manual_participant_link(uuid, text) to authenticated;
