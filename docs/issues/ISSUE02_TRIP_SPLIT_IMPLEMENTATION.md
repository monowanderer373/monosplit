# Issue 02 — Trip split and directed friend requests

Scope: **Issue02 only**, building on delivered Issue01 Members. No automatic old-bill edits or Issue03–05. Package README/all specifications/acceptance/decisions were read, both approved design boards viewed and all12manifest hashes verified. Initially clean baseline main39ea75d; React/TypeScript/Vite/Supabase/PWA retained.

[PR41](https://github.com/monowanderer373/monosplit/pull/41) and [PR42](https://github.com/monowanderer373/monosplit/pull/42) MERGED. Validated final application `de769d1af06c38efbe2a82aa83f318bd3ce8bc39`; mergedmain `5c441357f778374e16630463061d90e5bb6a3357`, entire Git tree equal. **Live application verification COMPLETE on2026-10-29Asia/Bangkok.** No remaining manual SQL/connection action.

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

## Pending member-response draft preservation

A deferred-read regression reproduced a real overwrite: a user's new99/consumerfriend/payerfriend99 was replaced by opening20/self/payerself20 after member validation completed. Same-context Trip refresh now uses the latest same-session draft after authority returns; opening the panel omits stale explicit consumer IDs. Explicit Cancel still restores the panel's original snapshot. Original generation/session/current-membership/request-id fences remain; Group/Direct/formulas/schema are unchanged.

Provider and production-graph browser tests hold the member response while changing consumers, payments and Amounts, then verify retention/Apply/reopen and no financial write. Trip member validation continues to block Apply until the authority read completes. The initial native close test was corrected to await that readiness before Esc and panel disappearance; no product guard was removed.

## Actual validation

- **764unit tests /112files PASS34.57s**; lint,TypeScript and production/PWA build PASS.
- [Exact-source Quality40820323116](https://github.com/monowanderer373/monosplit/actions/runs/40820323116): **all8jobs SUCCESS**. Complete authenticated browser **394PASS10.6min**; production-module UI **235PASS**; focused actual backend Trip/Members/full relational journey **3PASS1.5min**; CollectPay **10PASS**; Travel **15PASS+1flaky,retryPASS**. This run is not zero-retry. Earlier failures and real fixes are retained in WORK_LOG; original money/RLS assertions were not relaxed.
- **1021SQL assertions /22files PASS**, strict DB lint, real opposing authenticated sessions/pair lock/singlepending/no automatic crossed acceptance, all original financial concurrency suites and historical guardedinstaller twice PASS. Every database reset used disposable CI loopback, never hosted.
- **9synthetic actualReact/CSS phone browser cases PASS45.5s**:320/360/390/430px;125/150/200%roottext;420pxshort viewport;Chinese/long names;44px actions and Esc/focus;consumer/payer independence;Amounts/items/recalculation;Apply/cancel/reopen;Review/unknown-response reconciliation;approved Trip checkbox computedstyle;held-membership edit retention. These are not RLS/physical-phone evidence.
- The real isolated nonfriend journey covers Travel capture, independent payer-only contribution, authorized correction/new replacement ID+lineage and immutable old facts, member request→recipient Sharedacceptance→both normal Person/friend lists, with financial facts unchanged by friendship. Full relational regression retains original remainder/multiple-payer/Direct/manual/partialsettlement/reversal/offline-once/Realtime assertions. Both known downgrade preflight/retaineddraft/0serverwrites and post-validation in-flight downgrade/actual server rejection/outbox Retry are tested. Only the latter request is held for deterministic timing; its response comes from the real isolated server.

## Production schema and service

Installed by the user in the existing `skiqsxvmxvmxfzhrzcxh` project. Independent live catalog verification PASS: **33exactmigrationversions,4canonicalRPCbodyhashes,2RLS tables,no direct authenticatedwrites,no anonymousexecute,private receipts hidden,10protected original function definitions+ACLs unchanged,Realtime publication**. Both ordinary existing tagged-owned QA accounts pass new Trip-state and pending-review readRPCs.

The earlier official API403/database_migrations_write limitation was resolved by the full SQL Editor install. Migration202610280001 is now immutable deployed history. No further SQL or manual connection action is needed. The schema-only private source/ACL snapshot is not a full database backup. The auxiliary QA helper's named argument was aligned to source_trip_id; the application already used this correct parameter.

## Production release and native checks

Existing Vercel team `monowanderer373s-projects`, project `tabby-tally`; canonical URL https://tabby-tally-monowanderer373s-projects.vercel.app/ . Native deployment `dpl_BXCKk2NvQLfASdRvkSPPfLKLgL2q` **READY**, actualmainSHA `5c441357f778374e16630463061d90e5bb6a3357`. Public entry `/assets/index-C9624PPN.js` contains this exactSHA and current route/PWA chunks. This is the existing app, not a replacement project.

Normal existing tagged-owned QA owner and viewer, **no API interception**, PASS:complete real Trip candidates/defaultself/Selectall/cancel,owner/view permission controls,currentTrip global+,identity switch,sameTripreturn,8width/roottextcases. A **5000msCDPnetworklatency** case uses the actual server while editing consumers,payments and Amounts, then verifies late-response retention/Apply/reopen. This is network emulation, not physical-phone timing. Ten financial-table hashes per account and membership facts remain unchanged;0financial/membership mutationRPCs/0runtimeerrors/private screenshots.

RetainedPWA nativeupdate/activatedworker/currententry+Members/Home/Records/Accounts/Shared/Profile cache PASS. Five paper-material and four offlineHome/QuickAdd asset hashes equal source. Four-width signed-out Members privacy guards and offline shell PASS. No cache deletion. Proofs are allowlisted in delivery-live; no customer data/session or secret is included.

The final documentation checkpoint may have a newer commit/deployment; its exact nativeREADY/publicSHA/currentPWA evidence will be stored externally in delivery-final.json to avoid a self-referential report commit loop. Runtime source must match the verified application commit.

## Remaining verification limits

- Physical Honor,Android systemBack/nativeIME/browser UI zoom/screenreader **NOTRUN**. CSSviewport/root-text/CDPnetwork emulation is not physical-device proof.
- Production friend-request consent, financial corrections/settlements and Reset **NOTRUN as QA mutations**. These writes were tested with real Auth/RLS on disposable CI. Live checks use existing tagged-owned QA/read/review/cancel, not customer bills/membership. No private screenshots or credentials are included.
- Known local Docker vfs capacity limitation was not blindly retried; actual backend validation ran on disposable GitHub Actions.

## Recovery and evidence

Read PROJECT_STATUS/WORK_LOG/currentgitdiff first. Evidence root `/workspace/verification/issue02-trip-split-2026-10-28`; final safe gallery/ZIP is delivery-live. Do not rerun old SQL/Reset/financial fixtures or implement Issue03–05 without a new task. Deployed migrations and original confirmed financial facts remain frozen.

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
