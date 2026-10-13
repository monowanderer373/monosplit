# Insights / Spending records AutoFX FINAL — release candidate

Checkpoint: 2026-10-14 Asia/Kuala_Lumpur. **Production release BLOCKED; not live complete.**

## Executive status
- Existing repository monowanderer373/monosplit; branch `feat/insights-autofx-final`; tested implementation `efabb59a11f2a94fa58fb16bcae1e544db749e8b`. PR16: https://github.com/monowanderer373/monosplit/pull/16 . Recovery documentation may follow this tested application SHA; read HEAD.
- Frontend development ready: YES. Backend integration: PASS on disposable GitHub CI, local Docker BLOCKED, production FX installation BLOCKED.
- Actual Cloud configuration: complete Install Script and Start Skill saved/read back in draft revision18. Not published; fresh-task restoration NOT RUN. Existing published provider network access was verified on this instance. Saved draft is not a runtime update or publication.
- Production: existing `tabby-tally` project remains READY at main `0ff76f191a8704d58ba2dda956c1f3e47580ad70`, deployment `dpl_SxQLEvNGXkgyN2x7rJow3DU6Q18W`. Public alias: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Served entry `index-BNcH_9tF.js`; expected Supabase ref present, no detected service-role client token. This is the previous release, not AutoFX.

## Changes made
- Final Month+Scope only, intrinsic text fit, one anchored month/year popup, year draft without premature month commit, light-blue year toolbar, framed44px controls and focus/keyboard handling. No Currency control or external labels.
- A paper summary, gray-blue month, native20px denim corner, clean lower corners, pale blue-gray footer. Static totals for every original currency; smaller foreign RM reference estimates with actual source/date and clear missing/cached/updating/older states.
- One complete permission-bound ledger plus exact shared FX snapshot supplies original totals, counts, automatic MYR category/day/ranking estimates and all-currency Records. Shared primary amount is the viewer's own share; Bill remains permission-bound. Original editor/versioned RPCs/history navigation preserved.
- Exact BigInt fraction valuation and display reconciliation; global original money formatter now retains every minor unit even at MAX_SAFE_INTEGER instead of losing the final cent through floating-point formatting. Integer facts, currency registry, parsing, financial calculations and RPC arguments unchanged. No financial engine/table/RLS rewrite.
- History-only snapshot pin preserves Records/back while a full Insights reload retrieves latest shared cache. Last-good amounts stay visible during refresh. Size-driven DOM updates queued through requestAnimationFrame remove observed ResizeObserver loops. Extreme narrow/large text uses visible number-only keyboard scrolling without page overflow or nested interactive controls.
- Two additive forward migrations: `202610130001_insights_fx_cache.sql`, `202610130002_insights_fx_health.sql`. Independent private metadata cache, canonical MYR-per-foreign direction, immutable snapshots, bounded provider HTTP, lock/TTL/backoff/last-good preservation, authenticated reader, fixed daily Cron09:10UTC (17:10 Malaysia). Health reader exposes only FX operational metadata. Original24 migration files and financial functions are unchanged in source.
- Added exact arithmetic, hook race/cache and20 AutoFX browser tests; updated obsolete currency assertions and actual bootstrap readiness. Test fixtures remain test-only, never production fallback. Dependency declarations, lockfile, CI, Vite/PWA framework configuration unchanged.
- Outside checkout: managed Node22, guarded local Vite targets, system Chromium wrapper and optional dev-server UI wrapper. Cold local production-preview builds exceeded120s then300s; mocked UI iteration uses the tested external dev wrapper, while original CI still validates the production build/preview. Separate setup PR14 remains unmerged.

Detailed source/design map: `docs/insights/AUTOFX_FINAL_2026-10-13.md`. Final checked source spans `src/components/insights/*`, `src/hooks/useInsightsFx*`, `useSpendingView.ts`, `src/lib/fx*`, `money.ts`, `spendingView*`, `insightsTranslations.ts`, both pages, the native icon sprite, relevant E2E files and two migration/test pairs. The exact manual SQL artifact is also retained at `docs/runbooks/insights-fx-production-apply.sql` for recovery.

## Verification

CI https://github.com/monowanderer373/monosplit/actions/runs/38433602662 at exact tested implementation SHA: all six jobs SUCCESS. Current logs and browser artifact downloaded and inspected; no historical totals substituted.

| Check | Result | Current evidence |
|---|---|---|
| Checkout / preservation / project identity | PASS | Clean initial main0ff76f1; scoped branch; current remote main unchanged; existing Git/Vercel/Supabase project identity checked |
| Node / npm / CI parity | PASS | Node22.23.3/npm10.9.9; CI Node22; Chromium154.0.8037.57 |
| Bash / embedded Python | PASS | Updated saved installer bash-n and embedded Python compile; QA helpers compile |
| Effective Vite localhost isolation | PASS | Guard verifies development/production/test modes and public disposable demo key; values withheld |
| Frozen dependencies | PASS | Existing npm-ci installation/CI; lockfile unchanged |
| Full app unit tests | PASS |541 tests/79 files in current CI |
| Targeted app unit tests locally | PASS |36 tests/5 files; one worker, CLI testTimeout15s for contended host, repository budgets unchanged |
| ESLint / typecheck / production PWA build | PASS | Current app CI job; generated SW/precache |
| Full production-preview browser suite | PASS |119 expected,0 skipped,0 unexpected,0 flaky from current browser-results.json |
| AutoFX mocked UI locally | PASS |20/20 with external dev-server wrapper; separate from production/backend proof |
| Collect/Pay and Travel jobs | PASS | Collect/Pay10 and Travel/QuickAdd/period16 in dedicated current jobs; full-browser119 also includes existing QuickAdd/Trip/Travel/identity cases |
| Disposable DB lint / pgTAP | PASS |742 tests/18 files, no lint warnings; existing lock-concurrency and historical upgrade jobs PASS |
| Authenticated isolated backend browser | PASS | Existing CI real local Supabase, all-currency authoritative records/own share/Bill permission and actual FX snapshot; not private production evidence |
| Package reference tests | PASS |21/21; separate reference implementation, not application validation |
| Cloud official Frankfurter v2 | PASS | Live HTTP200 and official OpenAPI2.1.1; real MYR→USD0.24478/VND6332, rate date2026-10-13; not Supabase hosting proof |
| Local Docker / Supabase readiness | BLOCKED | Current vfs,32GB filesystem,30GB free,3 small images/no containers/volumes. Same driver/capacity as prior extraction failure; no unchanged retry/prune/reset. Use isolated existing GitHub runner |
| Production migrations / provider cache / Cron execution | BLOCKED | SQL connector is read-only; native controlled QA FX health RPC404 before installation. User confirmed script not executed after Internet interruption |
| AutoFX production release / authenticated live / PWA update | NOT RUN | Wait for actual DB installation and backend verification before merge/release |
| Honor / OS keyboard / system-font / physical safe-area | NOT RUN | Device unavailable; root-font and CSS viewport/DPR simulations only |

Failures were diagnosed, not erased: earlier CI warned about JSON typing/volatility and one overly strict internal-scroll assertion; corrected and current six-job CI passed. Local full unit/UI attempts had CPU-contended interaction/bootstrap timeouts; some were interrupted after observed ResizeObserver errors, then corrected. Current local20 AutoFX and36 targeted units passed; full-local unit/57 UI success is not claimed. Bounded app readiness still checks actual heading/data, and permitted local-scroll checks retain full page-overflow/privacy/geometry assertions.

## Screenshots and necessary differences
- Actual application screenshots, current CI source: `/workspace/verification/autofx/comparison/index.html`; zip `/workspace/verification/autofx/TabbyTally_AutoFX_FINAL_Implementation_Evidence.zip`. All50 final parts mapped to implementation and screenshot context; boards/exact renders supplied alongside actual full-resolution application images.
-16 width/root-font combinations:320/360/390/430 ×100/125/150/200%. Existing revision tests add long EN/ZH labels, desktop, year-grid geometry, focus/navigation and loading/error/empty behavior. Original chart renderer/category palette preserved; data-derived heights/labels/counts differ from illustrative boards.
- Narrow200% long numbers intentionally permit number-only keyboard scroll with a visible hint; page never overflows. Fixed bottom navigation appears at its viewport position in full-page captures. Design mock amounts/rates in these explicitly mocked screenshots are not production data.
- Evidence archive contains only supplied design assets, synthetic UI screenshots/geometry and public comparison text; no environment files, credentials, browser profiles or QA principal checkpoint.

## Unresolved blocker and next executable action
1. In the existing project only, open https://supabase.com/dashboard/project/skiqsxvmxvmxfzhrzcxh/sql/new . Copy the complete `docs/runbooks/insights-fx-production-apply.sql` (identical to `/workspace/verification/autofx/production-apply.sql`), press Run and report success/error text without credentials. User chose this route and then confirmed the script was not actually entered; no further development authorization is needed.
2. Current connection acts as `supabase_read_only_user` with read-only transaction even with supported `read_only:false`; CREATE EXTENSION failed before writes. Do not bypass role/transaction controls. Backup API exposed no backup records; do not claim a restorable production backup. The guarded additive transaction changes only new FX metadata plus append-only migration history, preserving existing financial facts.
3. The prepared script supports original24 or already-applied25 versions, never rewrites old migrations, adds remaining metadata/health migration atomically. One next-minute real Cron run self-restores fixed daily09:10UTC; verify active schedule, run status, succeededAt/failure, actual12quotes and snapshot timestamps/identity via normal controlled QA JWT. SQL success alone does not prove provider/Cron success. Migration bodies are isolated-CI tested; the exact combined manual wrapper has not yet been executed on production.
4. Read current remote history; expected26 and original public-function hash (exclude both new public FX readers) unchanged. Native `backend-qa.py` uses only existing owned QA identity/normal JWT, no financial writes/customer reads. No repeated reseeding/reset. Credentials remain in process memory and sessions are logged out.
5. Only after true backend readiness: finish PR16/merge main, wait existing Vercel production READY at exact main SHA, verify alias/bundle version, normal authenticated all-currency estimates/privacy/Records back, actual cache/Cron and retained PWA update. Preserve existing controlled immutable QA facts; never manufacture production fixture fallback.

## Security confirmation
No production migration or financial write was performed by this AutoFX task. Connection diagnosis and owned QA password/login/metadata reads occurred; migration failure precedes writes. Secrets were not printed or committed; source diff/dependency/migration boundaries and archive allowlist checked. No force push, replacement project, production reset or copied customer data. Physical-device and private-account behavior remain explicitly unverified.

Copy-ready Cloud fields also retained outside checkout: `/workspace/onboarding/cloud-install-final.sh` and `/workspace/onboarding/cloud-start-final.md`. They match saved/read-back draftrevision18; publication remains a separate environment-settings action.
