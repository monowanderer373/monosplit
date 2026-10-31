# Issue07 — unified Trip expense editor installation

Target only existing Supabase project `skiqsxvmxvmxfzhrzcxh`.
Migration `202610310001_unified_trip_expense_editor.sql` is the 34th migration.

Under PRODUCTION_HARDENING_RUNBOOK section6 this is additive capability with a
forward-fix path. It adds a nullable stable Trip association, protected editor
metadata, and five checked helpers/RPCs. Installation does not edit, convert or
cancel any existing expense, post cash, reset an account, send an invitation or
reclassify historical label-only associations. Original financial command bodies
and previously deployed migration files remain unchanged.

1. Require all eight exact-source Quality jobs, including real disposable
   PostgreSQL/RLS/concurrency, historical installer twice, and authenticated
   native financial/browser regressions to pass. Local intercepted UI and the
   package reference tests do not replace this gate.
2. Read hosted migration history: exactly the original33 versions, latest
   `202610280001`. Preserve original schema/function/ACL evidence privately.
   Such metadata is not a full backup or a verified data restore. Stop on drift.
3. Generate `python3 scripts/generate-trip-editor-apply.py`; compare complete
   [trip-editor-production-apply.sql](trip-editor-production-apply.sql) bytes and
   SHA256 with the pinned tested Git revision. Never paste a preview/fragment,
   run a historical Reset installer, or manually register a migration.
4. If the authorized connection cannot write, run that complete file in the
   existing project's SQL Editor. The single transaction checks baseline and
   encoded payload, installs/registers the schema, verifies five function hashes,
   RLS and restricted privileges, and reloads PostgREST. Expected result:
   `TABBY_TRIP_EDITOR_INSTALL_COMPLETE_20261031`.
5. Independently verify all34 versions, five exact function bodies/search paths/
   definer settings/grants, parent-scoped metadata RLS/no direct authenticated
   DML or anonymous execution, and original financial/security function bodies
   and ACLs. Read normal authenticated service responses; perform no production
   financial/customer/member QA writes. A reported success marker alone does
   not replace independent verification.
6. Only then merge/release the compatible client to the existing `tabby-tally`
   Vercel project. Verify native READY, actual main/public SHA, retained PWA
   update and normal owned read-only navigation. Disposable backend success is
   not production write verification or physical phone evidence.

Current SQL session was independently observed as `supabase_read_only_user` /
`transaction_read_only=on`, including with Management `read_only=false`.
A previous same-project official migration API call returned403 for missing
`database_migrations_write`. Do not blindly repeat that rejected POST or request
secrets in chat. SQL Editor execution is a technical connection step, not a
request to repeat general development/deployment authorization.

A failed transaction rolls back; inspect baseline/functions/ACLs before retry.
The complete installer can repeat to verify an already-installed canonical
migration. Once editor metadata or corrections exist, use a reviewed forward
migration rather than dropping facts, deleting successor history, or resetting
any shared/production database.
