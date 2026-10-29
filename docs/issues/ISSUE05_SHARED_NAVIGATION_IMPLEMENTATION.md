# Issue05 — Shared navigation implementation report

Completed 2026-10-30 (Asia/Bangkok). Only Issue05; published Issue01–04 and existing financial models preserved. Baseline clean main `fa88036f76675f391929cf8e6464fe7ad2b5606c`; handoff SHA was historical, not a reset target.

## Delivered behavior

Shared Friends/Groups/Trips is the single management surface. The standalone mixed list was removed after extracting its real creation form. Travel retains its original lightweight switcher, selected Trip, display mode and private affiliation eligibility. Manage opens Shared Trips with a checked Travel return. Shared Trip/Group creation opens the new typed ledger; explicit Travel creation returns to Travel and selects only the confirmed new Trip. Cancel preserves the original selection.

Old `/spaces`, `/travel/manage` and supported create/controlled-return URLs replace directly to canonical Shared. Historical group IDs are not treated as current Space IDs; old invite tokens never invoke acceptance. `/friends` retains its URL and behavior. Actual space-invite login, guest, acceptance and original view/full roles continue through the existing services; anonymous exit and unavailable membership have safe destinations.

Bounded same-session origins bind identity, target, allowed path/query and history position. Existing Members/Dates/History navigation helpers carry the validated ledger parent. Returning restores the specific source tab/query/search/scroll/focus, original ledger batches/drafts and Travel state after data/layout readiness. Direct links use authorized type; independent Members/Dates direct links retain the original same-Trip overview fallback. Corrupt/blocked storage, unknown origins, another actor/Trip, cold lazy modules, Back/Forward and reload are handled without endless history seeding. Parent repair excludes original money overlays and stale/foreign route effects.

Shared's generic bottom + remains Personal when there is no concrete Trip. Concrete Trip +, readonly permissions and the date-page + suppression remain original. Shared reads now depend on stable ledger.refresh instead of a changing whole object. Creation reuses create_space and original date/currency rules; busy/remount/identity fences and authoritative owned-new-Space readback prevent blind retry after an unknown response. No dependencies, lockfile, schema, RLS, financial controller, historical principal or debt formula were changed.

## Validation

Local exact-source: **833 tests / 121 files PASS (42.59s)**; lint, TypeScript and production PWA build PASS. Six opaque-recovery tests PASS1.14s. Actual React/CSS navigation suite16 PASS1.6min; integrated63 navigation/Members/Dates/Ledger/Split cases PASS2.1min before three additional navigation cases. API fixtures are synthetic; actual backend evidence is separate below.

Exact source `689480a700e5705922c189f2af121d09866e7006`; [Quality40926993192](https://github.com/monowanderer373/monosplit/actions/runs/40926993192) latest eight jobs PASS. The native job required one unchanged-source rerun after an original multiuser parallel-login home-header15000ms startup timeout; this is not a zero-retry claim. Original money/role/version/request assertions and timeouts were retained. The other seven successful same-SHA job results were reused by GitHub; the native job was executed again. Full-browser retry information is included verbatim in the table.

| Current CI job | Status | Actual summary |
|---|---|---|
| app | PASS | CI step completed successfully |
| historical-database-upgrade | PASS | CI step completed successfully |
| collect-pay-browser | PASS |   10 passed (44.7s) |
| travel-browser | PASS |   17 passed (3.0m) |
| trip-members-browser | PASS |   11 passed (2.4m) |
| production-ui | PASS |   279 passed (4.9m) |
| browser | PASS |   441 passed (10.2m) |
| database | PASS | PASS: duplicate commit, real ordinary-writer exclusion/stale rollback, in-flight receipt recovery, delayed-request fence and native opening conservation / 15 deterministic signed-balance property samples; PASS: duplicate commit, real ordinary-writer exclusion/stale rollback, in-flight receipt recovery, delayed-request fence and native opening conservation / 15 deterministic signed-balance property samples; Files=22, Tests=1021,  6 wallclock secs ( 0.15 usr  0.06 sys +  0.24 cusr  0.15 csys =  0.60 CPU); Result: PASS |

Database checks include22files/1021SQL tests, strict lint, original financial concurrency and historical installation. New real native flow creates a Trip via UI, checks actual database type/currency/date fields, resumes password login through the invitation, accepts a separate single-use guest invitation, verifies readonly access, guest self-leave, member revocation and all10financial-table facts unchanged. Existing multiuser/Travel/CollectPay suites retain original business assertions.

Four widths320/360/390/430,125/150/200% actual root text, Chinese/long names, short switcher viewport, keyboard navigation, query/nonzero scroll/focus, creation/cancel/unknown response, two Trip sources, blocked storage, cold original Members module and original QuickAdd overlay history are covered by actual React/CSS tests. Production also verifies two actual independent tabs. These are not physical-device or browser UI zoom claims.

## Production and data safety

[PR45](https://github.com/monowanderer373/monosplit/pull/45) merged to main `587b4b6a1e53244676b6acab84ab2b531c87b45b`. The entire merged Git tree equals validated `689480a700e5705922c189f2af121d09866e7006`. Existing Vercel team/project `monowanderer373s-projects/tabby-tally`, main/Production: **READY `dpl_5g8UbHJLbqUxseuCd7f2WVKqTLMu`**. [Live](https://tabby-tally-monowanderer373s-projects.vercel.app/); [deployment](https://tabby-tally-fjcnw6hxo-monowanderer373s-projects.vercel.app). Public entry identifies the exact main commit, includes the canonical legacy redirect and excludes the removed mixed-list renderer. This report is followed by a documentation-only checkpoint; its exact final SHA/READY/public-version/PWA proof is recorded in the delivered `delivery-final.json`.

Normal password login using two existing tagged owned QA accounts and a retained empty QA Trip, with real owner/view roles and **no API interception**, passed: typed lists; Shared query/tab/focus; Members/Dates/History/Summary parent chains; browser Back/Forward/reload; Travel selection/Manage/source return; overview trigger focus; create review+Cancel only; generic Personal + versus concrete Trip +; legacy redirects; direct authorized-type fallback; independent tabs; eight viewport/text geometry checks. Zero runtime errors or mutation RPCs. No private screenshots. All10authorized financial-table hashes per account and actual membership stayed unchanged.

Retained PWA registration updated natively without deleting its cache: activated current worker and exact running entry, current Shared/Trip/Members/Dates/Home/Records/Accounts/Profile/legacy chunks precached, five paper-material hashes and four offline assets match source. Eight four-width signed-out ledger/date privacy guards and offline shells PASS.

Fresh read-only hosted verification:33local/remote migrations match, latest202610280001; original update_space body/version/ACL unchanged. **No SQL or manual installation required.** No production Reset, financial/customer/member writes, QA invite generation/acceptance, date saves or new project.

## Failures resolved and remaining limits

Earlier rejected candidates were not released. They exposed source-parent repair inside original QuickAdd overlay/late lazy routes, then a wrong id projection in a new financial-test helper. Navigation was fenced to actual detail/target/location and helper reads actual authorized rows. Separate test defects: guest incorrectly reused a consumed single-use token; a legacy privacy assertion rejected digits150 inside a random UUID. It now asserts exactly opaque fingerprint+requestId fields. Financial controller/permissions and reconciliation assertions remain unchanged. The initial live helper compared percent-encoded spaces against standard URLSearchParams plus encoding; the helper now constructs the exact canonical query while retaining all filter/tab/focus assertions. This required no application change and financial/membership invariance also passed on that initial read-only attempt.

- **BLOCKED:** local Supabase remains unavailable due to the known Docker vfs storage limit; it was not blindly retried. Native backend verification used disposable GitHub Actions only.
- **NOT RUN:** physical Honor/Android OS Back/native keyboard, browser UI zoom and real screenreader. Chromium viewport/root-font/Back checks do not establish these.
- **NOT RUN in production:** create/invite/revoke/leave/payment/settlement/Reset/date-save mutations. Isolated native CI covers real mutations; production checks were read-only/review+Cancel. Nonzero-scroll proof uses a long synthetic list because retained production QA lists can be short.
- Approved images describe navigation; original paper/denim assets, bottom navigation, sort order, real role/status and data are retained. Screenshot list contents/default selection therefore differ from illustrative records. No sample data or simulated financial fallback enters production.

## Screenshots and recovery

Safe actual synthetic phone screenshots, both approved portraits and `comparison.html`, acceptance mapping, safe CI/provider/version/schema/cache/financial-invariance evidence are delivered together. Credentials, private IDs/accounts/screenshots and raw backend logs are excluded.

Resume from PROJECT_STATUS/WORK_LOG/current git diff and `/workspace/verification/issue05-shared-navigation-2026-10-29`. Do not replay previous SQL, Reset, production fixtures or unrelated work. No remaining manual action.

## Changed files (48)

- `.github/workflows/quality.yml`
- `CONTEXT.md`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/adr/0007-primary-navigation-daily-insights-shared.md`
- `docs/issues/ISSUE05_SHARED_NAVIGATION_IMPLEMENTATION.md`
- `e2e/app.spec.ts`
- `e2e/fixtures/quickAdd.ts`
- `e2e/multiuser.spec.ts`
- `e2e/navigation.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/phase5e.spec.ts`
- `e2e/production-phase3-smoke.spec.ts`
- `e2e/shared-navigation-backend.spec.ts`
- `e2e/shared-navigation-ui.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-period.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `src/App.tsx`
- `src/components/shared/SharedComponents.tsx`
- `src/components/shared/SpaceCreateForm.test.tsx`
- `src/components/shared/SpaceCreateForm.tsx`
- `src/components/shared/shared-a.css`
- `src/components/travel/TravelUI.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/travel-components.css`
- `src/hooks/useHomeData.ts`
- `src/hooks/useSpaceSourceReturn.ts`
- `src/lib/i18n.ts`
- `src/lib/moneyOperation.test.ts`
- `src/lib/navigationStorage.ts`
- `src/lib/sharedAOrigin.test.ts`
- `src/lib/sharedAOrigin.ts`
- `src/lib/spaceNavigation.test.ts`
- `src/lib/spaceNavigation.ts`
- `src/lib/tripDatesNavigation.ts`
- `src/lib/tripLedgerNavigation.ts`
- `src/lib/tripMembersNavigation.ts`
- `src/pages/LegacySpacesRedirect.tsx`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/SharedPage.tsx`
- `src/pages/SpaceInvitePage.tsx`
- `src/pages/SpaceMembersPage.tsx`
- `src/pages/SpacePage.tsx`
- `src/pages/SpacesPage.tsx`
- `src/pages/TripDatesPage.tsx`
