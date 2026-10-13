# Insights AutoFX FINAL2026-10-13

Existing app/project; approved package fully replaces conflicting prior module design. All four boards, three exact renders and50 individual parts reviewed. Specifications/SVG geometry take priority over presentation canvas, clipped reference exports or illustrative values. Native20px denim corner/4px weave/subtle paper grain only. No full component images as runtime UI.

## Implementation boundary
One RLS-loaded complete canonical ledger supplies month/scope, counts and user shares. All currencies remain distinct original facts. Versioned edits/settlements, identity UUIDs, financial engine and financial tables remain unchanged. Legacy Insights currency query no longer filters records; other routes untouched.

Display valuation uses exact BigInt rational arithmetic and currency metadata (VND/JPY0,MYR2; helper tests3 digits without adding unsupported ledger currencies). Aggregate first, round at display boundary. Largest remainder in stable group order reconciles currency/category/day estimates to the same total. Exact original/estimate formatting avoids unsafe-number loss; estimates beyond chart safe range retain originals and show a range state.

## FX backend/runbook
- Forward migration202610130001 only adds independent `tabby_fx` metadata, authenticated read RPC and extensions `http`/`pg_cron`. No existing financial table/function changes. Before/after hash existing public functions, source/remote migration history and extension status.
- No existing FX cache to reuse. No customer data export is needed for these new empty metadata objects; platform backup metadata is checked and reported separately, not invented as a restorable backup. Entire migration and ledger append must be one transaction; failure rolls back. Never reset production or modify older migration rows.
- PostgreSQL Cron runs fixed `tabby_fx.refresh(true)` as migration owner at09:10UTC daily. No service-role/client/task secret or Edge Function needed. Read RPC is authenticated; schema/table/worker access revoked from anon/authenticated/service_role. No client quote writes/URL input. HTTP only fixed Frankfurter v2 host, static supported currency batch, no account/transaction/amount details.
- Global advisory transaction lock deduplicates concurrent reads. Latest refresh TTL24h; timeout10s/connect4s,429 cooldown1h,other failures15min. Cached reads preserve last-good; immutable snapshot id pins Insights/Records/back. Provider rate date and fetch timestamp are separate; missing pairs preserve old pair metadata and its real dates. No fallback provider, fixture or hardcoded rate.
- Quote MYR→foreign is stored as exact decimal text; canonical MYR-per-foreign numerator1/decimal denominator. Frontend divides using exact fractions. Source Frankfurter blended reference; historical months also latest reference, never a transaction-day claim. Date ranges shown if quotes differ; older-reference over7d, cached per-pair fetch over24h, updating and unavailable all keep original facts/counts. Partial charts explicitly name missing currencies; absent estimate is null, not0/1:1.
- Roll back frontend via existing Vercel prior deployment. If worker must stop, unschedule only `tabby-insights-frankfurter-daily`; preserve snapshots for existing pinned clients. Later removal only by a new reviewed forward migration; never rewrite deployed history. No financial restoration/reset is part of this feature.

## Current evidence
Official provider OpenAPI2.1.1 read from live endpoint and official GitHub. Actual cloud request HTTP200: MYR→USD0.24478,MYR→VND6332, observation2026-10-13. These differ from design mock6250 and are not a production hosting claim.

Initial isolated CI detected explicit JSON typing/volatility warnings; fixed before any production migration. Corrected database and historical-upgrade jobs passed; full UI/feature CI and production remain pending. Package reference21/21; current targeted application25/25 passed. First local full test had5 failures:3 obsolete assertions fixed and2 unrelated tight interaction waits under CPU contention; full rerun required. Local browser startup hit cold TypeScript build120s budget; external wrapper extended300s, original browser/config/CI assertions preserved. Physical Honor/OS inputs not available; root-font scaling and simulated viewports are labeled as such.

## Design map
F01–18: Month+Scope actual text fit, no external labels/currency; existing anchored shell/keyboard/year drafts, light blue year toolbar. S01–16: static all-currency A statement, clean lower corners/quiet month/footer, precise original/estimate and honest states/accessible conceal. T01–05: original renderer and Category Ranking definition, MYR display estimates and coverage. R01–08/E01–03: independent all-currency list/same snapshot/date groups/own shares/permission-bound Bill/original editor/read-only fallback/loading/Retry/Change month.

Completion screenshots/CI/live/cache/Cron evidence are recorded in the release report after actual checks.
