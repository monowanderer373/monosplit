# Trip History same-page tab — Implementation Report

2026-11-01. [PR50](https://github.com/monowanderer373/monosplit/pull/50), validated source `28f6fdff1bcec9249d0599be7b153c5282d26be4`, application main `140966ed7681160f06d820db941ca015ed888cf1` (whole tree equal). [Quality41304169132](https://github.com/monowanderer373/monosplit/actions/runs/41304169132): all eight jobs passed. Existing Vercel Production READY `dpl_5Jn1aiATWp9hkHhoWdNY26Fc1rby`; exact main SHA and new History JS/CSS verified at https://tabby-tally-monowanderer373s-projects.vercel.app/ . A final documentation-only checkpoint may follow; its actual READY/public-entry/PWA evidence is recorded in delivery-final.json, with runtime tree equality to this validated source.

## User-visible changes
- Expenses / Balances / History are three tabs in the same Trip workspace. History is to the right of Balances, with the same Trip header and spending card. Removed the ⋯ menu and its History / Trip summary / Members / Refresh entries. The existing header Members link remains. Automatic focus/online refresh and failure Retry remain.
- History filters: All / Expense changes / Payments. Keep authorized corrected/cancelled version chains, metadata updates/restorations, completed/declined/cancelled payment facts and reversals. Ordinary new bills stay in Expenses; pending payment actions stay in Balances. Exclude creation/member/technical noise and raw event diffs. Derived allocation/credit explanations are expandable; original versions, dates, statuses, amounts and permitted reversal actions remain.
- Legacy History/activity URLs render the new tab. Old read-only Summary deep links remain compatible without a menu entry. Source-bound Members/date returns, tab/filter URLs, keyboard navigation and existing scroll/focus mechanisms remain. Amount hiding unmounts History feeds. Failed private-affiliation or history reads offer Retry instead of reporting a false empty state. Authorized own-private labels are never obtained from raw event diffs or unrelated event IDs.

## Integration and safety
Original financial history readers, immutable corrections and settlement/reversal controllers are reused. No formula, integer currency arithmetic, principal identity, RLS, schema, database migration, dependency, old bill or permission rule changed. Global/Group Activity and history keep their original defaults. Original zero-own-share Trip expense visibility remains covered by real backend tests.

A full-suite regression exposed an existing timing hazard: settlement reads could finish after Quick Add opened; safe-parent seeding after Back then truncated the draft's Forward entry. A deliberately delayed response reproduced the failure before the fix. Trip now prepares its safe parent at verified authority, independent of payment-read readiness. Original overlay guards and all financial permissions remain. The controlled-delay test and original split-cancel/draft restoration flow pass afterward; no timeout or financial assertion was weakened.

## Actual verification
| Check | Result |
| --- | --- |
| Units / lint / TypeScript / production PWA build | 867 units / 124 files; all passed |
| Focused final navigation units | 16 passed |
| Local integrated actual React/CSS browser | 56 passed |
| Final local History + Forward cases | 11 passed / 54.3s |
| Final native Forward repetitions | 6 passed / 39.2s |
| Exact-source full CI browser | 492 direct passes + 1 retry pass; 0 unexpected, 0 skipped |
| Production-module UI CI | 330 direct passes; 0 flaky |
| Real isolated Travel / Trip multiuser CI | 17 / 12 direct passes |
| Isolated Collect/Pay CI | 10 passed |
| Disposable PostgreSQL | 1,081 assertions / 23 files passed; strict lint, historical upgrades and concurrency checks passed |

The single full-suite retry was a 5s History-tab locator timeout at360px. Its initial cause was not established; the original timeout/assertions were retained. The retry, independent330-case production UI run and three additional local360px repetitions passed (32.8s). Earlier failed CI runs are documented in WORK_LOG; they were not treated as successful release evidence.

Phones simulated at320/360/390/430px, with125–200% root text; no horizontal overflow in covered states. Keyboard tab selection, filter/reload, legacy links, Members/date return, hidden amounts, authorization filtering, metadata/restoration allowlist, error Retry, original payment reversal and immutable financial facts were exercised. Screenshots show actual React/CSS with fictional intercepted transport, not production/customer financial screenshots.

## Production evidence and limits
- Native Vercel READY, correct project/team/main SHA and published History JS/CSS verified. Retained PWA native update/current activated worker,18 route/material cache checks, source-equal paper materials, offline assets and eight public guard/geometry checks passed. No static cache deletion or service worker unregister was used; an explicit native update check was used.
- Two existing tagged owned QA accounts, real owner/viewer, no API interception: History filters/reload, three legacy History reload repetitions, Members/date/source return, two independent browser tabs, permissions, plus review/cancel and eight geometry cases passed.0 runtime errors /0 mutating RPCs. Twenty financial table hashes and the two-member roster remained unchanged. No production expense, settlement, Reset, member or invitation QA writes, and no private production screenshots.
- Retained production QA Trip is empty. Nonempty bills, zero-own-share visibility, confirmation/reversal and write-side permission/concurrency validation use disposable real backend CI; nonempty UI screenshots use fictional fixtures. Production payment writes were not tested.
- Physical Honor/Android system Back, native OS keyboard, browser UI zoom and screen reader were not tested. Root-font and emulated touch checks do not claim those results. No SQL installation or user manual action is required.

## Modified files
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/TRIP_HISTORY_TAB_IMPLEMENTATION.md`
- `e2e/multiuser.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/shared-navigation-ui.spec.ts`
- `e2e/travel-workspace-ui.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-history-forward.spec.ts`
- `e2e/trip-history-tabs.spec.ts`
- `e2e/trip-ledger-backend.spec.ts`
- `e2e/trip-ledger-ui.spec.ts`
- `e2e/trip-members-ui.spec.ts`
- `e2e/trip-overview-records-ui.spec.ts`
- `playwright.production-ui.config.ts`
- `src/components/ActivityFeed.tsx`
- `src/components/ExpenseHistoryList.tsx`
- `src/components/SettlementHistoryList.tsx`
- `src/components/SettlementPanel.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/trip-workspace.css`
- `src/lib/spaceNavigation.ts`
- `src/lib/tripLedger.test.ts`
- `src/lib/tripLedger.ts`
- `src/lib/tripLedgerNavigation.test.ts`
- `src/lib/tripLedgerNavigation.ts`
