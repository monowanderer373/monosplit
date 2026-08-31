-- DESTRUCTIVE OPERATOR SCRIPT.
-- Run only after the linked project, verified logical restore, CI, write freeze,
-- and explicit private-beta go/no-go have all been recorded.

do $$
declare
  source_count bigint;
  archive_count bigint;
  source_name text;
  remaining_active_rows bigint;
  legacy_groups_empty boolean;
begin
  foreach source_name in array array[
    'groups',
    'user_groups',
    'group_invite_links'
  ]
  loop
    if pg_catalog.to_regclass(
      pg_catalog.format('public.%I', source_name)
    ) is null then
      continue;
    end if;

    execute pg_catalog.format(
      'select pg_catalog.count(*) from public.%I',
      source_name
    ) into source_count;

    select pg_catalog.count(*)
    into archive_count
    from private.legacy_beta_recovery as recovery
    where recovery.source_table = source_name;

    if source_count <> archive_count then
      raise exception using
        message = pg_catalog.format(
          'legacy_archive_count_mismatch:%s:%s:%s',
          source_name,
          source_count,
          archive_count
        ),
        errcode = 'P0001';
    end if;
  end loop;

  -- Clear the new active domain explicitly. The legacy public tables and
  -- private recovery archive are intentionally not truncated.
  truncate table
    public.capture_usage,
    public.capture_entitlements,
    public.participant_link_requests,
    public.recurring_drafts,
    public.recurring_rules,
    public.capture_templates,
    public.settlement_allocations,
    public.settlement_payments,
    public.expense_shares,
    public.payer_contributions,
    public.expense_participations,
    public.expenses,
    public.financial_events,
    public.product_events,
    public.space_invites,
    public.friend_invites,
    public.space_members,
    public.spaces,
    public.friendships
  restart identity cascade;

  delete from public.participants;
  delete from auth.users;

  select
    (select pg_catalog.count(*) from auth.users)
    + (select pg_catalog.count(*) from public.user_profiles)
    + (select pg_catalog.count(*) from public.participants)
    + (select pg_catalog.count(*) from public.spaces)
    + (select pg_catalog.count(*) from public.friend_invites)
    + (select pg_catalog.count(*) from public.expenses)
    + (select pg_catalog.count(*) from public.settlement_payments)
  into remaining_active_rows;

  if remaining_active_rows <> 0 then
    raise exception using
      message = 'private_beta_reset_incomplete',
      errcode = 'P0001';
  end if;

  if pg_catalog.to_regclass('public.groups') is not null then
    execute 'select not exists (select 1 from public.groups)'
    into legacy_groups_empty;

    if legacy_groups_empty then
      raise exception using
        message = 'legacy_groups_were_not_preserved',
        errcode = 'P0001';
    end if;
  end if;

  if not exists (select 1 from private.legacy_beta_recovery) then
    raise exception using
      message = 'legacy_recovery_archive_is_empty',
      errcode = 'P0001';
  end if;
end
$$;
