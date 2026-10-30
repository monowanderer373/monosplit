# Issue06 — unified Travel workspace

2026-10-30. Existing `monowanderer373/monosplit`, React19/TypeScript/Vite/Supabase/PWA. Only Issue06; retain published01–05 and original financial/privacy/identity rules. Baseline clean latestmain `1765909d39089053eb93f37d9868195f8f5f2a40`. All35 handoff manifest hashes matched; full README/MD/component/reference/acceptance material and eight portrait design boards read. Package prototype/static checks were not counted as application tests.

## Implemented behavior

Travel now enters the existing TripLedger workspace directly; Shared → Trips renders the same component and original authorized financial projections. There is no personal-overview/View trip intermediate screen, title dropdown or folder/manage footprint. Source-less deep links fall back to Shared Trips; Group remains unchanged.

The title is plain text. A separate Switch trip appears only with more than one accessible active Trip whose complete valid dates contain the account-local day, including both endpoints and invited view-role members. Only those Running Trips appear in the keyboard/focus-managed sheet. Explicit accessible Upcoming/Ended selections remain valid; stale selections use a stable legal fallback, and no-Trips/loading/revocation cannot silently submit to Personal. Focus/visibility/realtime/date changes refresh original authority. No render writes a Trip lifecycle status.

The exact supplied WebP appears only on My spending, with a uniform35% light overlay and flat#DCEAF0 failure fallback; it is precached for PWA. My spending uses original allocated personal consumption, Trip total/count use all valid authorized Trip bills, independent of the first20 rendered rows. An expense paid entirely by another member still shows the original bill total, payer and Your share0. Currencies remain separate; no FX sum or sample data fallback.

Expenses/outstanding use opaque#A33D42; zero debt is neutral. Green#216346 is reserved for actual still-effective accepted self repayment/receipt allocations, with explicit status/date and partial-reversal explanation. Pending allocations do not reduce debt or become green. Accepted payments and reversals refresh the original scope; consumption remains unchanged. Original F=E−T+R, immutable history, participants, RLS, versions, idempotence, cash authorizations, split defaults/full membership, original full/partial settlement and reversal controllers are reused. No financial schema/dependency/RPC change or migration.

Default Expenses and Balances tabs have ARIA/arrow keys and independent state. Existing Refresh is retained inside the compact menu alongside History/Summary/Members, avoiding a blank toolbar row. Original expense editor/correction/read-only details, outbox recovery, Shared Reset visibility and legal settlement actions remain. Existing single global+ uses current Trip/fresh permissions; date editor still hides it. Actor/Trip-bound opaque origin state preserves Travel or Shared source, Members/Dates/History/Summary return, tab, list expansion, scroll/focus, draft and safe reload/Back. Original Shared create/cancel/login/invite flows remain.

## Current validation

| Check | Result | Evidence / scope |
|---|---|---|
| Unit suite | PASS |843 tests/122files,41.85s; initial outdated AppShell verified-target mock corrected |
| ESLint | PASS | No warnings; final scoped code checked |
| TypeScript/production/PWA build | PASS |125precache entries including supplied WebP |
| Integrated actual application UI | PASS |77 cases2.1min; after final menu/text/layout polish50cases1.6min; actual empty+Shared reference capture1case |
| Phone/text | PASS (Chromium) |320/360/390/430CSSpx,125/150/200% root text, short viewport, longChinese/names/amounts, multiple currencies, image/read failures, privacy, permissions, tab/switch keyboard/focus and Back/reload/drafts |
| Final exact-source Quality | PASS | Source1c3f5d6 / Quality41056210704, all8jobs; full461browser10.7min; productionUI298direct+1retry4.8min |
| Disposable real Supabase / historical upgrade | PASS |1021SQL/22files, strict lint/concurrency/history;11native Trip/fullmultiuser2.3min,17Travel2.7min,10CollectPay42.2s |
| Production / normal owned-session read-only QA / PWA | PASS | Exact main SHA/nativeREADY/public;2normal owned owner/viewer accounts, no API interception/mutation/private screenshots;8geometry cases and3historyBack/reload repetitions; activated retained PWA/current routes plus approved WebP cached/offline/source-equal |
| Production schema verification | PASS | Read-only exact33migrations/latest202610280001; original update_space version/role guards, definition hash and ACL unchanged |
| Local Docker/Supabase | BLOCKED | Known vfs extraction/storage limitation; not retried. Backend checks use disposable Actions |
| Physical Honor/nativeIME/OS Back/browser UI zoom/screenreader | NOT RUN | Chromium viewport/roottext/Back are not physical-device evidence |

Native Trip regression creates a real member-onlyRM1000 bill with the owner absent from its participation list: Trip total/count include it, My spending remains420 and Your share0 remains visible. Original collect300/pay100, pending/accepted50/reversal, cash conservation, immutable history and readonly assertions remain. The explicit300Repaid visual scenario uses isolated UI fixture data; do not describe that screenshot as a production payment.

Earlier CI candidates failed obsolete UI locators: removed3people/always-visibleBalances, English Switch in Chinese and standalone Refresh. Those test interactions were adapted to approved actual controls; original financial assertions, timeouts and role checks were retained. Final-source CI evidence supersedes earlier candidates. Production-graph UI had one5s post-reload readiness timeout, passed on retry (298direct+1flaky); root cause remains unestablished. Twenty additional current-runtime local repetitions passed without retries, as did three normal production repetitions. Full461browser and11native journeys passed directly. This is recorded in flaky-note.json, not described as a zero-retry run.

## Publication

PR47 https://github.com/monowanderer373/monosplit/pull/47 MERGED. Source `1c3f5d63a745b2324e456c4ca7d1ec3d30871ea4`, branch `feat/travel-workspace`; Quality https://github.com/monowanderer373/monosplit/actions/runs/41056210704 all8success. Main application commit `1d312f82f658b46485ac26b45247ee161c5a0444`, whole Git tree equals validated source. Existing Vercel Production **READY `dpl_2odv1gL9wrje5SPUtrocLKWzPHJz`**; native URL https://tabby-tally-kxmrz21lo-monowanderer373s-projects.vercel.app . Canonical entry `/assets/index-B2xqAj20.js` contains exact main SHA, actual shared TripLedger JS/CSS and approved source-equal WebP are public/precached. A documentation-only checkpoint follows; its exact final SHA/READY/public/PWA proof is recorded externally in delivery-final.json without changing the validated runtime.

Existing live: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Existing team `monowanderer373s-projects`, project `tabby-tally`; connection/repository/main branch independently verified. No replacement app/project and no database operator action.

Normal readonly QA used two retained tagged owned accounts with owner/view roles. Travel and Shared canonical workspace, source/query/tab/focus/Back/reload, two real tabs, Members/Dates/History/Summary, role/lifecycle-aware global+, create review+Cancel, legacy URLs and three direct history→Back→reload repetitions passed with0runtime errors/0mutation RPCs/0private screenshots. Ten financial-table hashes per actor and membership were unchanged. No production bill, wallet, customer, member or invite QA writes. The retained production QA Trip is empty: nonempty member-only production writes were **NOT RUN**; the original native disposable Trip test proves that case. Eight signed-out four-width ledger/date guards and offline shells were verified separately. Five original paper material hashes plus five offline assets including the approved WebP match source; retained worker activated current entry/route/CSS cache with no cache deletion. No SQL/manual action.

## Design/implementation comparison and limits

Safe gallery `comparison.html` pairs all8approved boards with actual application screenshots, not a pasted prototype image. Named people, dates, record counts and original navigation icons differ from design examples because fixtures and existing app chrome remain real. Additional pending/accepted/reversal/read-only controls are the original financial UI, preserved rather than removed for visual similarity. The eight actual reference states use isolated fixtures; no private screenshots or production financial data are included. Long pages scroll above the original safe-area dock;200% text reflows complete words and amounts instead of shrinking/clipping. Screenshots at roottext200% are not OS font scaling or physical Honor verification.

Resume with AGENTS/PROJECT_STATUS/WORK_LOG/current git diff; evidence `/workspace/verification/issue06-travel-workspace-2026-10-30`. Never replay old SQL/reset/financial writes. Final documentation-only checkpoint must retain the validated runtime tree and be checked against actual final public SHA/nativeREADY/PWA separately.

## Changed files

- `CONTEXT.md`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/issues/ISSUE06_TRAVEL_WORKSPACE_IMPLEMENTATION.md`
- `e2e/multiuser.spec.ts`
- `e2e/person-detail.spec.ts`
- `e2e/shared-navigation-ui.spec.ts`
- `e2e/travel-workspace-ui.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-dates-ui.spec.ts`
- `e2e/trip-ledger-backend.spec.ts`
- `e2e/trip-ledger-ui.spec.ts`
- `e2e/trip-members-backend.spec.ts`
- `e2e/trip-members-ui.spec.ts`
- `e2e/trip-overview-records-ui.spec.ts`
- `e2e/trip-period.spec.ts`
- `e2e/trip-split-backend.spec.ts`
- `playwright.production-ui.config.ts`
- `public/assets/travel-workspace/travel-paper.webp`
- `src/components/AppShell.test.tsx`
- `src/components/AppShell.tsx`
- `src/components/SettlementPanel.tsx`
- `src/components/home/HomeScreen.tsx`
- `src/components/travel/TravelWorkspace.tsx`
- `src/components/travel/TripDetails.tsx`
- `src/components/travel/TripLedger.tsx`
- `src/components/travel/trip-workspace.css`
- `src/hooks/useAccessibleTrips.ts`
- `src/lib/spaceNavigation.test.ts`
- `src/lib/spaceNavigation.ts`
- `src/lib/tripLedgerNavigation.ts`
- `src/lib/tripLedgerTranslations.ts`
- `src/lib/tripWorkspace.test.ts`
- `src/lib/tripWorkspace.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `vite.config.ts`
