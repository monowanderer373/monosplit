# Issue02 directed friend requests — additive installation

Target only the existing Tabby Tally Supabase project `skiqsxvmxvmxfzhrzcxh`.
New migration `202610280001_trip_friend_requests.sql`. Existing32deployed files,
financial tables/functions, RLS and identity history remain frozen.

Classify under PRODUCTION_HARDENING_RUNBOOK section6: additive objects, not a
financial/destructive rewrite. Creates a private request command receipt table,
a pair-only RLS request table and four explicit authenticated RPCs. The original
friendship/Person trigger is reused only when a recipient later accepts. Schema
installation itself sends no request, establishes no friendship, changes no bill
or balance, and resets nothing. No new project or replacement ledger service.

1. Require exact-source unit/lint/TypeScript/build, isolated SQL/strict lint,
   competing authenticated send sessions, historical installer twice, production
   module UI, focused real Trip journey and full financial regressions to pass.
2. Read actual hosted history: exactly32priorversions. Preserve original schema
   definitions and ACLs privately; this source-only snapshot is not a full data
   backup or tested restore. Stop if the baseline differs.
3. Generate with `python3 scripts/generate-trip-friends-apply.py`. Download the
   complete pinned [trip-friends-production-apply.sql](trip-friends-production-apply.sql),
   compare its SHA-256/bytes to the verified Git revision. Never run a preview,
   fragment or old Reset/personal-period installer.
4. Run the complete file in that existing project's SQL Editor. One transaction
   verifies exact history/canonical encoded payload, registers the new migration,
   checks four exact function bodies/RLS/privileges and reloads PostgREST.
   Success:`TABBY_TRIP_FRIENDS_INSTALL_COMPLETE_20261028`.
   The complete installer may repeat safely; it verifies existing installed
   source instead of recreating the schema or replacing deployed history.
5. Independently read back all33migration versions, four canonical function
   hashes/empty search paths/security-definer/execute grants, two RLS tables,
   no authenticated direct writes/anonymous execute/private receipt reads,
   exact original financial/security/friendship source and ACLs, and Realtime
   publication. Never infer installation success from an operator message alone.
6. Only after installed service verification merge/release the compatible client
   to the existing tabby-tally Vercel production. Verify native READY, exact main
   SHA/public route chunks, current PWA and ordinary tagged-owned QA. Never use
   customer membership/bills, production Reset or financial QA writes.

Current connection was independently observed as `supabase_read_only_user` with
`transaction_read_only=on`, including when the ManagementAPI read_only flag was
false. This role cannot install the schema. If unchanged, operator SQL Editor
execution is a technical connection step, not a repeat of generic authorization.
Never request credentials/secrets in chat.

A failed install transaction rolls back. Inspect migration/source/ACL state
before retrying, never insert migration history by hand. After requests or
acceptances exist, retain consent receipts and normal friendship/Person facts;
use a reviewed forward migration instead of dropping metadata or deleting a
friendship to manufacture a clean test state. Default request lifetime7days and
24hour declined-pair cooldown apply only to new directed requests; old accepted,
blocked and archived relationships are not silently changed or restored.
