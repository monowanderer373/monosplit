# Archived MonoSplit SQL setup

The former root `supabase-schema.sql` and `supabase-auth-migration.sql` scripts
created the removed JSONB group model and permissive link-based policies. They
are historical references, not database setup instructions.

The root filenames now contain fail-fast guards so an old checklist or copied
command cannot recreate that model. The current schema is defined only by the
ordered, forward-only files in `supabase/migrations/`. Use
`docs/BETA_RESET_RUNBOOK.md` for local validation and private-beta deployment.

Git history remains the source for the retired scripts' original contents.
