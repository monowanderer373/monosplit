# B Paper Receipt v2 — implementation map, 2026-10-14

The latest package `TabbyTally_PaperReceipt_FINAL_2026-10-14` supersedes A/Denim-corner receipt treatments. Its execution/final decisions, all specifications/reference code/styles/QA, approved image, four boards, 53 individual parts and five full-page references were read/reviewed. All 184 manifest entries and 36 reference tests passed; those reference tests are not application test evidence.

| Design parts | Existing application implementation |
|---|---|
| F01–F18 Month/Scope, year/month draft and anchored popovers | `InsightsFilters.tsx`, scoped `insights.css`; original state, keyboard/focus, selection and collision placement retained |
| S01–S06 main/compact totals, native header/footer | `InsightsPage.tsx`, `SpendingTotals.tsx`, `insights.css`/tokens; single cream shell, pale blue header/footer, receipt icon, 7px side notches, no heading rule/corner/fold/backing/double border |
| S07–S19 ISO/amount/reference, source, separators and perforation | `receiptLayout.ts`, `SpendingTotals.tsx`; native 9×8 SVG `receipt-perforation.svg`; one 2.4px dot/9px-period footer row |
| T01–T05 Categories/Trend/Ranking | Existing `SpendingCharts`; original statistical definitions and canonical MYR valuation retained; selected-tab border aligned to native board |
| R01–R08 Records header/rows/own-share/Bill/date/divider | Existing `SpendingRecordsPage`, scoped CSS, unchanged canonical records and original expense editor; title weight matches final component board |
| E01–E03 empty/error/change-month | Existing `SpendingUI`; error Retry/Change month and live data loaders retained |

Default main rows are 60px; one non-fitting original/reference changes the whole currency group to 84px stacked rows. ISO, original amount and estimate use common measured columns, with the same empty estimate slot for MYR. Original amounts stay 28px; estimates 12px and right-aligned on the common baseline. Compact Records rows remain 48px/72px. Extreme numbers retain every exact digit in a labeled keyboard-scrollable number region; the page does not overflow. Header/source/footer use their actual text measurements. Default card heights match 194px single MYR, 288px two currencies, 348px three and 228px foreign-only. No font shrink or per-row exception.

Healthy source is one `Rates: Frankfurter · [actual date]` paragraph. Latest-reference basis remains accessible/in tooltip and charts, without an extra visible policy line. Exceptional updating/cached/missing states and Retry remain clear. Missing references never become RM0. All currencies are simultaneously visible; no Currency selector or currency-selection state. Existing comma grouping and exact BigInt formatting remain.

Summary, charts and Records reuse the same real aggregation and pinned persistent FX snapshot. Shared original amounts are the user's own contribution; Bill uses existing visibility/permission checks. Back restores month/scope/tab/scroll/snapshot. No financial formula, currency precision, Participant UUID, RLS, immutable history, RPC, service, dependency or schema change.

Validation: 53 IDs map one-to-one in the deliverable HTML gallery to native original PNG and actual application/context screenshot. S10/R07 lines, S19 notches and T02 title are intentionally captured within their actual component context. Synthetic approved data/rates live only in `e2e/fixtures/paperReceipt.ts`; production has no design-fixture imports/fallbacks. Native production screenshots are separately labeled and use only previously established owned QA facts, not customer records. App fonts are retained; reference SVG uses DejaVu Sans. Raster/device-pixel font rendering can differ from the native reference, while geometry, colors and typography hierarchy follow the source specifications.

Tests: `SpendingTotals.test.tsx`, `InsightsPage.test.tsx`, `paper-receipt.spec.ts`, `paper-receipt-components.spec.ts`, existing `insights-autofx.spec.ts`/`insights-ui.spec.ts` and production/offline `app.spec.ts`. Full isolated CI and native release evidence are in the matching release report. CSS viewport/root-font simulation is not a claim of physical Honor, OS keyboard, OS text scaling, safe-area inset or browser UI zoom verification.
