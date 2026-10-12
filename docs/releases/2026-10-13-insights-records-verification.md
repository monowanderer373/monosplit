# Insights / Spending records — verified rollout checkpoint

2026-10-13, Asia/Kuala_Lumpur.

## Result and code

PRs [#10](https://github.com/monowanderer373/monosplit/pull/10), [#11](https://github.com/monowanderer373/monosplit/pull/11), [#12](https://github.com/monowanderer373/monosplit/pull/12), [#13](https://github.com/monowanderer373/monosplit/pull/13) merged to main. Final application release commit: 96975260db658185fa926dce5bb122ca1d050ba8; final PR head d6ce0aff66e93232293773d39af5728eec0f1eaf has the same application tree.

Approved paper/denim Insights and independent Records are implemented with canonical own-share statistics, full count, anchored filters, original permission-aware editor/readonly details, privacy and navigation restoration. Zero-own-share records, received noneditable shared rows, original category tie order and an open page crossing the account-local month boundary have regression coverage. Financial model/RPCs/schema/dependencies unchanged.

## Actual checks

- [Final PR Quality 38300943435](https://github.com/monowanderer373/monosplit/actions/runs/38300943435): six jobs succeeded. 524 unit tests / 77 files, lint, production TypeScript/Vite/PWA build and dependency audit passed.
- 723 pgTAP assertions / 16 files, database lint/concurrency and historical upgrade passed against isolated Supabase.
- Full browser log: 71 passed. Dedicated CollectPay 10 and Travel/QuickAdd/Trip period 16 passed. Latest artifact download remains blocked at its Azure blob destination; do not invent artifact statistics. Previous PR #12 artifact is available: 71 expected, zero flaky/unexpected/skipped.
- [Main Quality 38301821324](https://github.com/monowanderer373/monosplit/actions/runs/38301821324): all six jobs succeeded.
- UI coverage: 320/360/390/430/1024, all three panels/popovers, draft year/keyboard/Escape/outside/focus, 200% Chinese/long text, complete records/own shares/progressive list/original editor/back-scroll, empty/error/conceal/zero-share/readonly states.
- Separate real Supabase browser journey created Personal and confirmed Direct expenses, checked currency and own-share reconciliation, original editor, zero-share advance, friend-created received record with readonly Bill/share and foreign private RLS denial. Local reset was CI's disposable stack only; no production financial writes.

## Existing production runtime

[Live alias](https://tabby-tally-monowanderer373s-projects.vercel.app/) serves exact release SHA 96975260db658185fa926dce5bb122ca1d050ba8 in /assets/index-D47gnCAe.js; /assets/SpendingRecordsPage-DKmJHqLy.js is served and precached, as are Insights icons. Expected production Supabase project reference is present in the client.

Actual Chromium, with no synthetic app/API responses or private-account credentials, verified the same installed profile upgrading from older releases: worker activated, new entry controlled, Records cached. Public private-route guard and no overflow at 320/360/390/430 passed; offline updated Records shell passed. TLS verification stayed enabled using the platform public CA in an isolated profile constrained to this production hostname; shared home trust store untouched.

## Screenshots and intentional differences

Ignored /workspace/verification/pr12-browser-artifact/insights-ui contains actual rendered implementation images using explicitly fictional test API records, including readonly and zero-share states. These are not design PNGs/JSON, production fallback or private production account screenshots. Production evidence contains signed-out/offline pages only. Evidence ZIP combines these clearly labeled sources without raw logs/secrets.

Ranking remains the original CATEGORY ranking and Trend DAILY user-share spending; fictional record-ranking/example values do not change finance semantics. Currency choices reflect real accessible rows/current supported selection without FX. Narrow/200% layouts wrap rather than clip. Original editor is retained. Physical phones/OS keyboards/safe-area and private production write journeys remain unverified.

## Outstanding management acceptance

Actual production code is serving and public/PWA checks passed; complete live acceptance is still open:

- Vercel API returns missingToken and native CLI has no existing login. VERCEL_TOKEN is absent. Current deployment ID/management terminal state cannot be confirmed; GitHub Vercel deployment metadata remains historical.
- SUPABASE_ACCESS_TOKEN absent; native CLI has no saved login. Remote migration history remains unread. No migrations were created/applied by this work; old reports are not treated as current migration evidence.
- Secure token requirements saved in cloud environment settings. Create a Vercel account token with access to monowanderer373s-projects and a Supabase personal access token; securely bind VERCEL_TOKEN (api.vercel.com) and SUPABASE_ACCESS_TOKEN (api.supabase.com), then save/apply settings through the product. Do not put values in chat. Draft persistence does not publish the environment.
- Resume with python3 scripts/Verify-InsightsConnections.py, match real production SHA/alias/state, read remote migration versions, and update the recovery documents. Missing-binding helper path executed; connected path awaits credentials.
- Local backend setup remains blocked by Docker vfs/32 GB extraction capacity; the passing isolated CI backend evidence is separate from local readiness.
