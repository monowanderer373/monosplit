# Tabby Tally project status

Checkpoint: 2026-10-13 (Asia/Kuala_Lumpur)

## Resume first
Read this file, WORK_LOG.md, CONTEXT.md/ADRs, git status and git diff. Preserve existing changes. Historical HANDOFF.md/CONTEXT.md release status is stale; never reset to its Phase 5 branch or infer undeployed migrations from it.

## Verified baseline
- Repository: monowanderer373/monosplit; production branch main.
- Local branch at takeover: work. HEAD and freshly fetched origin/main: 2041f71a298eca03ca96eeb6b8f3f8f485506660. Working tree initially clean.
- QuickAdd inline selection (PR #8 / f72885c) and Trip period/lifecycle (PR #9 / 2041f71) are present in main.
- React 19 / TypeScript / Vite / Supabase / PWA. npm lockfile, Node 22 CI. No Next.js migration.
- Insights currently uses RLS-loaded canonical expenses, booked predicate, user personalSpendingMinor, daily buckets and CATEGORY ranking. Repository loads all expense pages (500 each). Preserve those definitions.
- New Insights paper popovers/ticket and independent Spending records are absent in baseline.

## Current task
Implement approved Insights/Spending records design from TabbyTally_InsightsRecords_Complete_Handoff.zip (2026-10-12), preserving existing financial and authorization rules. Read the complete package specs and inspected all eight approved/full/component images. Design JSON is fictional; never production data or fallback.

## Connections and blockers
- Git HTTPS fetch and GitHub API work after network settings propagation. Repository API reports push access. Production alias HTTP 200. Main CI 38058634519 is successful; GitHub production deployment 6982023097 and Vercel commit status confirm baseline 2041f71 successful.
- Saved required network domains in cloud configuration draft, preserving public.ecr.aws: api.github.com, api.vercel.com, vercel.com, tabby-tally-monowanderer373s-projects.vercel.app, skiqsxvmxvmxfzhrzcxh.supabase.co, api.supabase.com. Save in environment settings, then retry.
- No Vercel/Supabase credential bindings configured; GH_TOKEN name present, actual API authentication not verified while blocked. Do not print credentials.
- Complete master handover MD received and read in full; confirmed source priority and historical evidence limits.
- Local database: prior onboarding proved PostgreSQL image extraction exhausts 32 GB under Docker vfs, even excluding optional services. Current instance still vfs/32 GB; do not retry unchanged. No pgTAP or authenticated backend test readiness claim.
- Live alias supplied by user: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Deployment SHA/state and remote migration history remain unverified.

## Safety and scope
Person != Participant; F = E - T + R; immutable accepted history; existing transactional/versioned RPCs, RLS and idempotency preserved. No schema change currently planned. Production private writes and physical phone behavior must not be inferred from public/PWA checks.

## Current implementation / validation
- Implemented shared snapshot, scoped paper UI/popovers, records route and original expense editor; see docs/insights/IMPLEMENTATION.md.
- Changed App/AppShell, InsightsPage, ledger/change/scroll hooks, i18n, PWA precache; new SpendingRecordsPage, spending selectors, insights components/tokens/assets, unit and browser tests. Dependency declarations/lockfile/migrations unchanged.
- Local 519 Vitest / 77 files, ESLint, production build passed. 9 intercepted-API browser checks passed, including geometry/screenshots and history/list restoration. Screenshots: test-results/insights-ui (fictional test-created rows, ignored).
- Real-backend test added to existing CI; pending run. Production unchanged by this task so far.

## Next
Create feat/insights-spending-records PR; run existing CI including pgTAP/full browser and new actual Supabase journey. Diagnose failures before merge. After checks, merge through existing release flow, inspect Vercel Production success and exact SHA, validate live/public/PWA, update this checkpoint.
