-- ARCHIVED ENTRY POINT: DO NOT RUN AS DATABASE SETUP.
--
-- Tabby Tally is managed exclusively by the ordered files in
-- supabase/migrations/. See docs/BETA_RESET_RUNBOOK.md. The former MonoSplit
-- JSON group schema granted open access and is intentionally unavailable.

do $$
begin
  raise exception using
    message = 'archived_sql_use_supabase_migrations',
    errcode = 'P0001';
end
$$;
