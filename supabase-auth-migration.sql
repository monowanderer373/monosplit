-- MonoSplit Auth Migration
-- Run this ONCE in Supabase SQL Editor: Dashboard → SQL Editor → New Query → Paste → Run

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
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists groups_owner_id_idx on public.groups (owner_id);

-- ─────────────────────────────────────────────
-- 3. Update RLS on groups
--    Anonymous groups (owner_id IS NULL) stay fully open.
--    Owned groups can only be updated/deleted by their owner.
-- ─────────────────────────────────────────────
drop policy if exists "groups_update" on public.groups;
drop policy if exists "groups_delete" on public.groups;

create policy "groups_update" on public.groups
  for update using (owner_id is null or owner_id = auth.uid())
  with check  (owner_id is null or owner_id = auth.uid());

create policy "groups_delete" on public.groups
  for delete using (owner_id is null or owner_id = auth.uid());
