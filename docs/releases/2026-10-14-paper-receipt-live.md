# B · Paper Receipt v2 — live release, 2026-10-14

## Delivered
The existing Insights receipt now follows the approved B design: one cream shell and light shadow, pale blue paper header/footer, outline receipt icon and tiny side notches. No heading rule, denim corner, folded/creased paper, backing layer or double border. The single footer perforation row is retained as a native SVG.

All original currencies remain visible. Shared measured ISO/original/reference columns keep equal row heights and a common baseline, with original amounts left-aligned and small MYR references at the far right. MYR has an empty estimate slot. One non-fitting currency switches the entire group to stacked rows; exact digits are never shrunk or truncated in storage. At extreme width/font/value combinations the labeled, keyboard-focusable number region scrolls locally and displays a scroll hint. Summary/compact Records retain the existing same-snapshot statistics, own-share/Bill permissions, month/scope, filter/tab/scroll return, expense editor, amount grouping and privacy.

Healthy attribution is one `Rates: Frankfurter · [actual date]` paragraph. The extra visible latest-reference/estimated policy line is removed from the main card; accessible/tool-tip and chart valuation semantics remain. Exceptional updating/cache/missing states and Retry remain inline, without fake RM0. Month/Scope are the only top controls. The year/month draft and keyboard/focus behavior are preserved, with final native toolbar sizing, weights and selection colors.

## Actual changes
- `InsightsPage.tsx`, `SpendingTotals.tsx`, new `receiptLayout.ts`: receipt structure, exact common-column measurements, whole-group fallback, accessible extreme-value overflow, one source paragraph/statuses. No financial or FX arithmetic changes.
- Scoped `insights.css`, `tokens.css`, `InsightsFilters.tsx`: approved B appearance/typography, remove superseded corner, preserve existing controls/charts/Records functionality. Original application fonts retained.
- `public/assets/insights/receipt-perforation.svg`: native 9×8 approved dot pattern; existing PWA glob content-revisions/pre-caches it automatically. No build/deployment config change.
- New card unit tests and actual application browser coverage; native approved fixtures only in E2E. Existing source/financial assertions retained. The pinned-return test waits for the destination Records heading before using Back, because diagnostics showed the lazy route's URL could change while the previous navigation still occupied the screen. No timeout increase/skips.
- [Component/source map](../insights/PAPER_RECEIPT_FINAL_2026-10-14.md), PROJECT_STATUS and WORK_LOG keep recovery checkpoints.
- No dependency/lockfile, migration, backend service, finance RPC, currency precision, identity/history/RLS or project replacement. No production financial writes or reseeding during this release.

## Verification
| Check | Current evidence |
|---|---|
| Package manifest / supplemental references | PASS —184 files /36 tests; separate from application tests |
| Exact-source CI units | PASS —552 tests/81 files |
| ESLint / TypeScript / production PWA build | PASS —local and current CI app job; production build also READY |
| Local application browser | PASS —51/51,3.6m, zero retries/skips;53 actual component/context captures |
| Responsive coverage | PASS —320/360/390/430CSSpx ×100/125/150/200% root-font simulations; desktop1024, long text, five currencies, large exact amounts/keyboard-scroll and Chinese200% |
| FX/data UI states | PASS —single/two/three/five currencies, foreign-only, mixed actual dates, updating/cached/unavailable/Retry, empty/error/change-month, visible/ARIA privacy |
| PRQuality38552217984 | PASS —all6 jobs SUCCESS on b64ce63 |
| Full authenticated/disposable browser job | PASS —actual named-job terminal145 passed(5.7m); raw per-case artifact download BLOCKED403, detailed retry/skip distribution not independently observed |
| Disposable DB | PASS —742pgTAP/18 files, DB lint, original concurrent write exclusion and historical-upgrade job |
| Dedicated CollectPay / Travel+QuickAdd+Trip period | PASS —10 /16 |
| Real production normal owned-QA login/read | PASS —no intercepted responses, existing facts only, four expense reads/two FX reads200,0runtimeerrors |
| Real production interactions | PASS —month/year draft/no early commit, keyboard month,4/2/2 scope counts, identical FX/Records totals, return filter/tab/scroll, original editor Escape/body/focus,16 native CSS geometry combinations |
| Production privacy | PASS —visible and accessibility trees after actual rate date loaded; source date remains, originals/references/Bill hidden |
| Retained production PWA | PASS —automatic update, active controller/current entry+Records+perforation cached; no static cache clear; public four-width private-route guards and offline Records shell |
| MainQuality38553398737 | Automatic run still active at documentation checkpoint; exact application tree equals fully passed PR source. Latest terminal read-back is in delivery evidence. |
| Local Supabase | NOT RUN —known Docker vfs image-extraction capacity limitation; no unchanged pull/reset/prune retry. Existing isolated CI supplies backend evidence. |
| Physical Honor/other phone / OS keyboard / OS font scaling / browser UI zoom | NOT RUN —viewport/root-font simulation is not real-device proof; safe-area CSS support only |

## GitHub / existing production
- PR: https://github.com/monowanderer373/monosplit/pull/20 —MERGED.
- Source branch: `feat/insights-paper-receipt`; validated source `b64ce63c03e27a00a3089884d0b7064c57ee8cf7`.
- Application main: `478b7b2dd46a92471bb53a95c6b827f583c36335`; exact tree diff from validated source empty.
- Existing Vercel team `monowanderer373s-projects`, project `tabby-tally`.
- Production: https://tabby-tally-monowanderer373s-projects.vercel.app/
- Application deployment `dpl_6WbWGu42cgUaMAFRupBtY5bhaoYn`, **READY**; immutable URL https://tabby-tally-m5lxwjyq6-monowanderer373s-projects.vercel.app/ .
- Public alias serves `/assets/index-Brc8eCSk.js` containing the actual application main SHA; `SpendingRecordsPage-DqugOj_R.js` and native perforation SVG are precached with content revisions.
- A documentation-only checkpoint follows this fully verified application, and can trigger another existing-project build. Final current commit/READY/alias/PWA read-back lives in delivery `deployments.json`, `version.json`, `pwa.json` and `current-cache.json`; application metadata is preserved separately as `app-*`. No code change is hidden in the documentation checkpoint.

## Actual FX and daily scheduling
The existing Supabase project `skiqsxvmxvmxfzhrzcxh` has26 migrations matching source versions. Both FX migration bodies match exactly after normalizing their stored Windows CRLF; original financial-function hash remains `cdce29c88693608bfe6c1e530875c13a`. No new SQL/manual installation is needed.

Normal authenticated FX health/snapshot reads prove the regular daily14Oct run, not just a bootstrap task: active Cron `10 9 * * *` (17:10Malaysia), started09:10:00.187103UTC, succeeded/fetched09:10:00.194262, ended09:10:01.781075, failureNULL. Snapshot `a937119d-3f9f-4f15-989c-b5bfb997ffa3` contains12 actual14Oct quotes; original MYR→CNY1.6371, MYR→VND6329 and MYR→USD0.2448 are retained alongside canonical MYR-per-foreign inverse fractions, provider keys, actual rate dates and fetch time.

Previously established owned QA originals MYR48.00/USD7.89/VND456,789 reconcile to reference USD≈RM32.23, VND≈RM72.17 and chart total RM152.40 using that exact snapshot. Shared own VND456,789 differs from permission-visible Bill VND913,578. These are controlled QA facts, not customer data or the approved design fixture. No new CNY production transaction was created merely for a screenshot; CNY is verified in real cached quotes and isolated UI/statistics tests.

Developer-network direct Frankfurter endpoints/docs return403. Current official OpenAPI2.1.1 and response direction/schema were read from official GitHub; the actual hosted worker's successful daily fetch/cache is separate hosting evidence. No mock/provider fallback replaces it. Last-good persistence and no-RM0 failure behavior remain covered by isolated application/DB tests. Future15Oct execution cannot be claimed before it occurs.

## Screenshots / remaining limits
Delivery gallery: `/workspace/verification/paper-receipt/comparison/index.html`. All53 approved component PNGs appear beside actual existing-application screenshots;16 card layout simulations, state/long-value examples and native production controlled-QA images are clearly separated. Main native card: `live/receipt-controlled-qa-390.png`; Records own-share and post-rate privacy examples are included. Source fonts differ from reference SVG DejaVu Sans, so glyph/raster rendering is not pixel-identical; required structure/colors/geometry and native component hierarchy are checked.

All safe executable work is complete. No customer account/screenshots, credentials, private principal/request checkpoints, browser profiles or signed artifact URLs belong in the delivery archive. QA sessions are logged out and client auth cleared. No user action is required for this release. Real-device verification and developer-network/provider artifact access remain explicitly limited, without blocking the verified hosted application.
