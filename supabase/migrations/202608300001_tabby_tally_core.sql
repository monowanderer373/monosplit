-- Tabby Tally relational core.
-- This migration is forward-only. Apply it only after the beta project has
-- been backed up. Legacy public.groups data is deliberately left untouched
-- until the application has cut over to these tables.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  lang text not null default 'en' check (lang in ('en', 'zh')),
  theme_id text not null default 'solid-vintage',
  default_currency text not null default 'MYR' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Kuala_Lumpur',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists default_currency text not null default 'MYR',
  add column if not exists timezone text not null default 'Asia/Kuala_Lumpur';

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  kind text not null check (kind in ('account', 'manual')),
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    kind = 'account'
    or (kind = 'manual' and auth_user_id is null)
  )
);

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('group', 'trip')),
  name text not null check (char_length(trim(name)) between 1 and 120),
  owner_participant_id uuid not null references public.participants(id),
  start_date date,
  end_date date,
  default_currency text not null default 'MYR' check (default_currency ~ '^[A-Z]{3}$'),
  status text not null default 'active' check (status in ('active', 'archived', 'voided')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  role text not null check (role in ('owner', 'full_access', 'view')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (space_id, participant_id)
);

create unique index if not exists space_members_one_active_owner_idx
  on public.space_members(space_id)
  where role = 'owner' and removed_at is null;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  participant_low_id uuid not null references public.participants(id),
  participant_high_id uuid not null references public.participants(id),
  requested_by uuid not null references public.participants(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked', 'archived')),
  accepted_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (participant_low_id::text < participant_high_id::text),
  unique (participant_low_id, participant_high_id)
);

create table if not exists public.space_invites (
  id uuid primary key default gen_random_uuid(),
  token_digest bytea not null unique,
  space_id uuid not null references public.spaces(id) on delete cascade,
  role text not null check (role in ('full_access', 'view')),
  created_by uuid not null references public.participants(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  consumed_at timestamptz,
  consumed_by uuid references public.participants(id),
  created_at timestamptz not null default now()
);

create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  token_digest bytea not null unique,
  created_by uuid not null references public.participants(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  consumed_at timestamptz,
  consumed_by uuid references public.participants(id),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  scope text not null check (scope in ('personal', 'direct', 'space')),
  space_id uuid references public.spaces(id),
  created_by uuid not null references public.participants(id),
  total_minor bigint not null check (total_minor > 0 and total_minor <= 9007199254740991),
  participant_count integer not null check (participant_count > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  description text,
  category text not null default 'Other',
  occurred_on date not null,
  status text not null default 'active' check (status in ('active', 'voided')),
  version integer not null default 1 check (version > 0),
  voided_at timestamptz,
  voided_by uuid references public.participants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'space' and space_id is not null)
    or (scope in ('personal', 'direct') and space_id is null)
  ),
  unique (created_by, client_request_id)
);

create table if not exists public.expense_participations (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  participant_id uuid not null references public.participants(id),
  name_snapshot text not null check (char_length(trim(name_snapshot)) between 1 and 100),
  participant_order integer not null check (participant_order >= 0),
  state text not null check (state in ('pending', 'accepted', 'declined', 'untracked')),
  tracking_mode text not null check (tracking_mode in ('tracked', 'untracked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, expense_id),
  unique (expense_id, participant_id),
  unique (expense_id, participant_order),
  check (
    (tracking_mode = 'untracked' and state = 'untracked')
    or tracking_mode = 'tracked'
  )
);

create table if not exists public.payer_contributions (
  expense_participation_id uuid primary key,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  foreign key (expense_participation_id, expense_id)
    references public.expense_participations(id, expense_id) on delete cascade
);

create table if not exists public.expense_shares (
  expense_participation_id uuid primary key,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  amount_minor bigint not null check (amount_minor >= 0 and amount_minor <= 9007199254740991),
  foreign key (expense_participation_id, expense_id)
    references public.expense_participations(id, expense_id) on delete cascade
);

create table if not exists public.settlement_payments (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  scope text not null check (scope in ('direct', 'space')),
  space_id uuid references public.spaces(id),
  debtor_participant_id uuid not null references public.participants(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  payment_date date not null,
  status text not null default 'pending' check (status in ('pending', 'partially_confirmed', 'confirmed', 'declined', 'reversed')),
  note text,
  reversed_at timestamptz,
  reversed_by uuid references public.participants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'space' and space_id is not null)
    or (scope = 'direct' and space_id is null)
  ),
  unique (debtor_participant_id, client_request_id)
);

create table if not exists public.settlement_allocations (
  id uuid primary key default gen_random_uuid(),
  settlement_payment_id uuid not null references public.settlement_payments(id) on delete cascade,
  creditor_participant_id uuid not null references public.participants(id),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  state text not null default 'pending' check (state in ('pending', 'accepted', 'declined', 'reversed')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (settlement_payment_id, creditor_participant_id)
);

create table if not exists public.financial_events (
  id uuid primary key default gen_random_uuid(),
  actor_participant_id uuid not null references public.participants(id),
  expense_id uuid references public.expenses(id) on delete cascade,
  settlement_payment_id uuid references public.settlement_payments(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete cascade,
  event_type text not null,
  safe_diff jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(expense_id, settlement_payment_id, space_id) = 1)
);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id) on delete set null,
  event_name text not null,
  source text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  succeeded boolean,
  correction_count integer check (correction_count is null or correction_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists participants_auth_user_idx on public.participants(auth_user_id);
create index if not exists spaces_owner_idx on public.spaces(owner_participant_id);
create index if not exists space_members_participant_idx on public.space_members(participant_id, removed_at);
create index if not exists friendships_low_status_idx on public.friendships(participant_low_id, status);
create index if not exists friendships_high_status_idx on public.friendships(participant_high_id, status);
create index if not exists expenses_space_date_idx on public.expenses(space_id, occurred_on desc) where status = 'active';
create index if not exists expenses_creator_date_idx on public.expenses(created_by, occurred_on desc) where status = 'active';
create index if not exists expense_participations_participant_idx
  on public.expense_participations(participant_id, state, expense_id);
create index if not exists payer_contributions_expense_idx on public.payer_contributions(expense_id);
create index if not exists expense_shares_expense_idx on public.expense_shares(expense_id);
create index if not exists settlement_debtor_idx
  on public.settlement_payments(debtor_participant_id, currency, payment_date desc);
create index if not exists settlement_creditor_idx
  on public.settlement_allocations(creditor_participant_id, state, settlement_payment_id);
create index if not exists financial_events_expense_idx on public.financial_events(expense_id, created_at desc);
create index if not exists financial_events_space_idx on public.financial_events(space_id, created_at desc);

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists participants_set_updated_at on public.participants;
create trigger participants_set_updated_at
  before update on public.participants
  for each row execute function public.set_updated_at();

drop trigger if exists spaces_set_updated_at on public.spaces;
create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

drop trigger if exists expense_participations_set_updated_at on public.expense_participations;
create trigger expense_participations_set_updated_at
  before update on public.expense_participations
  for each row execute function public.set_updated_at();

drop trigger if exists settlement_payments_set_updated_at on public.settlement_payments;
create trigger settlement_payments_set_updated_at
  before update on public.settlement_payments
  for each row execute function public.set_updated_at();

create or replace function public.handle_tabby_tally_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Guest'
  );

  insert into public.user_profiles(id, display_name, avatar_url)
  values (new.id, resolved_name, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  insert into public.participants(auth_user_id, kind, display_name, created_by)
  values (new.id, 'account', resolved_name, new.id)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_tabby_tally_user_created on auth.users;
create trigger on_tabby_tally_user_created
  after insert on auth.users
  for each row execute function public.handle_tabby_tally_user();

insert into public.participants(auth_user_id, kind, display_name, created_by)
select
  users.id,
  'account',
  coalesce(
    nullif(trim(profiles.display_name), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'Guest'
  ),
  users.id
from auth.users as users
left join public.user_profiles as profiles on profiles.id = users.id
on conflict (auth_user_id) do nothing;
