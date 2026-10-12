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

## Current code / rollout
- PR #10 merged: feature 3ec01082d4b6e923f15f9729f4ffc879ac2f89dc, main application merge 3f7618580344fa0acacb0d4f22c97751c1f17db9. Current checkout main; read git HEAD because later checkpoint-only commits may follow.
- Existing live alias really serves that merge SHA and the new SpendingRecordsPage chunk. Updated PWA activation, Records precache, offline shell and signed-out access guards at 320/360/390/430 verified.
- PR and main Quality runs 38288083611 / 38289066229: all six jobs successful. 519 unit / 723 pgTAP. PR browser artifact: 71 outcomes, 70 first-run passes and 1 existing login readiness retry passed; new 10 Insights tests first-run passed. Details: docs/releases/2026-10-13-insights-records-verification.md.
- Full master handover received/read. Old rollout notes remain historical, never reset/reapply from them.

## Actual outstanding connections
- Git HTTPS/API/push verified. Vercel API specifically returns missingToken; VERCEL_TOKEN absent. GitHub has not yet supplied new Vercel deployment object/status, so management terminal state/ID remains unverified despite the current production runtime.
- SUPABASE_ACCESS_TOKEN absent; remote migration history unverified. No production database modifications.
- Secure binding requirements saved in environment settings. Do not request values in chat. Read-only helper: python3 scripts/Verify-InsightsConnections.py (current missing-binding result is expected).
- Local Docker vfs/32 GB cannot extract PostgreSQL. CI supplied real backend validation; do not retry that setup unchanged.
- Private production writes and physical phone behavior not claimed.

## Safety and scope
Person != Participant; F = E - T + R; immutable accepted history; existing transactional/versioned RPCs, RLS and idempotency preserved. No schema change currently planned. Production private writes and physical phone behavior must not be inferred from public/PWA checks.

## Current implementation / validation
- Implemented shared snapshot, scoped paper UI/popovers, records route and original expense editor; see docs/insights/IMPLEMENTATION.md.
- Changed App/AppShell, InsightsPage, ledger/change/scroll hooks, i18n, PWA precache; new SpendingRecordsPage, spending selectors, insights components/tokens/assets, unit and browser tests. Dependency declarations/lockfile/migrations unchanged.
- Local 519 Vitest / 77 files, ESLint, production build passed. 9 intercepted-API browser checks passed, including geometry/screenshots and history/list restoration. Screenshots: test-results/insights-ui (fictional test-created rows, ignored).
- Real-backend test added to existing CI; pending run. Production unchanged by this task so far.

## Next executable step
After secure VERCEL_TOKEN/SUPABASE_ACCESS_TOKEN bindings are supplied, run the read-only connection helper. Match Vercel production deployment's git SHA to main/app release, confirm terminal state and alias, and compare remote migration versions to current source without applying anything. Recheck live only if the published version changes. Update this checkpoint and the release report with actual metadata; do not redo Insights/Records or existing QuickAdd/Trip features.

## Supplementary correction in progress
Final review found zero-own-share confirmed records were mislabeled as an empty ledger. fix/insights-zero-share distinguishes zero contribution from zero count without financial changes; relevant unit/UI and real-Supabase regression coverage added. Await this branch's CI/merge before final release checkpoint; prior source release remains 3f76185.
