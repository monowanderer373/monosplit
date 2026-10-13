# Insights / Spending records AutoFX FINAL — production verified

2026-10-14 Asia/Kuala_Lumpur. **Feature production release and live verification complete.**

## Executive status
- Existing application: React19/TypeScript/Vite/Supabase/PWA; no replacement app/project or framework migration.
- Live: https://tabby-tally-monowanderer373s-projects.vercel.app/
- Tested application main `17348f10600dce3fe01ebc83eacd710d365f686f`; Vercel production READY `dpl_Cr1rPdpKQYqUaGF2WAduQB4yegzJ`, immutable URL https://tabby-tally-mh7zosksc-monowanderer373s-projects.vercel.app/ . Public entry `index-CvG0Rr2R.js`, Records `SpendingRecordsPage-DDXDulqT.js`; actual release SHA found in served bundle.
- PR16 AutoFX/UI, PR17 retained-PWA artwork revisions, PR18 exact expense drafts all MERGED. Documentation-only checkpoints may follow this tested application SHA; final current deployment metadata retained at `/workspace/verification/autofx/release-deployments.json` and confirmed in the completion response.
- Frontend development ready: YES. Backend verification: disposable CI and real production FX YES; local Docker/Supabase BLOCKED. Future schema installation through current management SQL connection remains read-only; this release's two migrations were installed via the existing project SQL Editor and independently verified.
- Cloud Install Script/Start Skill full draft revision18 saved/read back; not newly published or fresh-task restored. Copy-ready fields: `/workspace/onboarding/cloud-install-final.sh`, `/workspace/onboarding/cloud-start-final.md`. Separate setup PR14 remains unmerged.

## Actual changes
- Month+Scope only, intrinsic text fitting/stacking, one anchored month/year popover, light-blue year toolbar, year draft without premature filtering, explicit framed44px arrows and keyboard/focus handling.
- A paper statement: quiet gray-blue month, native20px denim corner, subtle grain and pale blue-gray footer; clean lower corners. Every original currency remains visible; foreign currencies show smaller MYR reference estimates with actual source/date and honest cache/error/coverage states.
- Same complete permission-bound canonical ledger and FX snapshot supply summary, MYR-valued original chart renderer/category ranking, and all-currency Records. Shared primary amount is the viewer's own share; Bill remains permission-bound. Original editor, versioned correction/settlement/reversal RPCs, identities, F=E−T+R, privacy, RLS and request IDs preserved.
- Exact BigInt valuation/display reconciliation and original money formatting. History-only FX pins preserve Records/back; ordinary full Insights reload reads latest shared cache. Last-good estimates remain visible during refresh; queued size observers remove observed ResizeObserver loops.
- Private persistent FX metadata, authenticated read/operational-health RPCs and fixed daily Frankfurter v2 worker in two additive forward migrations. No provider request carries customer names, amounts, transaction dates or account identifiers. No mock rate/design JSON enters production fallback.
- Fixed an actual installed-PWA problem: Vite's default exempted every assets/ URL from content revisions, retaining old SVG art. Only content-hashed JS/CSS now bypass revisions; stable paper/denim/icon URLs receive content hashes. Preserved the old test cache to verify automatic replacement.
- Fixed actual large-amount draft corruption: `9007199254740990` MYR minor units were prefilled as `.91` instead of `.90`, making an untouched draft dirty. Total/contribution/share input text now uses exact integer division/remainder. Regression verifies original cents, disabled Save and no writes. Financial calculations/RPCs unchanged. Existing Escape test waits all original cleanup assertions within its unchanged budget.

Source map: `docs/insights/AUTOFX_FINAL_2026-10-13.md`. Application files span Insights components/styles/tokens/icons, both pages, spending view/hook, FX/helper/translations, exact money formatting, two migration/test pairs, PWA config/test and exact editor input/test. Package/lockfile and financial backend source remain unchanged.

## Current checks

Final main Quality run: https://github.com/monowanderer373/monosplit/actions/runs/38453878745 . All six jobs SUCCESS. Current app/database logs and full browser artifact inspected; reference tests are separate.

| Check | Outcome | Evidence |
|---|---|---|
| Checkout/project/branch preservation | PASS | Existing repo/main/team/project/ref verified; ordinary scoped commits/merges; no force push or discarded user work |
| Node/dependencies/local isolation | PASS | Node22.23.3/npm10.9.9 vs CI22; frozen npm-ci; lock unchanged; effective Vite development/production/test localhost/demo-key guard |
| Bash/embedded Python/SQL grammar | PASS | Saved installer syntax, embedded Python compile; complete manual SQL/PLpgSQL parser; truncation reproduced42601 |
| Full units | PASS |542 tests/79 files in final main |
| Database | PASS |742 pgTAP/18 files; lint/concurrency/historical upgrade jobs SUCCESS on disposable CI |
| ESLint/typecheck/production PWA build | PASS | Final main app job; editor fix local lint/build also PASS |
| Full browser | PASS with one retry |119 cases:118 expected first attempt,1 flaky passed on retry;0 skipped/unexpected |
| Collect/Pay and Travel/QuickAdd/Trip period | PASS | Dedicated current main jobs SUCCESS; full browser contains existing auth/identity/finance/navigation regression |
| Targeted editor/money/FX | PASS |43 current local tests; before-fix large-input regression intentionally FAIL(1 selected/23 excluded), then full targeted run no failures |
| Mocked AutoFX/visual design | PASS |20 local AutoFX cases; latest CI width/font/long-text/multi-currency/cache/error/privacy/records/year cases; package21 reference cases separate |
| Production migrations/model preservation | PASS | Remote26 == source26; original public financial function hash unchanged, excluding only the two new FX readers |
| Actual provider/persistent cache/Cron | PASS | Normal authenticated health/snapshot read;12 actual quotes; successful real scheduled fetch and restored active daily schedule |
| Actual authenticated production UI | PASS | Existing controlled identities; no interception; authoritative original/share/Bill/estimate data;16 viewport/root-font combinations;0 runtime errors |
| Retained PWA/artwork/offline/private guards | PASS | Actual current worker/entry/Records cached; old SVG bytes automatically replaced; signed-out four widths and offline shell |
| Local Docker/Supabase | BLOCKED | Current vfs/32GB capacity; prior PostgreSQL extraction blocker not blindly repeated/pruned; existing disposable CI used |
| Physical Honor/OS keyboard/system fonts/safe-area | NOT RUN | Device unavailable; simulated CSS viewport/DPR/root-font tests are not physical device evidence |
| Native browser UI/OS zoom | NOT RUN | Root-font125/150/200% reflow verified; headless chrome://settings capability probe closed its target, so no actual browser/OS zoom claim |

Final browser retry: existing intercepted-API month/year keyboard case expected September focus before initial month focus had settled; retry passed. Native production additionally waited for actual October focus, used ArrowLeft→September→Enter, verified empty September and This month restore. The retry remains reported; no assertion was skipped or timeout expanded. Prior main4f app failed one synchronous scroll-cleanup check (540/541); PR18 awaited actual cleanup and final main542/542 passed. Earlier networkidle/old restored test-tabs and text-whitespace harness errors were diagnosed, not relabeled as success.

## Actual backend and financial evidence
- Supabase `skiqsxvmxvmxfzhrzcxh`;26 forward versions match source. Frozen migrations `202610130001_insights_fx_cache.sql` and `202610130002_insights_fx_health.sql`; original24 history not rewritten. Source/remote public financial definitions preserve pre-change hash `cdce29c88693608bfe6c1e530875c13a`.
- Normal controlled QA JWT reads independent FX metadata. Snapshot `4cf53c31-9726-4987-9788-0c3776b3223b`; fetched/succeeded `2026-10-13T17:41:00.111058Z` falls inside actual Cron run `17:41:00.109072–17:41:01.757934Z`, succeeded, failure null. Malaysia time14 Oct01:41.12 positive canonical MYR-per-foreign quotes; actual rate date13 Oct2026, MYR→USD0.24477/MYR→VND6332. Different from design mock6250.
- Fixed job `tabby-insights-frankfurter-daily`, active `10 9 * * *`:09:10UTC/17:10Malaysia daily. First real minute-trigger execution restored daily itself. Next regular daily occurrence had not yet arrived during verification; future-day success is not claimed. Cache persisted across app deployments/logins and all views used the same snapshot.
- Reused only2 existing owned QA principals. Retained original MYR facts and created2 additional small canonical QA facts once using normal transactional/request-ID RPCs, not service-role finance writes. Checkpoint saved requests before writes; retries reused facts, counterpart accepted through original expected-version RPC. Immutable QA financial history retained; sessions signed out/browser auth and private cache entries cleared. No customer account/financial data used.
- Actual All:MYR48.00/USD7.89/VND456789,count4; Personal:MYR12.00/USD7.89,count2; Shared:MYR36.00/VND456789,count2. Shared VND primary own456789 versus permitted Bill913578; original MYR own36 versus Bill72. Other QA principal cannot read private USD expense. Actual references USD≈RM32.23/VND≈RM72.14; exact chart totalRM152.37 and grouped totals reconcile.
- Native Month/year draft, keyboard month commit, This month, scopes, same FX id/total on Records, filter/tab/scroll return, original editor Escape/focus/body-scroll restoration and visible/ARIA privacy PASS. Actual expense/FX response statuses200,0 runtime errors.

## Screenshots, comparison and differences
`/workspace/verification/autofx/comparison/index.html` and `/workspace/verification/autofx/TabbyTally_AutoFX_FINAL_Implementation_Evidence.zip` contain all50 approved component references mapped to implementation, latest CI synthetic UI screenshots/geometry, and clearly separate native production screenshots of controlled QA data. No customer screenshots, environment files, browser profiles, credentials or private principal checkpoints included.

320/360/390/430 CSS px ×100/125/150/200% HTML root font tested against actual production; source/fixture tests add long EN/ZH text, big amounts/multiple currencies, short popovers, failures/coverage, pagination and desktop. This is not OS/browser zoom or physical Honor evidence. Data determines card height and original chart/category colors; fixture values differ from actual QA data. Extreme narrow/large text permits number-only keyboard scroll with visible hint, no page overflow or clipped digits. Fixed navigation appears at its viewport position in full-page captures.

Retained-PWA proof without clearing static cache: corner368bytes/24px→512bytes/20px, paper376→317,weave413→448; all actual browser responses decode and exactly match current source. Versioned corner59ab88bf…,weave7fc744d3…,paperdf09410d…,iconsc7679774… present in live SW.

## Remaining actions and readiness
No feature release blocker remains. Monitor the next normal17:10Malaysia Cron occurrence through authenticated FX health; preserve snapshot history and use forward migrations for later schema changes. Physical device/browser UI zoom checks remain unavailable here. For future disposable backend work use the existing isolated GitHub runner; never reset linked/shared/production databases. Current management SQL connector remains read-only, so future production schema changes need a supported writer or the existing SQL Editor route, not another general development authorization.

Cloud draft publication/fresh-task recovery remain separate environment-settings actions; editing repo or saving draft does not establish publication. Backend/project/frontend connections, normal GitHub/main deployment and current live behavior are verified. No tokens/service-role keys exposed, no customer data exported, no replacement production project, no force push or production reset.
