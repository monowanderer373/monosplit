-- ARCHIVED ENTRY POINT: DO NOT RUN AS DATABASE SETUP.
--
-- The historical MonoSplit auth/group migration has been superseded by the
-- ordered Tabby Tally migrations in supabase/migrations/. See
-- docs/BETA_RESET_RUNBOOK.md for validated local and linked workflows.

do $$
begin
  raise exception using
    message = 'archived_sql_use_supabase_migrations',
    errcode = 'P0001';
end
$$;
