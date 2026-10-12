# Insights / Spending records — 2026-10-13

Design: TabbyTally_InsightsRecords_Complete_Handoff.zip (2026-10-12). Full master handover read. No design fixture is imported into runtime or database.

## Data / navigation
`useSpendingView` derives one snapshot from the existing fully paginated, RLS-protected `ledgerRepository.listExpenses` / `derivePersonalLedgerRows`. `spendingSnapshot` preserves `isBookedHomeExpense` and own `personalSpendingMinor`, excludes undelivered outbox rows, separates currencies, and produces total, complete count, categories, days and records together. Records display 40 more rows at a time without changing total/count.

Committed month/scope/currency/tab live in validated URL parameters. Draft year browsing never changes that snapshot. `useRouteScroll` restores identity-scoped history entries; replacing filters carries the current scroll. Original ExpenseActionSheet opens inline as the existing accessible editor, preserving list scroll and loaded rows when closed. No second finance service, editor, schema or RPC was added.

Bill is the canonical `totalMinor` actually returned by expense RLS, not inferred from private shares. Creator/participant/Space edit authority stays in the original expense policy and RPCs; change requests must load before editing. Missing authority/read errors fail closed. Ledger response generations prevent late refreshes/previous identities overwriting authoritative state.

Privacy follows `homeUi.balanceHidden`: totals, row amounts, bill amounts, graph values and percentages are hidden across navigation. Original explicit edit dialog continues to follow its existing editing behavior.

## Intentional differences from illustration
- Ranking remains CATEGORY ranking, as implemented on main. The design's fictional record ranking does not redefine it.
- Trend remains DAILY user-share spending. Native SVG renders that original data; the repository had CSS charts, no chart library. Future dates without observations are not drawn as confirmed zero values.
- Currency options come from accessible records plus the selected supported currency; no FX conversion or fictional choices. Explicit currency stays selected for zero-result filters.
- Date headers use existing localized formatter. Nav/QuickAdd are the existing fixed components. Records has no global nav/Add button.
- At narrow widths/200% text, filters wrap and row amounts move below titles. No clipping/shrunken typography to force a drawing match.

## Verification boundaries
- Local unit/behavior tests and API-intercepted Playwright UI checks distinguish mocked responses from actual database validation.
- Screenshots under ignored `test-results/insights-ui/` contain only test-created fictional data, not design JSON or private accounts; CI uploads them with browser evidence.
- `e2e/insights.spec.ts` runs against disposable LOCAL Supabase: real Personal/confirmed Direct records, own-share reconciliation, original editor, currency separation and foreign-account RLS rejection. Existing CI also runs pgTAP and prior QuickAdd/Trip/CollectPay/Travel regressions.
- Local Docker vfs/32 GB cannot extract PostgreSQL; use real CI evidence, not a claim of local backend tests. Physical keyboards/OS safe area and private production writes remain distinct from emulator/public checks.
- New assets are included in production PWA precache; no credentials/financial screenshots enter Git.
