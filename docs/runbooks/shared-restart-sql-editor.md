# Full Reset / old Split installation

Target: existing project `skiqsxvmxvmxfzhrzcxh`. New migration:
`202610260001_shared_restart.sql`. This is separate from the installed personal
periods 001/002/003 migrations; those files and the old installers remain frozen.

The user explicitly confirmed that a new Reset clears old receivables and
payables, while counterpart bills remain removable/re-taggable. No Reset notice
is sent. See [ADR 0012](../adr/0012-shared-reset-and-retag.md).

## Installation and verification

1. Require current-source application, database lint/pgTAP, historical upgrade,
   concurrency, production UI and authenticated browser checks to succeed. The
   historical check must execute the complete generated installer twice.
2. Read hosted migration history: exactly the existing 31 versions, including
   `202610250003`, before installation. Stop for any unexpected history. Preserve
   the existing function definitions/ACLs privately; never export customer rows
   into public evidence.
3. Download the **complete** pinned
   [shared-restart-production-apply.sql](shared-restart-production-apply.sql).
   Reproduce it using `python3 scripts/generate-shared-restart-apply.py`; compare
   downloaded bytes and SHA-256 to the verified source. Do not copy a preview or
   partial SQL block. The canonical encoded payload is checksum-verified before
   execution, avoiding SQL Editor newline changes inside function bodies.
4. Run the complete file in the existing project's SQL Editor. It is one
   transaction, checks the exact baseline, registers the migration only after
   success, verifies 24 function bodies, then reloads the API schema. Success is
   `TABBY_SHARED_RESTART_INSTALL_COMPLETE_20261026`. Repeating the complete file
   verifies the installed bodies without repeating the migration.
5. Independently verify all 32 migration versions, exact 24 function bodies
   (CRLF-to-LF canonicalization only), empty search paths, SECURITY DEFINER,
   seven RLS tables, no authenticated direct writes/anonymous execution/private
   helper execution. Compare preserved permission/authentication functions and
   the renamed original snapshot body. Use ordinary owned QA to check capability
   `shared_restart_version: 1`, authoritative preview and financial hashes.
6. Only then merge the reviewed PR and publish to the existing Vercel project.
   Verify READY, exact main SHA/public entry, normal login, preview/Cancel and
   current PWA assets. Do not execute a production Reset as a smoke test.

The current management API role is `supabase_read_only_user`; toggling an API
request's `read_only` flag does not grant migration privileges. If unchanged,
the operator's SQL Editor installation is the remaining technical action, not
a request for generic development permission. Never request secrets in chat.

## Recovery classification

This install adds reset/re-tag metadata and forward-fixes current projections
and guards under [the existing migration gate](../PRODUCTION_HARDENING_RUNBOOK.md#6-high-risk-migration-gate).
It does not rewrite original purchases, paid cash, native balances, identity
principals or settlement facts, change integer currency units, run Reset or
retroactively clear a previously completed personal-only Reset. The original
pairing, financial formula and payment posting procedures remain in use.

Provider backup metadata currently lists no snapshots and PITR disabled; the
independent Windows encrypted backups are outside this workspace and unverified.
A private source-only snapshot of ten existing functions/ACLs is available; it
is **not a database backup or tested restore**. Do not claim otherwise.

On SQL failure the transaction rolls back; inspect history and function hashes
before retrying. Do not insert migration history manually or run fragments.
Before the first full Reset, empty metadata preserves old current projections.
After any full Reset/re-tag, never drop its metadata or roll back the engine
filters: that could resurrect released debt. Preserve committed release,
payment and consent history and use a reviewed forward migration. A client
rollback must also retain compatible readers of these facts.
