-- Owner-only reclassification of personal / unconfirmed direct records.
-- Shares and scope change atomically; wallet funding facts are not recreated.
begin;
create table if not exists private.expense_edit_history (
  expense_id uuid not null references public.expenses(id),
  version integer not null,
  actor_participant_id uuid not null references public.participants(id),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (expense_id, version)
);
revoke all on private.expense_edit_history from public, anon, authenticated;
create or replace function public.reclassify_expense_financials(
  target_expense_id uuid,
  expected_version integer,
  next_scope text,
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

  if next_scope is null or next_scope not in ('personal', 'direct') then
    raise exception using message = 'invalid_expense_scope', errcode = 'P0001';
  end if;
  -- Existing correction chains retain their original authority and scope.
  if expense_row.corrects_expense_id is not null or exists (
    select 1 from public.direct_expense_change_requests r
    where r.target_expense_id = expense_row.id or r.replacement_expense_id = expense_row.id
  ) then
    raise exception using message = 'scope_correction_history_locked', errcode = 'P0001';
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
  end if;
  if next_scope = 'personal' then
    if pg_catalog.cardinality(participant_ids) <> 1 then
      raise exception using message = 'invalid_personal_expense', errcode = 'P0001';
    end if;
  else
    if pg_catalog.cardinality(participant_ids) < 2 then
      raise exception using message = 'invalid_direct_expense', errcode = 'P0001';
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

  end if;
  -- Private append-only snapshots preserve removed manual shares and identities.
  -- No client is granted access to this table.
  insert into private.expense_edit_history (expense_id, version, actor_participant_id, snapshot)
  values (expense_row.id, expense_row.version, actor, pg_catalog.jsonb_build_object(
    'expense', pg_catalog.to_jsonb(expense_row),
    'participations', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)), '[]'::jsonb) from public.expense_participations p where p.expense_id = expense_row.id),
    'contributions', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)), '[]'::jsonb) from public.payer_contributions p where p.expense_id = expense_row.id),
    'shares', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p)), '[]'::jsonb) from public.expense_shares p where p.expense_id = expense_row.id)
  ));

  delete from public.expense_participations
  where expense_id = expense_row.id;

  perform private.insert_expense_financial_rows(
    expense_row.id,
    actor,
    next_scope,
    participant_ids,
    contribution_amounts,
    share_amounts
  );

  next_version := expense_row.version + 1;
  update public.expenses
  set
    scope = next_scope,
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
      'previous_scope', expense_row.scope,
      'scope', next_scope,
      'direct_confirmations_reset', next_scope = 'direct'
    )
  );

  return next_version;
end;
$$;

revoke all on function public.reclassify_expense_financials(uuid, integer, text, bigint, text, uuid[], bigint[], bigint[]) from public, anon;
grant execute on function public.reclassify_expense_financials(uuid, integer, text, bigint, text, uuid[], bigint[], bigint[]) to authenticated;
notify pgrst, 'reload schema';
commit;
