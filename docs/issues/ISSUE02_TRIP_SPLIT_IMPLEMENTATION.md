# Issue 02 — Trip split and directed friend requests

Status: implementation and exact-source validation PASS; production blocked on missing database migration write permission. NOT production released.
Branch: `feat/trip-split-friend-requests`; [PR41](https://github.com/monowanderer373/monosplit/pull/41) DRAFT. Tested application commit `0a20c2b9732e07a6bfb5583f8db90fba4328b49a`. Baseline main39ea75d, clean at start.
Package README and all seven specs/checklists/decisions/short prompt read, both
approved design boards viewed, all12manifest hashes verified. Issue01 retained;
Issue03–05 explicitly excluded. No automatic old-expense change.

## Actual diagnosis and implementation

The original Space resolver already queried Space membership without friendship
filtering. We did not claim that production filtered nonfriends. The original
Trip Edit people route could enter a generic Friends picker; defaults differed
by entry; consumers also filtered payers/forced recorder selection. The editor
loaded only original participants and used non-Space type-change authority to
lock Space selection. Tests reproduce and verify the complete nonfriend path
through real isolated Auth/API rather than infer a root cause from fixture UI.

Trip capture now stays on current member candidates; revalidates on open/submit;
all effective roles/manual members remain candidates. New Trip defaults self;
Select all/Only me change consumers, never payer amounts. Explicit old draft
values (including an empty invalid selection) restore; next new Trip starts self.
Consumers and financial principals are separate: compiler retains recorder,
positive payers and stable IDs, Equal divides consumers only, all amounts use
original deterministic minor-unit functions and validation. Other-account payers
do not authorize their wallets; own funding remains gated by own contribution.
Legacy drafts without consumer IDs keep original compiler behavior. Direct and
Group defaults/selection/principal rules remain unchanged.

Impact confirmation preserves exact amounts/items for review. By item edits
must be recalculated before Apply; excluded assignments require explicit removal.
Apply updates only the draft; close/Escape restores the earlier draft. No ledger
switch is hidden behind changing Trip consumers. The original top ledger picker
remains the explicit way to switch context.

Trip editor combines complete current candidates with original historical rows,
keeps old order/payment/share/version and left-member names/amounts, appends new
principals stably, and uses original authorized Space correction. No-change
opening/saving does not issue a new version; review shows old/new paid/shares.
Current view role cannot edit, unknown membership blocks mutation, an arriving
new version blocks stale Trip submission, repeated identical corrections reuse
one request key, and identity/expense changes remount private draft state.
Old departed principals are not silently removed; original backend restrictions
can reject a financial correction retaining them. Metadata/history stay intact.

## Friendship service and UI

One new forward migration202610280001, no deployed migration edits or financial
schema changes. Existing friendship accepted/blocked/archived types and original
atomic two-sided Person trigger are reused. Separate request lifecycle and
private actor/command receipts avoid redefining friendship or manual linkage.
Four minimal RPCs:send/respond/Trip pair states/pending review. Sends verify
normal accounts and both effective source Trip memberships, use canonical-pair
advisory locks plus a pending unique index, and never autoaccept crossed sends.
Responses are actor-bound/versioned/terminal; original accepted request retries
are idempotent, cancelled/declined requests cannot be revived by old commands.
Only both parties can read; no direct client writes/anonymous execute/private
receipt reads. Source name snapshots permit authorized post-leave receipt,
without opening Trip/financial access. Accepted relationship survives leaving.
Requests expire after7days; decline has a24hour pair cooldown, without disclosing
who blocked whom. No email/SMS/external push or finance operation.

Members displays ＋/Sent/Accept/Friend/unavailable with original role menu.
Self/manual/anonymous cannot initiate inappropriate requests. Cancel/Decline
reuse the original row menu. Shared Review reads the same request IDs and dedupes
counts, using server time/current acceptance capability. Blocked acceptance is
disabled/rejected; decline/cancel can dismiss without establishing friendship.
Identity/generation checks, synchronous dispatch lock, persisted command key and
authoritative requery protect unknown responses and account changes.

## Current validation

- Exact application source: `0a20c2b9732e07a6bfb5583f8db90fba4328b49a`.
- Local full unit: **763 tests / 112 files PASS, 41.96s**. Lint, TypeScript and PWA build PASS; exact-source CI app PASS.
- Eight actual-React/CSS synthetic phone browser cases **PASS, 45.5s**:320/360/390/430px;125/150/200%root text;420pxshort viewport;Chinese/long names;44px actions/focus/Escape;consumer/payer independence;Amounts/items/recalculation;Apply/cancel/reopen;request Review/unknown response;approved Trip checkbox computed style. These fixtures are not backend/RLS or physical-phone evidence.
- Exact-source disposable backend: **3 authenticated browser journeys PASS,1.3min**. Complete nonfriend Travel capture; payer-only correction and old/new lineage; real member request→Shared acceptance→both normal Person/friend lists; original financial table facts unchanged. Separate full relational journey preserves odd-cent remainder, multi-payer, Direct/manual shares, partial settlement/reversal, offline once-only sync and Realtime. It verifies both known-downgrade preflight draft retention/0serverwrites and real server denial/outbox recovery after authority changes in flight. The latter holds a real request for deterministic timing; it does not replace its server response.
- **1021 SQL assertions /22files PASS**, strict DB lint, opposing authenticated sessions/pair-lock/onepending/zeroautomaticaccept, original monetary concurrency suites and historical guardedinstaller twice PASS on the same source. All Supabase resets were isolated CI loopback, never hosted.
- Exact-source **234 production-module UI,16Travel,10CollectPay PASS**. Complete authenticated browser suite **393 PASS,11.4min**. [Quality40716644699](https://github.com/monowanderer373/monosplit/actions/runs/40716644699): **all8jobs SUCCESS,zero failure annotations**, no retry/flaky entry in the final summaries.
- Historical failed candidates are recorded in WORK_LOG. The remainder diagnostic proved a transient generic-picker test race (self-onlyRM10.01); immediate Trip configuration and explicit awaited Select all fixed it without changing the original2.51 assertion. Known-role downgrade is now caught earlier; the original server/outbox witness remains covered by an actual in-flight role change.
- Known local Docker vfs capacity blocker was not blindly retried; disposable GitHub Actions supplies real backend coverage. Physical Honor, Android system Back/native IME/browser UI zoom/screenreader **NOT RUN**. Root-text/viewport emulation does not prove these.

## Deployment boundary and recovery

Production connection independently verified on2026-10-28:

- Management SQL even read_only=false: `supabase_read_only_user / transaction_read_only=on`.
- Official `POST /v1/projects/skiqsxvmxvmxfzhrzcxh/database/migrations` attempted once **after all8checks passed**; **HTTP403: Missing required permission(s): database_migrations_write**. No role escalation or blind retry.
- Independent post-rejection catalog readback: original32migrations, neither new request nor private receipt table exists. No Issue02 backend/client production change.
- Existing Vercel project/team verified; current native READY is prior Issue01 `dpl_21riztzT7xVtAGeTPstrAYaAL9nJ`, main `39ea75d65a92a1ecf7d516ed206cfb659a4ea0b3`. Canonical existing URL: https://tabby-tally-monowanderer373s-projects.vercel.app/ . This is **not Issue02 live evidence**.

Remaining operator action: download this [complete pinned SQL](https://raw.githubusercontent.com/monowanderer373/monosplit/0a20c2b9732e07a6bfb5583f8db90fba4328b49a/docs/runbooks/trip-friends-production-apply.sql) (**21,241bytes**, SHA256`0070242ed1cd046da646045cf81c3cf19314a90d05aad3823334409cd1688401`), then run the whole file in the [existing project's SQL Editor](https://supabase.com/dashboard/project/skiqsxvmxvmxfzhrzcxh/sql/new). It is a guarded transaction requiring the exact32baseline, verifies all four new function bodies/RLS/privileges and registers only the additive migration. It sends/accepts no request, changes no bill/balance and does not execute Reset. Success marker: `TABBY_TRIP_FRIENDS_INSTALL_COMPLETE_20261028`. Use the full downloaded file, never a chat preview or an old Reset installer.

Once the operator reports completion, independently read back exact33versions/four source hashes/two RLS tables/no direct client writes/no anonymous execute/private receipt visibility/10protected original function definitions and ACLs/Realtime binding. Then check the new read RPCs through ordinary existing owned-QA sessions. Prepared recovery scripts retain the original schema snapshot privately; it is not a full database backup. Do not re-run a rejected API write or repair history blindly.

Only after verified schema installation, complete PR41/main and the existing production release. Then independently verify native READY/exactmainSHA/publicchunks, real owner/viewer Trip candidates/defaultself/Selectall/cancel/permission/identity/back, financial hashes and retained PWA update. These **Issue02 production/authenticated/PWA checks are NOT RUN**, because publishing a client over absent RPCs is blocked. Actual directed-consent/financial writes were verified on disposable CI; production customer/private accounting mutations are not QA. Prepared live scripts use existing tagged-owned QA and read/review/cancel only. No physical phone success is claimed.

Evidence/recovery:/workspace/verification/issue02-trip-split-2026-10-28.
Read PROJECT_STATUS/WORK_LOG/current diff before resuming.

## Modified files

- `.github/workflows/quality.yml`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE02_TRIP_SPLIT_IMPLEMENTATION.md`
- `docs/runbooks/trip-friends-production-apply.sql`
- `docs/runbooks/trip-friends-sql-editor.md`
- `e2e/multiuser.spec.ts`
- `e2e/trip-split-backend.spec.ts`
- `e2e/trip-split-ui.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `scripts/generate-trip-friends-apply.py`
- `src/components/ExpenseActionSheet.tsx`
- `src/components/SplitConfiguration.tsx`
- `src/components/TripExpenseCorrection.test.tsx`
- `src/components/TripSplit.test.tsx`
- `src/components/UniversalQuickAddSheet.test.tsx`
- `src/components/UniversalQuickAddSheet.tsx`
- `src/components/quick-add-v3.css`
- `src/components/shared/shared-a.css`
- `src/components/travel/trip-members.css`
- `src/hooks/useTripFriends.test.tsx`
- `src/hooks/useTripFriends.ts`
- `src/hooks/useUniversalQuickAdd.continue.test.tsx`
- `src/hooks/useUniversalQuickAdd.tsx`
- `src/lib/compileExpense.ts`
- `src/lib/i18n.ts`
- `src/lib/travelQuickAdd.ts`
- `src/lib/tripFriendRequests.ts`
- `src/lib/tripSplit.test.ts`
- `src/lib/tripSplit.ts`
- `src/lib/universalQuickAdd.ts`
- `src/pages/SharedPage.tsx`
- `src/pages/SpaceMembersPage.tsx`
- `supabase/migrations/202610280001_trip_friend_requests.sql`
- `supabase/tests/trip_friend_concurrency.py`
- `supabase/tests/trip_friend_requests.sql`
