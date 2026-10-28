# Issue 02 — Trip split and directed friend requests

Status: implemented, final isolated verification in progress; NOT production released.
Branch:feat/trip-split-friend-requests. PR41draft. Baseline main39ea75d, clean at start.
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

- Baseline743units/108files PASS39.34s. Current full-unit candidate754/112PASS54.78s,
  plus latest30editor tests PASS; final CI must include all lifecycle additions.
- Lint/TypeScript/build PASS on implementation candidates; latestsource CI pending.
- Eight actual-React/CSS synthetic browser cases PASS51.1s. Four phone widths,
 125/150/200%root text,420pxshortviewport,Chinese/long names,44px and Escape/focus,
 Equal/Amounts/items, payer-only payments, Apply/cancel/reopen, Review consent,
 unknown-send requery. These are not RLS/native phone proof.
- Initial dba6CI: database1010checks/22files, strict lint, real opposing-session
 lock, historical installer twice,226production UI,16Travel,10CollectPay/appPASS.
 Fullbrowser FAILED because old tests expected removed personal/Friends Trip
 controls and the new test uncheck expected immediate state before confirmation.
 Updated actual behavior tests preserve original metadata/history assertions;
 do not count this earlier failed run as a latest success.
- Final isolated DB/full browser, current four-RPC installer and all regressions
 (Direct correction, Reset/retag/settlements/funding) still require latest CI.
- Local Docker vfs capacity blocker not retried; disposable CI uses loopback only.
 Physical Honor/Android system Back/native IME/browser UI zoom/screenreader NOT RUN.

## Deployment boundary and recovery

Actual hosted Management SQL connection, even read_only=false:
supabase_read_only_user / transaction_read_only=on;32existing migrations;
request table absent. No production write/reset or customer data used for QA.
Complete all safe verification before an operator action. New guarded, full-file
installer docs/runbooks/trip-friends-production-apply.sql requires exact32baseline,
verifies canonical payload/four function hashes/RLS and repeats safely. Installing
schema alone sends/accepts no request and changes no bill, balance or account.
Successful marker:TABBY_TRIP_FRIENDS_INSTALL_COMPLETE_20261028.
Do not install an old bundle or deploy client UI over missing RPCs.

No Issue02 production success is claimed. Once the final tested schema is
installed by a supported write connection/operator, independently read back
migration/functions/RLS, merge authorized existing PR/project workflow and
verify exact native READY/public SHA, normal owned-QA scope/UI and retained PWA.
Do not reset/reseed hosted accounts or replay finance/migration history.

Evidence/recovery:/workspace/verification/issue02-trip-split-2026-10-28.
Read PROJECT_STATUS/WORK_LOG/current diff before resuming.

## Modified files

- `.github/workflows/quality.yml`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/runbooks/trip-friends-production-apply.sql`
- `e2e/trip-split-backend.spec.ts`
- `e2e/trip-split-ui.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `scripts/generate-trip-friends-apply.py`
- `src/components/ExpenseActionSheet.tsx`
- `src/components/SplitConfiguration.tsx`
- `src/components/TripExpenseCorrection.test.tsx`
- `src/components/TripSplit.test.tsx`
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
- `src/lib/tripFriendRequests.ts`
- `src/lib/tripSplit.test.ts`
- `src/lib/tripSplit.ts`
- `src/lib/universalQuickAdd.ts`
- `src/pages/SharedPage.tsx`
- `src/pages/SpaceMembersPage.tsx`
- `supabase/migrations/202610280001_trip_friend_requests.sql`
- `supabase/tests/trip_friend_concurrency.py`
- `supabase/tests/trip_friend_requests.sql`
