-- MonoSplit: Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

create table public.groups (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Open RLS: anyone with the group ID can access (link-based sharing)
alter table public.groups enable row level security;

create policy "groups_select" on public.groups
  for select using (true);
create policy "groups_insert" on public.groups
  for insert with check (true);
create policy "groups_update" on public.groups
  for update using (true) with check (true);
create policy "groups_delete" on public.groups
  for delete using (true);

-- Index for faster lookups
create index idx_groups_updated_at on public.groups (updated_at desc);

-- Enable Realtime
alter publication supabase_realtime add table public.groups;
