# Trip overview records — 2026-10-30

Completed (Asia/Bangkok). Baseline clean latestmain b3a3de989e818a5048071e391c9f08391dc1cd69. Preserve published Issue01–05, all financial rules and private data.

## Cause and resulting behavior

Travel Trip overview reused buildHomeRecords/isBookedHomeExpense from the personal ledger. Those deliberately require the viewer's participation and omit zero-paid/zero-share records. A readable Trip bill paid entirely by another member therefore appeared in Shared's ledger but incorrectly showed No expenses yet in the overview.

The overview now displays the original authorized active/visible shared Trip expenses directly. Overview and ledger share one selector and one original expense-row presentation: original bill total/currency, date, Paid by and Your share. A member-only RM1000 bill remains visible even if your personal spending/share is RM0. Summary record count uses the full same list rather than the first20 rendered rows. My spending keeps its original personal definition. Travel home and private affiliation-label views remain personal; private labels are not turned into shared bills.

Original edit/correction/read-only details and fresh membership validation are reused. No new ledger/RPC, financial calculations, schema, RLS, wallet/balance/identity/settlement change or migration. Reset-hidden/voided/foreign/personal-scope rows stay excluded; original pending recovery remains visibly pending. Amount privacy/reveal, per-currency precision, Overall/Compact, single global+, dates/Members and source-bound return remain. Showmore state is bounded numeric presentation metadata per identity/Trip; returning retains25 expanded bills and trigger focus. Restoration waits for the shared-record layout, rather than restoring while the list is still loading.

## Actual validation

Local834units/121files PASS69.90s (concurrentbrowserload), lint/TypeScript/PWA build PASS. Final39actual React/CSS overview+ledger+navigation cases PASS1.2min, including9new overview cases. Four widths320/360/390/430,125/150/200% actual root text, longChinese/large money,25billpagination+Back, reset/foreign/cancelled exclusion, read failure/retry, currencies, privacy/explicitreveal/read-only and Overall/Compact are covered with synthetic API fixtures.

Exact source `107ea47310bef9e7f19f51490fd847ca2227fa73`; [Quality41005996839](https://github.com/monowanderer373/monosplit/actions/runs/41005996839) latest8jobs PASS, run attempt1. Full browser had449 directly passed plus1 original multiuser flaky case: the stale-role stage timed out locating the original QuickAdd control for30s, then passed on configured retry. The same full journey passed directly in the native job. No assertion or timeout changed. Details are preserved verbatim below; this is not a zero-retry claim.

| Job | Result | Actual evidence |
|---|---|---|
| production-ui | PASS |   288 passed (5.3m) |
| database | PASS | PASS: duplicate commit, real ordinary-writer exclusion/stale rollback, in-flight receipt recovery, delayed-request fence and native opening conservation / 15 deterministic signed-balance property samples; PASS: duplicate commit, real ordinary-writer exclusion/stale rollback, in-flight receipt recovery, delayed-request fence and native opening conservation / 15 deterministic signed-balance property samples; Files=22, Tests=1021,  6 wallclock secs ( 0.19 usr  0.06 sys +  0.23 cusr  0.18 csys =  0.66 CPU); Result: PASS |
| historical-database-upgrade | PASS | All required steps passed |
| browser | PASS |   1 flaky /     [mobile-chromium] › e2e/multiuser.spec.ts:57:3 › local relational multi-user journey › runs one stateful relational multi-user journey  /   449 passed (10.8m) |
| travel-browser | PASS |   17 passed (3.0m) |
| app | PASS | All required steps passed |
| trip-members-browser | PASS |   11 passed (2.6m) |
| collect-pay-browser | PASS |   10 passed (35.5s) |

The original native Trip ledger test now records an actual additional member-only RM1000 bill through create_expense: owner is absent from its participation list, overview shows4records/bill1000/PaidbyMia/share0, while owner's personal spending remains420. Original collect300/pay100, pending/accepted/reversal cash conservation, immutable expense rows and readonly permission/history assertions all remain. This is disposable real Supabase evidence, separate from synthetic UI tests. SQL strict lint/concurrency/history are also isolated CI checks.

Initial UI helper errors were corrected to original en-MY US$ formatting, original readonly + chooser/safe exit and original hidden Open record/explicit reveal controls. No formatter, permission or money assertion was weakened. The expanded-list Back regression was reproduced before its forward fix; final return25/focus witness passes. Earlier candidate results are historical, not substitutes for the final exact source.

## Published version and live evidence

[PR46](https://github.com/monowanderer373/monosplit/pull/46) merged to main `3851194cae82fd3c9b512634ca9fca2305bd3d73`; whole merged Git tree equals validated source. Existing monowanderer373s-projects/tabby-tally production: **READY `dpl_5dgqwKJE7NPkCvhPzZGkZWWipYmt`**. [Live](https://tabby-tally-monowanderer373s-projects.vercel.app/). Exact public SHA, new overview component, actual shared CSS bundle containing both overview and ledger classes, original01–05 routes and current PWA precache are verified. A final documentation-only checkpoint follows; final exact SHA/nativeREADY/public/PWA evidence is in delivery-final.json.

Normal password login by two existing tagged owned QA accounts with actual owner/view roles and no API interception PASS: canonical Trip overview records UI, Shared/Travel source chains, two independent tabs, Members/Dates/History/Summary, readonly gate, original generic/concreteTrip+, legacy/direct routes, create review+Cancel, eightphone/text geometry checks. Zero mutation RPCs/runtime errors/private screenshots; tenfinancial-table hashes per account and membership unchanged. The retained production QA Trip is empty: **the nonempty member-only bill case was not created in production**, and is proven by native disposable CI above. No customer, production bill, wallet, invite or membership test writes.

Retained PWA native update/activated current entry and actual route/CSS cache PASS without cache deletion; five paper-material and four offline asset hashes match source. Four-width signed-out Trip/date privacy guards and offline shells PASS. Fresh read-only Supabase verification finds33exact local/remote migrations, original date RPC body/version/ACL unchanged. **No SQL/manual installation required.**

## Limits and recovery

- Local Supabase BLOCKED by known Docker vfs storage limitation; not retried. Native backend tests ran on disposable Actions.
- Physical Honor, native OS keyboard/Back, browser UI zoom and real screenreader NOT RUN. Chromium viewport/rootfont/Back is not hardware evidence.
- Production nonempty bill/financial/Reset/invite/member mutation tests NOT RUN; production QA was read-only/review+Cancel. Original private Trip remains available for recovery.
- Screenshots use actual React/CSS with synthetic data; no production/private screenshots. Existing theme and original personal-spending definition retained.

Safe screenshots/comparison, CI/native/public/version/cache/schema and financial-invariance proof are delivered separately. Resume PROJECT_STATUS/WORK_LOG/currentdiff and /workspace/verification/trip-overview-records-2026-10-30. No pending operator action; never replay old SQL, Reset or production financial fixtures.

## Changed files (14)

- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/releases/2026-10-30-trip-overview-records.md`
- `e2e/trip-ledger-backend.spec.ts`
- `e2e/trip-overview-records-ui.spec.ts`
- `playwright.production-ui.config.ts`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripExpenseList.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/TripOverviewRecords.tsx`
- `src/components/travel/trip-ledger.css`
- `src/lib/tripLedger.test.ts`
- `src/lib/tripLedger.ts`
- `src/pages/PersonalLedgerPage.tsx`
