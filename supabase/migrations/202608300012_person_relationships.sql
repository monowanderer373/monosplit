-- Owner-scoped Person identity layered over immutable financial Participants.
-- This migration is additive only: it never rewrites financial principals,
-- trust state, settlements, or Space membership.

create table if not exists public.person_relationships (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  display_name text not null
    check (char_length(pg_catalog.btrim(display_name)) between 1 and 100),
  linked_participant_id uuid references public.participants(id),
  merged_into_person_id uuid references public.person_relationships(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    linked_participant_id is null
    or linked_participant_id <> owner_participant_id
  ),
  check (
    merged_into_person_id is null
    or merged_into_person_id <> id
  )
);

create table if not exists public.person_manual_participants (
  person_id uuid not null
    references public.person_relationships(id) on delete cascade,
  manual_participant_id uuid not null references public.participants(id),
  is_primary boolean not null default true,
  attached_at timestamptz not null default now(),
  primary key (person_id, manual_participant_id),
  unique (manual_participant_id)
);

alter table public.participant_link_requests
  add column if not exists person_relationship_id uuid
  references public.person_relationships(id);

create unique index if not exists person_relationships_owner_linked_active_idx
  on public.person_relationships(owner_participant_id, linked_participant_id)
  where linked_participant_id is not null
    and merged_into_person_id is null;
create index if not exists person_relationships_owner_updated_idx
  on public.person_relationships(owner_participant_id, updated_at desc);
create index if not exists person_relationships_merged_idx
  on public.person_relationships(merged_into_person_id)
  where merged_into_person_id is not null;
create unique index if not exists person_manual_one_primary_idx
  on public.person_manual_participants(person_id)
  where is_primary;
create index if not exists participant_link_person_status_idx
  on public.participant_link_requests(
    person_relationship_id,
    status,
    created_at desc
  );
create unique index if not exists participant_link_one_active_per_person_idx
  on public.participant_link_requests(person_relationship_id)
  where person_relationship_id is not null
    and status in ('pending', 'accepted');

create or replace function private.validate_person_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_kind text;
  linked_kind text;
  merge_owner uuid;
  merge_target uuid;
begin
  select participant.kind into owner_kind
  from public.participants as participant
  where participant.id = new.owner_participant_id;

  if owner_kind is distinct from 'account' then
    raise exception 'person_owner_must_be_account';
  end if;

  if new.linked_participant_id is not null then
    select participant.kind into linked_kind
    from public.participants as participant
    where participant.id = new.linked_participant_id;
    if linked_kind is distinct from 'account' then
      raise exception 'linked_participant_must_be_account';
    end if;
  end if;

  if new.merged_into_person_id is not null then
    select person.owner_participant_id, person.merged_into_person_id
      into merge_owner, merge_target
    from public.person_relationships as person
    where person.id = new.merged_into_person_id;
    if merge_owner is null then
      raise exception 'merge_target_not_found';
    end if;
    if merge_owner <> new.owner_participant_id then
      raise exception 'merge_target_owner_mismatch';
    end if;
    if merge_target is not null then
      raise exception 'merge_target_must_be_active';
    end if;
  end if;

  new.display_name := pg_catalog.btrim(new.display_name);
  return new;
end;
$$;

create or replace function private.validate_person_manual_attachment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  person_owner uuid;
  person_merged uuid;
  owner_auth_user uuid;
  manual_kind text;
  manual_creator uuid;
begin
  select person.owner_participant_id, person.merged_into_person_id
    into person_owner, person_merged
  from public.person_relationships as person
  where person.id = new.person_id;

  if person_owner is null then
    raise exception 'person_relationship_not_found';
  end if;
  if person_merged is not null then
    raise exception 'manual_attachment_person_must_be_active';
  end if;

  select participant.auth_user_id into owner_auth_user
  from public.participants as participant
  where participant.id = person_owner
    and participant.kind = 'account';

  select participant.kind, participant.created_by
    into manual_kind, manual_creator
  from public.participants as participant
  where participant.id = new.manual_participant_id;

  if manual_kind is distinct from 'manual' then
    raise exception 'manual_attachment_must_be_manual';
  end if;
  if owner_auth_user is null
     or manual_creator is distinct from owner_auth_user then
    raise exception 'manual_attachment_owner_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists person_relationships_validate
  on public.person_relationships;
create trigger person_relationships_validate
  before insert or update on public.person_relationships
  for each row execute function private.validate_person_relationship();

drop trigger if exists person_relationships_set_updated_at
  on public.person_relationships;
create trigger person_relationships_set_updated_at
  before update on public.person_relationships
  for each row execute function public.set_updated_at();

drop trigger if exists person_manual_participants_validate
  on public.person_manual_participants;
create trigger person_manual_participants_validate
  before insert or update on public.person_manual_participants
  for each row execute function private.validate_person_manual_attachment();

create or replace function private.ensure_linked_person_relationship(
  relationship_owner uuid,
  linked_account uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_name text;
  person_id uuid;
begin
  select participant.display_name into target_name
  from public.participants as participant
  where participant.id = linked_account
    and participant.kind = 'account';

  if target_name is null then
    raise exception 'linked_participant_must_be_account';
  end if;

  select person.id into person_id
  from public.person_relationships as person
  where person.owner_participant_id = relationship_owner
    and person.linked_participant_id = linked_account
    and person.merged_into_person_id is null
  for update;

  if person_id is null then
    insert into public.person_relationships(
      owner_participant_id,
      display_name,
      linked_participant_id
    )
    values (relationship_owner, target_name, linked_account)
    returning id into person_id;
  end if;

  return person_id;
end;
$$;

create or replace function private.ensure_established_friendship_people()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('accepted', 'archived', 'blocked') then
    perform private.ensure_linked_person_relationship(
      new.participant_low_id,
      new.participant_high_id
    );
    perform private.ensure_linked_person_relationship(
      new.participant_high_id,
      new.participant_low_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_ensure_established_people
  on public.friendships;
create trigger friendships_ensure_established_people
  after insert or update of status on public.friendships
  for each row execute function private.ensure_established_friendship_people();

-- Established identity survives capability changes. Pending invitations do not
-- establish identity.
select private.ensure_linked_person_relationship(
  friendship.participant_low_id,
  friendship.participant_high_id
)
from public.friendships as friendship
where friendship.status in ('accepted', 'archived', 'blocked');

select private.ensure_linked_person_relationship(
  friendship.participant_high_id,
  friendship.participant_low_id
)
from public.friendships as friendship
where friendship.status in ('accepted', 'archived', 'blocked');

-- Additive Manual Person backfill. Each Manual Participant gets a distinct
-- stable Person even when display names collide. Orphans are deliberately left
-- untouched.
do $$
declare
  manual_row record;
  person_id uuid;
begin
  for manual_row in
    select
      manual.id as manual_participant_id,
      manual.display_name,
      owner.id as owner_participant_id
    from public.participants as manual
    join public.participants as owner
      on owner.auth_user_id = manual.created_by
     and owner.kind = 'account'
    where manual.kind = 'manual'
      and not exists (
        select 1
        from public.person_manual_participants as mapping
        where mapping.manual_participant_id = manual.id
      )
    order by manual.created_at, manual.id
  loop
    insert into public.person_relationships(
      owner_participant_id,
      display_name
    )
    values (
      manual_row.owner_participant_id,
      manual_row.display_name
    )
    returning id into person_id;

    insert into public.person_manual_participants(
      person_id,
      manual_participant_id,
      is_primary
    )
    values (person_id, manual_row.manual_participant_id, true);
  end loop;
end;
$$;

update public.participant_link_requests as request
set person_relationship_id = mapping.person_id
from public.person_manual_participants as mapping
where request.person_relationship_id is null
  and mapping.manual_participant_id = request.manual_participant_id;

create or replace function public.create_manual_participant(display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  participant_id uuid;
  person_id uuid;
begin
  if actor is null
     or (select auth.uid()) is null then
    raise exception 'not_authenticated';
  end if;
  if char_length(pg_catalog.btrim(display_name)) not between 1 and 100 then
    raise exception 'invalid_display_name';
  end if;

  insert into public.participants(kind, display_name, created_by)
  values ('manual', pg_catalog.btrim(display_name), (select auth.uid()))
  returning id into participant_id;

  insert into public.person_relationships(
    owner_participant_id,
    display_name
  )
  values (actor, pg_catalog.btrim(display_name))
  returning id into person_id;

  insert into public.person_manual_participants(
    person_id,
    manual_participant_id,
    is_primary
  )
  values (person_id, participant_id, true);

  return participant_id;
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
  if private.space_role(target_space_id, actor)
     not in ('owner', 'full_access') then
    raise exception 'space_write_denied';
  end if;

  perform 1
  from public.spaces as space
  where space.id = target_space_id
  for update;
  if not found then
    raise exception 'space_not_found';
  end if;

  new_participant_id := public.create_manual_participant(display_name);

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

create or replace function public.create_manual_person(display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  manual_id uuid;
  person_id uuid;
begin
  manual_id := public.create_manual_participant(display_name);
  select mapping.person_id into person_id
  from public.person_manual_participants as mapping
  where mapping.manual_participant_id = manual_id;
  return person_id;
end;
$$;

create or replace function public.request_person_link(
  target_person_relationship_id uuid,
  target_participant_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  person_row public.person_relationships%rowtype;
  target_row public.participants%rowtype;
  manual_id uuid;
  request_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select * into person_row
  from public.person_relationships as person
  where person.id = target_person_relationship_id
  for update;

  if person_row.id is null
     or person_row.owner_participant_id <> actor
     or person_row.merged_into_person_id is not null then
    raise exception 'person_relationship_write_denied';
  end if;
  if person_row.linked_participant_id is not null then
    raise exception 'person_already_linked';
  end if;

  select mapping.manual_participant_id into manual_id
  from public.person_manual_participants as mapping
  where mapping.person_id = person_row.id
  order by mapping.is_primary desc, mapping.attached_at, mapping.manual_participant_id
  limit 1
  for update;
  if manual_id is null then
    raise exception 'person_manual_participant_not_found';
  end if;

  select * into target_row
  from public.participants as participant
  where participant.id = target_participant_id
  for update;
  if target_row.id is null or target_row.kind <> 'account' then
    raise exception 'target_account_not_found';
  end if;
  if not private.are_friends(actor, target_participant_id) then
    raise exception 'target_not_friend';
  end if;

  select request.id into request_id
  from public.participant_link_requests as request
  where request.person_relationship_id = person_row.id
    and request.target_participant_id =
      request_person_link.target_participant_id
    and request.status in ('pending', 'accepted')
  for update;
  if request_id is not null then
    return request_id;
  end if;

  if exists (
    select 1
    from public.participant_link_requests as request
    where request.person_relationship_id = person_row.id
      and request.status in ('pending', 'accepted')
  ) then
    raise exception 'person_link_already_active';
  end if;

  insert into public.participant_link_requests(
    person_relationship_id,
    manual_participant_id,
    target_participant_id,
    requested_by,
    status,
    responded_at
  )
  values (
    person_row.id,
    manual_id,
    request_person_link.target_participant_id,
    actor,
    'pending',
    null
  )
  on conflict on constraint participant_link_manual_target_unique
  do update set
    person_relationship_id = excluded.person_relationship_id,
    requested_by = excluded.requested_by,
    status = 'pending',
    responded_at = null,
    created_at = now()
  returning id into request_id;

  return request_id;
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
  person_id uuid;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;

  select person.id into person_id
  from public.person_manual_participants as mapping
  join public.person_relationships as person on person.id = mapping.person_id
  where mapping.manual_participant_id =
      request_manual_participant_link.manual_participant_id
    and person.owner_participant_id = actor
    and person.merged_into_person_id is null
  for update of person;

  if person_id is null then
    raise exception 'manual_participant_not_found';
  end if;

  return public.request_person_link(person_id, target_participant_id);
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
  person_row public.person_relationships%rowtype;
  target_kind text;
  existing_linked_person_id uuid;
  target_has_primary boolean;
begin
  if actor is null or not public.is_permanent_account() then
    raise exception 'permanent_account_required';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception 'invalid_response';
  end if;

  select * into request_row
  from public.participant_link_requests as request
  where request.id = target_request_id
  for update;

  if request_row.id is null then
    raise exception 'pending_link_request_not_found';
  end if;
  if request_row.target_participant_id <> actor then
    raise exception 'link_request_write_denied';
  end if;
  if request_row.status = response then
    return;
  end if;
  if request_row.status <> 'pending' then
    raise exception 'pending_link_request_not_found';
  end if;
  if request_row.person_relationship_id is null then
    raise exception 'person_link_request_unbound';
  end if;

  select * into person_row
  from public.person_relationships as person
  where person.id = request_row.person_relationship_id
  for update;
  if person_row.id is null
     or person_row.owner_participant_id <> request_row.requested_by
     or person_row.merged_into_person_id is not null then
    raise exception 'person_link_request_invalid';
  end if;
  perform 1
  from public.person_manual_participants as mapping
  where mapping.person_id = person_row.id
    and mapping.manual_participant_id =
      request_row.manual_participant_id
  for update;
  if not found then
    raise exception 'person_link_request_invalid';
  end if;

  select participant.kind into target_kind
  from public.participants as participant
  where participant.id = request_row.target_participant_id
  for update;
  if target_kind is distinct from 'account' then
    raise exception 'target_account_not_found';
  end if;

  if response = 'accepted' then
    select person.id into existing_linked_person_id
    from public.person_relationships as person
    where person.owner_participant_id = person_row.owner_participant_id
      and person.linked_participant_id =
        request_row.target_participant_id
      and person.merged_into_person_id is null
      and person.id <> person_row.id
    for update;

    if existing_linked_person_id is not null then
      select exists (
        select 1
        from public.person_manual_participants as mapping
        where mapping.person_id = person_row.id
          and mapping.is_primary
      ) into target_has_primary;

      if target_has_primary then
        update public.person_manual_participants
        set is_primary = false
        where person_id = existing_linked_person_id
          and is_primary;
      end if;

      update public.person_relationships
      set merged_into_person_id = person_row.id
      where id = existing_linked_person_id;

      update public.person_manual_participants
      set person_id = person_row.id
      where person_id = existing_linked_person_id;
    end if;

    update public.person_relationships
    set linked_participant_id = request_row.target_participant_id
    where id = person_row.id;
  end if;

  update public.participant_link_requests
  set status = response, responded_at = now()
  where id = target_request_id;
end;
$$;

-- Backfill accepted requests into identity mapping only. The production
-- preflight currently guarantees this set is empty. No financial row is read
-- for mutation or rewritten here.
do $$
declare
  request_row public.participant_link_requests%rowtype;
  existing_linked_person_id uuid;
begin
  for request_row in
    select request.*
    from public.participant_link_requests as request
    where request.status = 'accepted'
      and request.person_relationship_id is not null
  loop
    select person.id into existing_linked_person_id
    from public.person_relationships as person
    where person.owner_participant_id = request_row.requested_by
      and person.linked_participant_id =
        request_row.target_participant_id
      and person.merged_into_person_id is null
      and person.id <> request_row.person_relationship_id
    limit 1;

    if existing_linked_person_id is not null then
      update public.person_relationships
      set merged_into_person_id = request_row.person_relationship_id
      where id = existing_linked_person_id;
    end if;

    update public.person_relationships
    set linked_participant_id = request_row.target_participant_id
    where id = request_row.person_relationship_id
      and merged_into_person_id is null;
  end loop;
end;
$$;

alter table public.person_relationships enable row level security;
alter table public.person_manual_participants enable row level security;

drop policy if exists person_relationships_select_owned
  on public.person_relationships;
create policy person_relationships_select_owned
  on public.person_relationships for select to authenticated
  using (owner_participant_id = public.current_participant_id());

drop policy if exists person_manual_participants_select_owned
  on public.person_manual_participants;
create policy person_manual_participants_select_owned
  on public.person_manual_participants for select to authenticated
  using (
    exists (
      select 1
      from public.person_relationships as person
      where person.id = person_manual_participants.person_id
        and person.owner_participant_id = public.current_participant_id()
    )
  );

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'person_relationships'
    ) then
      alter publication supabase_realtime
        add table public.person_relationships;
    end if;
    if not exists (
      select 1
      from pg_catalog.pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'person_manual_participants'
    ) then
      alter publication supabase_realtime
        add table public.person_manual_participants;
    end if;
  end if;
end;
$$;

revoke all on table public.person_relationships
  from public, anon, authenticated;
revoke all on table public.person_manual_participants
  from public, anon, authenticated;
grant select on table public.person_relationships to authenticated;
grant select on table public.person_manual_participants to authenticated;

revoke all on function private.validate_person_relationship() from public;
revoke all on function private.validate_person_manual_attachment() from public;
revoke all on function private.ensure_linked_person_relationship(uuid, uuid)
  from public;
revoke all on function private.ensure_established_friendship_people()
  from public;
revoke all on function public.create_manual_participant(text) from public;
revoke all on function public.add_manual_space_member(uuid, text) from public;
revoke all on function public.create_manual_person(text) from public;
revoke all on function public.request_person_link(uuid, uuid) from public;
revoke all on function public.request_manual_participant_link(uuid, uuid)
  from public;
revoke all on function public.respond_manual_participant_link(uuid, text)
  from public;

grant execute on function public.create_manual_participant(text)
  to authenticated;
grant execute on function public.add_manual_space_member(uuid, text)
  to authenticated;
grant execute on function public.create_manual_person(text)
  to authenticated;
grant execute on function public.request_person_link(uuid, uuid)
  to authenticated;
grant execute on function public.request_manual_participant_link(uuid, uuid)
  to authenticated;
grant execute on function public.respond_manual_participant_link(uuid, text)
  to authenticated;
