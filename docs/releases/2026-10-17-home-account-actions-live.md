# Compact Home balance and mascot account actions — production verified

Date: 2026-10-17. Existing React/TypeScript/Vite application and production projects retained.

## Result

The Daily balance card no longer repeats the deductions reminder or adds a separate dots row. The original 64px paper-pocket mascot opens a centered cream/denim dialog with the selected account and three original actions: Transfer, Exchange and View account. Native buttons support press feedback, keyboard navigation, focus trapping/return, Escape/scrim dismissal, accessible descriptions and reduced motion; copy supports English and Chinese.

The same 390 CSS px negative-balance/two-pending fixture falls from **285.875px to 176px** card height. The original 52px header remains. Real login checks also measured 176px at 320/360/390/430px for the controlled single-currency account. Large text and genuinely additional currency rows retain natural flow; no fixed height clips monetary values. Top notifications, grouped verification and account-page pending status remain.

## Source and release

- PR [25](https://github.com/monowanderer373/monosplit/pull/25), merged.
- Validated source: `f64f5a02ab2cde1cd1a0f9449eecc6b9ff070e16`.
- Feature main: `928cf8b57baeefc02f4205b096dd01bee53066d2`; source/main whole trees equal.
- Existing Vercel production: **READY**, `dpl_3yF5z3ndEQcAqQcWAAHBKv8xHuxL`.
- Public URL: https://tabby-tally-monowanderer373s-projects.vercel.app/ .
- Deployment: https://tabby-tally-o8d2ni1at-monowanderer373s-projects.vercel.app/ .
- Public `index-BmwBfrRy.js` contains this main SHA; current Records `zFDFnMq6` and Accounts `JXexgxoC` are precached.

This pins the application release. Documentation-only checkpoints can produce another deployment SHA; always read actual main/READY/public bundle and verify the unchanged application tree when resuming. Do not reinstall the previously completed multicurrency migrations or replay QA financial facts.

## Changes

- `PersonalLedgerPage.tsx`: remove only the Home pending-band prop; bind mascot actions to current account/name.
- `HomeScreen.tsx` / `home.css`: one original mascot slot and absolute 64px button with scoped active/focus/reduced-motion styles. Header/card dimensions retained; original general button specificity override repaired for this enabled button only.
- `AccountActions.tsx`, `multicurrency.css`, translations: scoped paper rows/icons/account tab and accessible real routes; reuse original MoneyDialog/HomeSheet and financial services.
- `vite.config.ts`: revision-precache exactly the existing mascot and two Home paper materials. No private/API caching added.
- `home-account-actions.spec.ts`, production UI config, existing `app.spec.ts`: 24 meaningful Home cases plus fresh offline asset/source-byte verification.

No financial model, services/RPCs, permissions/RLS, schema, dependency or lockfile change. No production financial writes were required.

## Current validation

Final source [Quality 39029432382](https://github.com/monowanderer373/monosplit/actions/runs/39029432382): **all 7 jobs SUCCESS**.

| Check | Result |
| --- | --- |
| Vitest | PASS — 637 tests / 95 files |
| ESLint, TypeScript and production build | PASS |
| Production module graph | PASS — 138 cases, including 24 new Home cases; local 138 also PASS |
| Complete browser suite | PASS — 289 cases |
| Collect/Pay / Travel | PASS — 10 / 16 cases |
| Disposable PostgreSQL | PASS — 862 pgTAP / 19 files, DB lint and competing-session checks |
| Historical complete SQL upgrade | PASS — applied twice in isolated CI |
| Fresh offline PWA | FAIL before fix; PASS after, all 3 Home resources match source SHA256s |

New Home checks cover 320/360/390/430px × 100/125/150/200% root text, long names, negative/concealed balances, English/Chinese, grouped notification → real verification → original return, mouse pressure, keyboard/focus/close, and six selected/all-account action routes with zero financial writes. A first press regression exposed the old general Home active selector; the enabled mascot selector fixes it without changing other buttons.

Normal owned production QA used real auth/APIs and no interception. Actual source SHA, one mascot/no duplicate warning, all three account-bound routes, keyboard/focus, privacy, bell, four compact widths and zero runtime errors passed. Before/after complete row digests were identical for 7 expenses, 21 account entries, 17 transactions, 4 movements and 5 funding legs; zero financial mutation RPCs. Customer accounts were not accessed. The first external QA assertion expected literal `MYR` while the real en-MY browser correctly displayed `RM`; the harness was corrected without changing app formatting or financial assertions. Pending-task layout/navigation is exercised with isolated synthetic UI data, not newly manufactured production deductions.

Retained production PWA: current worker activated; entry/Records/Accounts cached; all three Home assets fetched offline and matched source bytes; five stable Insights materials source-equal. No manual static cache deletion. Four public private-route guards/no overflow and offline Records shell passed. All 64 public client modules scanned without service-role key. Auth sessions/client storage cleared after QA; retained static caches preserved.

## Evidence and limits

Safe comparison gallery and matrix: `/workspace/verification/home-account-actions-2026-10-17`. Screenshots show real application components with synthetic API-contract data; no customer or private live screenshots. Credentials, private checkpoints and raw logs are excluded from delivery.

Physical Honor, OS keyboard/system-font settings and browser UI zoom are **NOT RUN**. CSS viewport/root-font simulations are distinct. Local Docker was not retried; real backend checks ran on disposable GitHub Actions. No environment-field rewrite or user connection action was needed.
