-- Phase 6G: owner-private travel affiliations for Canonical Expenses.
--
-- An affiliation is only a personal classification layer. It never changes
-- an Expense, Space membership, sharing balance, funding, or read authority.

create table public.personal_expense_affiliations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  label text not null check (
    pg_catalog.char_length(pg_catalog.btrim(label)) between 1 and 80
  ),
  archived_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_participant_id, expense_id)
);

create index personal_expense_affiliations_owner_active_idx
  on public.personal_expense_affiliations(
    owner_participant_id,
    archived_at,
    updated_at desc
  );

create index personal_expense_affiliations_owner_label_idx
  on public.personal_expense_affiliations(
    owner_participant_id,
    label,
    archived_at
  );

create trigger personal_expense_affiliations_set_updated_at
  before update on public.personal_expense_affiliations
  for each row execute function public.set_updated_at();

create or replace function private.validate_personal_expense_affiliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.participants as participant
    where participant.id = new.owner_participant_id
      and participant.kind = 'account'
  ) then
    raise exception using
      message = 'account_participant_required',
      errcode = 'P0001';
  end if;

  new.label := pg_catalog.btrim(new.label);

  if pg_catalog.char_length(new.label) not between 1 and 80 then
    raise exception using
      message = 'invalid_trip_label',
      errcode = 'P0001';
  end if;

  if not private.can_read_expense(
    new.expense_id,
    new.owner_participant_id
  ) then
    raise exception using
      message = 'expense_not_visible',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger personal_expense_affiliations_validate
  before insert or update of owner_participant_id, expense_id, label
  on public.personal_expense_affiliations
  for each row
  execute function private.validate_personal_expense_affiliation();

create or replace function public.upsert_personal_expense_affiliation(
  target_expense_id uuid,
  trip_label text,
  expected_version integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  normalized_label text := pg_catalog.btrim(trip_label);
  affiliation_row public.personal_expense_affiliations%rowtype;
begin
  if target_expense_id is null then
    raise exception using message = 'expense_required', errcode = 'P0001';
  end if;
  if normalized_label is null
     or pg_catalog.char_length(normalized_label) not between 1 and 80 then
    raise exception using message = 'invalid_trip_label', errcode = 'P0001';
  end if;
  if not private.can_read_expense(target_expense_id, actor) then
    raise exception using message = 'expense_not_visible', errcode = 'P0001';
  end if;

  perform 1
  from public.expenses as expense
  where expense.id = target_expense_id
  for share;

  select *
    into affiliation_row
  from public.personal_expense_affiliations as affiliation
  where affiliation.owner_participant_id = actor
    and affiliation.expense_id = target_expense_id
  for update;

  if affiliation_row.id is null then
    if expected_version is not null then
      raise exception using message = 'version_conflict', errcode = 'P0001';
    end if;

    insert into public.personal_expense_affiliations(
      owner_participant_id,
      expense_id,
      label
    )
    values (
      actor,
      target_expense_id,
      normalized_label
    )
    returning id into affiliation_row.id;

    return affiliation_row.id;
  end if;

  if affiliation_row.archived_at is null
     and affiliation_row.label = normalized_label then
    return affiliation_row.id;
  end if;

  if expected_version is null
     or expected_version <> affiliation_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.personal_expense_affiliations as affiliation
  set label = normalized_label,
    archived_at = null,
    version = affiliation.version + 1
  where affiliation.id = affiliation_row.id;

  return affiliation_row.id;
end;
$$;

create or replace function public.archive_personal_expense_affiliation(
  target_affiliation_id uuid,
  expected_version integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  affiliation_row public.personal_expense_affiliations%rowtype;
begin
  select *
    into affiliation_row
  from public.personal_expense_affiliations as affiliation
  where affiliation.id = target_affiliation_id
    and affiliation.owner_participant_id = actor
  for update;

  if affiliation_row.id is null then
    raise exception using message = 'affiliation_not_found', errcode = 'P0001';
  end if;

  if affiliation_row.archived_at is not null then
    return affiliation_row.id;
  end if;

  if expected_version is null
     or expected_version <> affiliation_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;

  update public.personal_expense_affiliations as affiliation
  set archived_at = pg_catalog.now(),
    version = affiliation.version + 1
  where affiliation.id = affiliation_row.id;

  return affiliation_row.id;
end;
$$;

alter table public.personal_expense_affiliations enable row level security;

create policy personal_expense_affiliations_select_owner
  on public.personal_expense_affiliations for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
    and private.can_read_expense(
      expense_id,
      public.current_participant_id()
    )
  );

revoke all on table public.personal_expense_affiliations
  from public, anon, authenticated;
grant select on table public.personal_expense_affiliations to authenticated;

revoke all on function private.validate_personal_expense_affiliation()
  from public, anon, authenticated;
revoke all on function public.upsert_personal_expense_affiliation(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.archive_personal_expense_affiliation(uuid, integer)
  from public, anon, authenticated;

grant execute on function public.upsert_personal_expense_affiliation(uuid, text, integer)
  to authenticated;
grant execute on function public.archive_personal_expense_affiliation(uuid, integer)
  to authenticated;

comment on table public.personal_expense_affiliations is
  'Owner-private travel labels over already-readable Canonical Expenses; never an authorization source.';
comment on function public.upsert_personal_expense_affiliation(uuid, text, integer) is
  'Creates, renames, or reactivates one owner-private travel label after authoritative expense visibility checks.';
comment on function public.archive_personal_expense_affiliation(uuid, integer) is
  'Archives a private travel label without modifying or deleting the Canonical Expense.';
