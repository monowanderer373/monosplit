-- Supabase grants function execution to API roles through schema default
-- privileges. Anonymous signed-in users still use the `authenticated` database
-- role, so unauthenticated `anon` callers only need invite preview access.

do $$
declare
  routine record;
begin
  for routine in
    select
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as arguments
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
      and procedure.proname <> 'preview_space_invite'
      and pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      )
  loop
    execute pg_catalog.format(
      'revoke execute on function public.%I(%s) from anon',
      routine.proname,
      routine.arguments
    );
  end loop;

  for routine in
    select
      procedure.proname,
      pg_catalog.pg_get_function_identity_arguments(procedure.oid) as arguments
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'delete_group_and_memberships',
        'handle_tabby_tally_user',
        'rls_auto_enable'
      )
  loop
    execute pg_catalog.format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated',
      routine.proname,
      routine.arguments
    );
  end loop;
end
$$;
