-- Plain-SQL assertions for the historical upgrade job. Any failed invariant
-- raises and fails CI.
do $$
declare
  legacy_relation record;
begin
  for legacy_relation in
    select relation.oid, relation.relname, relation.relrowsecurity
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
  loop
    if not legacy_relation.relrowsecurity then
      raise exception 'legacy table % does not have RLS enabled',
        legacy_relation.relname;
    end if;

    if exists (
      select 1
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = legacy_relation.relname
    ) then
      raise exception 'legacy table % still has a client policy',
        legacy_relation.relname;
    end if;

    if pg_catalog.has_table_privilege(
      'anon',
      legacy_relation.oid,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or pg_catalog.has_table_privilege(
      'authenticated',
      legacy_relation.oid,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'legacy table % still grants browser access',
        legacy_relation.relname;
    end if;

    if not pg_catalog.has_table_privilege(
      'service_role',
      legacy_relation.oid,
      'SELECT'
    ) then
      raise exception 'legacy table % is not exportable by service_role',
        legacy_relation.relname;
    end if;
  end loop;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
  ) <> 3 then
    raise exception 'historical fixture did not preserve all legacy tables';
  end if;

  if (
    select pg_catalog.count(*)
    from public.groups
    where id = 'legacy-fixture-group'
      and data = '{"preserved":true}'::jsonb
  ) <> 1 then
    raise exception 'migration changed preserved legacy recovery data';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_publication as publication
    join pg_catalog.pg_publication_rel as publication_relation
      on publication_relation.prpubid = publication.oid
    join pg_catalog.pg_class as relation
      on relation.oid = publication_relation.prrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where publication.pubname = 'supabase_realtime'
      and namespace.nspname = 'public'
      and relation.relname in ('groups', 'user_groups', 'group_invite_links')
  ) then
    raise exception 'Realtime still publishes a legacy relation';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'is_group_owner',
        'get_group_role',
        'is_group_member'
      )
      and (
        pg_catalog.has_function_privilege(
          'anon',
          procedure.oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
      )
  ) then
    raise exception 'a legacy helper remains executable by a browser role';
  end if;

  if pg_catalog.to_regprocedure('public.handle_new_user()') is not null
     or exists (
       select 1
       from pg_catalog.pg_trigger
       where tgrelid = 'auth.users'::pg_catalog.regclass
         and tgname = 'on_auth_user_created'
         and not tgisinternal
     ) then
    raise exception 'legacy profile-only auth provisioning remains installed';
  end if;

  if pg_catalog.to_regprocedure('public.update_updated_at()') is not null
     or exists (
       select 1
       from pg_catalog.pg_trigger
       where tgrelid = 'public.user_profiles'::pg_catalog.regclass
         and tgname = 'user_profiles_updated_at'
         and not tgisinternal
     ) then
    raise exception 'legacy profile timestamp trigger remains installed';
  end if;

  if not exists (
    select 1
    from public.user_profiles
    where id = '60000000-0000-4000-8000-000000000001'
      and lang = 'en'
      and theme_id = 'solid-vintage'
      and default_currency = 'MYR'
      and timezone = 'Asia/Kuala_Lumpur'
  ) then
    raise exception 'historical profile values were not normalized';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.pg_constraint
    where conrelid = 'public.user_profiles'::pg_catalog.regclass
      and conname in (
        'user_profiles_lang_check',
        'user_profiles_default_currency_check',
        'user_profiles_theme_id_check',
        'user_profiles_timezone_check'
      )
      and convalidated
  ) <> 4 then
    raise exception 'historical profile constraints were not reconciled';
  end if;

  if not exists (
    select 1
    from public.space_members
    where space_id = '60000000-bbbb-4bbb-8bbb-000000000001'
      and participant_id = '60000000-aaaa-4aaa-8aaa-000000000002'
      and role = 'view'
  ) then
    raise exception 'historical anonymous full access was not downgraded';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'public.recompute_settlement_status(uuid)',
    'EXECUTE'
  ) or pg_catalog.has_function_privilege(
    'authenticated',
    'public.recompute_settlement_status(uuid)',
    'EXECUTE'
  ) then
    raise exception 'internal settlement mutator remains browser-executable';
  end if;

  begin
    update public.space_members
    set role = 'full_access'
    where space_id = '60000000-bbbb-4bbb-8bbb-000000000001'
      and participant_id = '60000000-aaaa-4aaa-8aaa-000000000002';
    raise exception 'anonymous full-access trigger did not reject the update';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'anonymous_full_access_denied' then
        raise exception 'unexpected anonymous full-access error: %', sqlerrm;
      end if;
  end;

  begin
    update public.spaces
    set owner_participant_id =
      '60000000-aaaa-4aaa-8aaa-000000000002'
    where id = '60000000-bbbb-4bbb-8bbb-000000000001';
    raise exception 'anonymous owner trigger did not reject the update';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'anonymous_space_owner_denied' then
        raise exception 'unexpected anonymous owner error: %', sqlerrm;
      end if;
  end;

  if (
    select pg_catalog.count(*)
    from private.legacy_beta_recovery
    where source_table = 'groups'
  ) <> 1 or (
    select pg_catalog.count(*)
    from private.legacy_beta_recovery
    where source_table = 'user_groups'
  ) <> 1 or (
    select pg_catalog.count(*)
    from private.legacy_beta_recovery
    where source_table = 'group_invite_links'
  ) <> 1 then
    raise exception 'legacy recovery archive counts do not match the fixture';
  end if;

  if exists (
    select 1
    from private.legacy_beta_recovery
    where source_table = 'group_invite_links'
      and (
        row_data ? 'token'
        or not row_data ? 'token_sha256'
      )
  ) then
    raise exception 'legacy invite archive retained a raw token';
  end if;

  if pg_catalog.has_table_privilege(
    'authenticated',
    'private.legacy_beta_recovery',
    'SELECT'
  ) or not pg_catalog.has_table_privilege(
    'service_role',
    'private.legacy_beta_recovery',
    'SELECT'
  ) then
    raise exception 'legacy recovery archive privileges are incorrect';
  end if;
end
$$;
