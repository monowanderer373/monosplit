# Issue 03 — Trip dates implementation

2026-10-29 Asia/Bangkok. Completed on `feat/trip-dates-page`, merged via [PR #43](https://github.com/monowanderer373/monosplit/pull/43); baseline latest main `02cac4a6496b1250022d785e135a61aa556b16cd`. Only Issue03; no Issue04/05.

## Requirements and implementation

Complete package README, execution prompt, specification, integration notes, acceptance checklist and decisions read; approved board reviewed and all nine manifest hashes matched. Latest repository/services take precedence over historical package commit.

- Compact Trip overview: name/status, inline clickable calendar/date range, separate currency. Removed standalone Edit trip dates and duplicated inline editor. Trip info points to the same dedicated page. View members see plain dates.
- Lazy `/travel/trip/:tripId/dates`: one continuous calendar, explicit Start/End reselection, same-day ranges, no reversed/half persistence, Dates not decided yet. Local postponed toggles retain selected dates; only explicit Save persists null/null. Original creation fields remain.
- Date-only ISO selection supports year0001–9999, leap/month/year boundaries, arbitrary month/year jump, localized labels and keyboard navigation. Never swaps reversed endpoints or derives persisted days through browser timezone.
- Original `update_space` only: fresh role/version read, original reviewed name/currency/version, no version overwrite. Conflict retains draft/month until explicit latest load. Network/transport unknown outcomes reconcile against authoritative data; no blind replay. Duplicate clicks, stale Trip/identity responses and late navigation fenced.
- Same-Trip trusted return, direct/reload fallback, scroll/focus restoration, native Back and unavailable Shared Trips fallback. Only date route hides global+; other Trip/Members navigation retained. Real reads refresh after successful date metadata changes.
- No schema, RLS, dependency, financial formula, expense/correction/settlement/history/membership change. Dates do not filter historical records or archive/close Trips. Group, personal affiliations and original Trip creation remain intact.

## Validation results

| Status | Check | Actual result |
|---|---|---|
| PASS | Baseline |764units/112files |
| PASS | Current unit/lint/typecheck/build/audit |798units/115files; npm test, npm run lint, npx tsc -b, npm run build; exact-source CI app also passed audit |
| PASS | Focused phone UI |14actual React/CSS production-graph cases,49.5s; isolated synthetic API fixtures, not backend proof |
| PASS | Complete browser regression |409passed,12.2min; zero failure annotations/no flaky retry summary |
| PASS | Production module graph UI |249passed,4.3min |
| PASS | Real isolated Trip/multiuser |9passed,1.9min; original date creation/lifecycle/role/version tests and two-user conflict with immutable expense, accepted settlement and cash history |
| PASS | Travel / CollectPay |17passed,3.1min /10passed,41.5s |
| PASS | Disposable database |1021pgTAP assertions/22files, strict lint, concurrent commands, historical upgrade and twice-applied installers |
| PASS | Production authenticated verification |Two tagged-owned QA accounts, real unmodified APIs; details below |
| PASS | Production PWA/public guards |Retained worker update/current assets/offline date shell; four phone widths |
| BLOCKED | Local Supabase |Known Docker vfs storage limit; not retried. Actual backend tests ran on disposable GitHub Actions |
| NOT RUN | Physical device / assistive technology |Honor/Android system Back/native OS keyboard/actual browser UI zoom/screen reader; emulation is not physical proof |

Exact-source [Quality40849123139](https://github.com/monowanderer373/monosplit/actions/runs/40849123139), candidate `5e37b9924860acbae9ca7ce377ae25dd8c59ba74`: all8jobs SUCCESS, zero failure annotations. Original financial/permission/version assertions retained. Original five native period journeys now exercise the calendar; sixth real conflict preserves ten financial tables per account after an original expense, accepted settlement and cash legs. Only actual outbound timing is held; the server request/response remains unmodified.

Phone coverage:320/360/390/430CSSpx,125/150/200%roottext,420px short viewport, long English/Chinese names and complete cross-year date groups,44px calendar targets, arrow/Home/End/PageUpDown/Enter/Space, explicit range/endpoints/year0001–9999/leap/same-day/postponed, error/retry/conflict/unknown response, current identity/Trip guards, Save/Back/scroll/focus/direct reload and two browser timezones. Keyboard inset uses visualViewport simulation; native IME is not claimed.

## Production release and verification

- Application merge: `c06f80ed053bdacbc601b0d9755915d8ced0ac85` on main. Entire GitTree equals validated5e37b99; normal fast-forward checkout, no force push.
- Existing Vercel project/team `monowanderer373s-projects/tabby-tally`; native production **READY** `dpl_GZkh86U6WerR62g7K1qEdqMrrhqE`.
- Live: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Public `index-DCJ9XVZ3.js` contains exact merge SHA; current Dates JS/CSS and existing main routes are precached.
- Correct production Supabase independently read-verified:33exactlocal/remote migration versions, latest202610280001, original update_space role/version guards and authenticated-only execute. No migration/new SQL/operator action.
- Normal existing tagged-owned owner/viewer QA, no API interception: four phone widths×100/200%roottext; owner actual UI save to leap/cross-month dates and a second forward versioned UI save restoring original dates on retained empty QA Trip. Exact original name/currency/Trip/version/date payloads verified; no financial mutation or customer metadata touched.
- Same-Trip focus, info entry/return, direct reload/browser Back, global+ restoration, current account-local today with Honolulu browser, viewer route rejection and identity switch passed. Two users×10financial-table hashes and active roster unchanged; runtime errors0/private screenshots0. No production Reset, expense, settlement, friend-request or membership QA write.
- Retained profile/native service-worker update (no cache deletion), activated/current entry+Dates/Members/Home/Records/Accounts/Shared/Profile chunks,5paper-material and4offline-asset source hashes, signed-out guards at all four widths and offline Dates shell passed.
- One initial public sw.js read returned transient503 after READY; an independent reread and subsequent real browser update/cache checks succeeded before QA. No design fixture or fallback substituted.
- Final documentation-only checkpoint may have a later commit/deployment. Final exact SHA/native READY/current PWA readback is stored externally in `delivery-final.json` to avoid self-referential report commits; runtime source remains identical to this validated release. Do not repeat owned-QA date mutations for a docs-only commit.

## Evidence and recovery

Local evidence `/workspace/verification/issue03-trip-dates-2026-10-29`; synthetic screenshots `test-results/trip-dates`. Read PROJECT_STATUS/WORK_LOG/current diff before resuming. Preserve deployed33migration history; do not replay older SQL, reset production or introduce Issue04/05. Exact-source CI, PR/merge, existing Vercel READY/public SHA, normal owned-QA date checks and retained PWA update completed. No remaining manual action. Final docs-only version evidence is kept externally; do not replay metadata tests or older SQL.

## Component comparison

| Component | Approved reference applied | Necessary preservation/adaptation |
|---|---|---|
| Overview heading | Compact name/status; inline calendar/range/arrow; separate currency; no standalone edit/form gap | Existing spending-card map texture, member component and global+ retained; no Issue04 redesign |
| Date editor | Paper page, blue endpoint summaries, single range calendar, hint/postponed option, fixed Save | Native accessible checkbox,44px date targets; narrow/large-text summaries stack |
| Calendar controls | Blue circles and pale continuous range, previous/next and month/year entry | Supports year0001–9999 and actual locales rather than fixed reference month |
| Errors/navigation | Reviewed-date save and cancel/back | Real PostgREST conflict normalization, explicit latest load, ambiguous-save readback, actor/Trip-bound restoration |

Synthetic actual-component screenshots and approved board are in the external delivery gallery. No design-board image is used as production UI or data. Physical-device validation is not implied.

## Initial failures and corrections

First native run rejected390px200%-text endpoint layout and the two-user conflict message. Fixed intrinsic rem-based endpoint columns and date-editor-local extraction of actual PostgREST message objects; no global error behavior or original financial/version assertion was changed. Both were subsequently verified against exact-source all8-success CI and the authenticated production date flow.

## Modified files

- `.github/workflows/quality.yml`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE03_TRIP_DATES_IMPLEMENTATION.md`
- `e2e/fixtures/tripDates.ts`
- `e2e/trip-dates-ui.spec.ts`
- `e2e/trip-period.spec.ts`
- `playwright.production-ui.config.ts`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/travel/TravelUI.test.tsx`
- `src/components/travel/TripDateEntry.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripPeriodEditor.test.tsx`
- `src/components/travel/TripPeriodEditor.tsx`
- `src/components/travel/TripRangeCalendar.test.tsx`
- `src/components/travel/TripRangeCalendar.tsx`
- `src/components/travel/trip-dates.css`
- `src/components/travel/trip-period.css`
- `src/hooks/useHomeData.ts`
- `src/hooks/useTripDatesReturn.ts`
- `src/hooks/useTripPeriodEditor.ts`
- `src/lib/i18n.ts`
- `src/lib/tripCalendar.test.ts`
- `src/lib/tripCalendar.ts`
- `src/lib/tripDatesEvents.ts`
- `src/lib/tripDatesNavigation.test.ts`
- `src/lib/tripDatesNavigation.ts`
- `src/lib/tripDatesTranslations.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SharedPage.tsx`
- `src/pages/SpacePage.tsx`
- `src/pages/SpacesPage.tsx`
- `src/pages/TripDatesPage.tsx`
