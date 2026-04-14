-- MonoSplit Auth Migration
-- Safe to re-run on older MonoSplit databases.
-- This version is compatibility-friendly for mixed historical schemas
-- where some auth-linked IDs may already be stored as text instead of uuid.

-- ─────────────────────────────────────────────
-- 1. user_profiles table
-- ─────────────────────────────────────────────
create table if not exists public.user_profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  lang        text        not null default 'en',
  theme_id    text        not null default 'solid-vintage',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

drop policy if exists "profile_select_own" on public.user_profiles;
drop policy if exists "profile_insert_own" on public.user_profiles;
drop policy if exists "profile_update_own" on public.user_profiles;
drop policy if exists "profile_delete_own" on public.user_profiles;

create policy "profile_select_own" on public.user_profiles
  for select using (auth.uid() = id);
create policy "profile_insert_own" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "profile_update_own" on public.user_profiles
  for update using (auth.uid() = id);
create policy "profile_delete_own" on public.user_profiles
  for delete using (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at();

-- ─────────────────────────────────────────────
-- 2. Add owner_id to groups
-- ─────────────────────────────────────────────
alter table public.groups
  add column if not exists owner_id text;

create index if not exists groups_owner_id_idx on public.groups (owner_id);

-- ─────────────────────────────────────────────
-- 3. Update RLS on groups
--    Anonymous groups (owner_id IS NULL) stay fully open.
--    Owned groups can only be updated/deleted by their owner.
-- ─────────────────────────────────────────────
drop policy if exists "groups_select" on public.groups;
drop policy if exists "groups_insert" on public.groups;
drop policy if exists "groups_update" on public.groups;
drop policy if exists "groups_delete" on public.groups;

create policy "groups_select" on public.groups
  for select using (
    owner_id is null
    or owner_id::text = auth.uid()::text
    or exists (
      select 1
      from public.user_groups ug
      where ug.group_id::text = groups.id::text
        and ug.user_id::text = auth.uid()::text
    )
  );

create policy "groups_insert" on public.groups
  for insert with check (true);

create policy "groups_update" on public.groups
  for update using (
    owner_id is null
    or owner_id::text = auth.uid()::text
    or exists (
      select 1
      from public.user_groups ug
      where ug.group_id::text = groups.id::text
        and ug.user_id::text = auth.uid()::text
        and ug.role = 'full_access'
    )
  )
  with check (
    owner_id is null
    or owner_id::text = auth.uid()::text
    or exists (
      select 1
      from public.user_groups ug
      where ug.group_id::text = groups.id::text
        and ug.user_id::text = auth.uid()::text
        and ug.role = 'full_access'
    )
  );

create policy "groups_delete" on public.groups
  for delete using (owner_id is null or owner_id::text = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 4. Memberships with roles
-- ─────────────────────────────────────────────
create table if not exists public.user_groups (
  user_id text not null,
  group_id text not null references public.groups(id) on delete cascade,
  role text not null default 'full_access',
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

alter table public.user_groups enable row level security;
alter table public.user_groups add column if not exists role text;
alter table public.user_groups alter column role set default 'full_access';
update public.user_groups set role = 'full_access' where role is null;
update public.user_groups
set role = 'full_access'
where role is not null
  and role not in ('owner', 'full_access', 'view');
alter table public.user_groups drop constraint if exists user_groups_role_check;
alter table public.user_groups add constraint user_groups_role_check check (role in ('owner', 'full_access', 'view'));

drop policy if exists "user_groups_select_group_members" on public.user_groups;
drop policy if exists "user_groups_insert_owner_or_self" on public.user_groups;
drop policy if exists "user_groups_update_owner_or_self" on public.user_groups;
drop policy if exists "user_groups_delete_owner_or_self" on public.user_groups;

create policy "user_groups_select_group_members" on public.user_groups
  for select using (
    user_id::text = auth.uid()::text
    or exists (
      select 1
      from public.groups g
      where g.id::text = user_groups.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
    or exists (
      select 1
      from public.user_groups ug
      where ug.group_id::text = user_groups.group_id::text
        and ug.user_id::text = auth.uid()::text
    )
  );

create policy "user_groups_insert_owner_or_self" on public.user_groups
  for insert with check (
    user_id::text = auth.uid()::text
    or exists (
      select 1
      from public.groups g
      where g.id::text = user_groups.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create policy "user_groups_update_owner_or_self" on public.user_groups
  for update using (
    user_id::text = auth.uid()::text
    or exists (
      select 1
      from public.groups g
      where g.id::text = user_groups.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create policy "user_groups_delete_owner_or_self" on public.user_groups
  for delete using (
    user_id::text = auth.uid()::text
    or exists (
      select 1
      from public.groups g
      where g.id::text = user_groups.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create index if not exists user_groups_group_id_idx on public.user_groups (group_id);
create index if not exists user_groups_user_id_idx on public.user_groups (user_id);

-- ─────────────────────────────────────────────
-- 5. Invite links with preset role
-- ─────────────────────────────────────────────
create table if not exists public.group_invite_links (
  token text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  role text not null check (role in ('full_access', 'view')),
  created_by text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.group_invite_links enable row level security;
alter table public.group_invite_links add column if not exists active boolean;
alter table public.group_invite_links alter column active set default true;
update public.group_invite_links set active = true where active is null;

drop policy if exists "group_invite_links_select" on public.group_invite_links;
drop policy if exists "group_invite_links_insert_owner" on public.group_invite_links;
drop policy if exists "group_invite_links_update_owner" on public.group_invite_links;
drop policy if exists "group_invite_links_delete_owner" on public.group_invite_links;

create policy "group_invite_links_select" on public.group_invite_links
  for select using (active = true);

create policy "group_invite_links_insert_owner" on public.group_invite_links
  for insert with check (
    created_by::text = auth.uid()::text
    and exists (
      select 1
      from public.groups g
      where g.id::text = group_invite_links.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create policy "group_invite_links_update_owner" on public.group_invite_links
  for update using (
    created_by::text = auth.uid()::text
    and exists (
      select 1
      from public.groups g
      where g.id::text = group_invite_links.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create policy "group_invite_links_delete_owner" on public.group_invite_links
  for delete using (
    created_by::text = auth.uid()::text
    and exists (
      select 1
      from public.groups g
      where g.id::text = group_invite_links.group_id::text
        and g.owner_id::text = auth.uid()::text
    )
  );

create index if not exists group_invite_links_group_id_idx on public.group_invite_links (group_id);
