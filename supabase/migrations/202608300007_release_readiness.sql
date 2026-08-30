-- Baseline release readiness.
-- Publish the relational financial model for Supabase Realtime and quarantine
-- the legacy JSON group model without deleting its one-cycle recovery data.

do $$
declare
  target_table text;
  target_oid oid;
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;

  foreach target_table in array array[
    'expenses',
    'expense_participations',
    'payer_contributions',
    'expense_shares',
    'settlement_payments',
    'settlement_allocations'
  ]
  loop
    target_oid := pg_catalog.to_regclass(
      pg_catalog.format('public.%I', target_table)
    );

    if target_oid is not null
      and not exists (
        select 1
        from pg_catalog.pg_publication_rel
        where prpubid = (
          select oid
          from pg_catalog.pg_publication
          where pubname = 'supabase_realtime'
        )
          and prrelid = target_oid
      )
    then
      execute pg_catalog.format(
        'alter publication supabase_realtime add table public.%I',
        target_table
      );
    end if;
  end loop;
end
$$;

do $$
declare
  legacy_function text;
begin
  foreach legacy_function in array array[
    'public.is_group_owner(text,text)',
    'public.get_group_role(text,text)',
    'public.is_group_member(text,text)'
  ]
  loop
    if pg_catalog.to_regprocedure(legacy_function) is null then
      continue;
    end if;

    execute pg_catalog.format(
      'revoke all privileges on function %s from public',
      legacy_function
    );

    if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
      execute pg_catalog.format(
        'revoke all privileges on function %s from anon',
        legacy_function
      );
    end if;

    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = 'authenticated'
    ) then
      execute pg_catalog.format(
        'revoke all privileges on function %s from authenticated',
        legacy_function
      );
    end if;

    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = 'service_role'
    ) then
      execute pg_catalog.format(
        'grant execute on function %s to service_role',
        legacy_function
      );
    end if;
  end loop;
end
$$;

do $$
declare
  legacy_table text;
  legacy_oid oid;
  policy_row record;
begin
  foreach legacy_table in array array[
    'groups',
    'user_groups',
    'group_invite_links'
  ]
  loop
    legacy_oid := pg_catalog.to_regclass(
      pg_catalog.format('public.%I', legacy_table)
    );

    if legacy_oid is null then
      continue;
    end if;

    -- Keep the rows for one beta recovery cycle, but remove them from the
    -- client change feed before removing browser-role access.
    if exists (
      select 1
      from pg_catalog.pg_publication_rel as publication_relation
      join pg_catalog.pg_publication as publication
        on publication.oid = publication_relation.prpubid
      where publication.pubname = 'supabase_realtime'
        and publication_relation.prrelid = legacy_oid
    ) then
      execute pg_catalog.format(
        'alter publication supabase_realtime drop table public.%I',
        legacy_table
      );
    end if;

    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = legacy_table
    loop
      execute pg_catalog.format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        legacy_table
      );
    end loop;

    execute pg_catalog.format(
      'alter table public.%I enable row level security',
      legacy_table
    );
    execute pg_catalog.format(
      'revoke all privileges on table public.%I from public',
      legacy_table
    );

    if exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
      execute pg_catalog.format(
        'revoke all privileges on table public.%I from anon',
        legacy_table
      );
    end if;

    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = 'authenticated'
    ) then
      execute pg_catalog.format(
        'revoke all privileges on table public.%I from authenticated',
        legacy_table
      );
    end if;

    -- service_role bypasses RLS, but it still needs an explicit table grant
    -- after the revokes above to export recovery data.
    if exists (
      select 1
      from pg_catalog.pg_roles
      where rolname = 'service_role'
    ) then
      execute pg_catalog.format(
        'grant select on table public.%I to service_role',
        legacy_table
      );
    end if;
  end loop;
end
$$;
