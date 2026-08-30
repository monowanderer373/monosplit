-- Reconstruct the remote shapes that migrations 001-006 intentionally leave
-- in place. CI loads this fixture after resetting only through migration 006.

alter table public.user_profiles
  drop constraint if exists user_profiles_lang_check;
alter table public.user_profiles
  drop constraint if exists user_profiles_default_currency_check;
alter table public.user_profiles
  alter column lang set default 'legacy-language',
  alter column theme_id set default 'legacy-theme',
  alter column default_currency set default 'myr',
  alter column timezone set default '';

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'legacy-owner@example.test',
    '',
    pg_catalog.now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Legacy owner"}',
    pg_catalog.now(),
    pg_catalog.now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '60000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    null,
    '',
    null,
    '{"provider":"anonymous","providers":[]}',
    '{}',
    pg_catalog.now(),
    pg_catalog.now()
  );

update public.participants
set id = case auth_user_id
  when '60000000-0000-4000-8000-000000000001'
    then '60000000-aaaa-4aaa-8aaa-000000000001'::uuid
  when '60000000-0000-4000-8000-000000000002'
    then '60000000-aaaa-4aaa-8aaa-000000000002'::uuid
end
where auth_user_id in (
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002'
);

update public.user_profiles
set
  lang = 'legacy-language',
  theme_id = '',
  default_currency = 'myr',
  timezone = ''
where id = '60000000-0000-4000-8000-000000000001';

insert into public.spaces(
  id,
  type,
  name,
  owner_participant_id,
  default_currency
)
values (
  '60000000-bbbb-4bbb-8bbb-000000000001',
  'group',
  'Historical upgrade fixture',
  '60000000-aaaa-4aaa-8aaa-000000000001',
  'MYR'
);

insert into public.space_members(space_id, participant_id, role)
values
  (
    '60000000-bbbb-4bbb-8bbb-000000000001',
    '60000000-aaaa-4aaa-8aaa-000000000001',
    'owner'
  ),
  (
    '60000000-bbbb-4bbb-8bbb-000000000001',
    '60000000-aaaa-4aaa-8aaa-000000000002',
    'full_access'
  );

create table public.groups (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  owner_id text
);

create table public.user_groups (
  user_id text not null,
  group_id text not null references public.groups(id) on delete cascade,
  role text not null,
  primary key (user_id, group_id)
);

create table public.group_invite_links (
  token text primary key,
  group_id text not null references public.groups(id) on delete cascade,
  role text not null,
  created_by text not null,
  active boolean not null default true
);

insert into public.groups(id, data, owner_id)
values ('legacy-fixture-group', '{"preserved":true}', 'legacy-owner');
insert into public.user_groups(user_id, group_id, role)
values ('legacy-owner', 'legacy-fixture-group', 'owner');
insert into public.group_invite_links(
  token,
  group_id,
  role,
  created_by
)
values (
  'legacy-fixture-token',
  'legacy-fixture-group',
  'view',
  'legacy-owner'
);

alter table public.groups enable row level security;
alter table public.user_groups enable row level security;
alter table public.group_invite_links enable row level security;

create policy legacy_groups_open on public.groups for all using (true)
  with check (true);
create policy legacy_user_groups_open on public.user_groups for all using (true)
  with check (true);
create policy legacy_invites_open on public.group_invite_links for all using (true)
  with check (true);

grant all on table public.groups to anon, authenticated;
grant all on table public.user_groups to anon, authenticated;
grant all on table public.group_invite_links to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end
$$;

alter publication supabase_realtime
  add table public.groups, public.user_groups, public.group_invite_links;

create or replace function public.is_group_owner(text, text)
returns boolean
language sql
security definer
set search_path = ''
as $$ select true $$;

create or replace function public.get_group_role(text, text)
returns text
language sql
security definer
set search_path = ''
as $$ select 'owner'::text $$;

create or replace function public.is_group_member(text, text)
returns boolean
language sql
security definer
set search_path = ''
as $$ select true $$;

grant execute on function public.is_group_owner(text, text)
  to anon, authenticated;
grant execute on function public.get_group_role(text, text)
  to anon, authenticated;
grant execute on function public.is_group_member(text, text)
  to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at();
