# Tabby Tally project status

Checkpoint: 2026-10-13 (Asia/Kuala_Lumpur).

## Resume first
Read this file, WORK_LOG.md, CONTEXT.md/ADRs, git status/diff and latest remote main. Preserve user changes. Historical HANDOFF/CONTEXT rollout notes are not current deployment or migration evidence. Do not reset/reapply from them.

## Takeover baseline
- Repository monowanderer373/monosplit, production branch main. Initial work branch and freshly fetched main were clean at 2041f71a298eca03ca96eeb6b8f3f8f485506660.
- React 19 / TypeScript / Vite / Supabase / PWA; npm lockfile and Node 22 CI confirmed. No framework/dependency migration.
- QuickAdd PR #8 and Trip period/lifecycle PR #9 already existed; retained and regressed.
- Full TabbyTally_Codex_Master_Handover_2026-10-13.md read; Insights/Records ZIP specs/CSS and eight design images read/inspected. Attachments are design/history context; current user scope and finance/security model take precedence.

## Completed implementation
- PRs #10–#13 merged. Application release on main: 96975260db658185fa926dce5bb122ca1d050ba8. Later documentation-only checkpoints may follow; read git HEAD rather than treating this SHA as the current documentation commit.
- Paper/denim Insights: anchored month/scope/currency popovers, Total spending ticket/View records, Categories, DAILY Trend and CATEGORY Ranking with original tie order.
- Independent Spending records: identical authoritative snapshot/filters/own shares/count/currency; original editor and permissions; readable received records remain visible with readonly details when editing is unavailable. Zero-owner-share records retain their real count. Back restores filter/tab/scroll and loaded rows survive closing the editor.
- Preserved finance/RLS/RPC definitions, conceal privacy, original QuickAdd/navigation; no design JSON runtime/fallback, migrations, schema/RPC changes or lockfile changes.
- Fixed late/previous-identity ledger reads and change-request reads, scroll identity scoping, and account-local This month calculation at click time.
- Source details: docs/insights/IMPLEMENTATION.md. Changed App/AppShell, Insights/Records, shared selectors/hooks, original sheet opt-in fallback, scoped styles/assets/i18n/PWA, meaningful tests, CI screenshot upload and recovery documents.

## Validation and production runtime
- PR #13 Quality run 38300943435: all six jobs success. 524 Vitest / 77 files; lint/build/audit; 723 pgTAP / 16 files, database lint/concurrency/historical upgrade; 71 browser tests (all passed), dedicated CollectPay 10 and Travel/QuickAdd/Trip period 16 passed.
- Previous PR #12 browser artifact verified 71 expected, 0 flaky/unexpected/skipped. Latest PR #13 run log confirms 71 passed; downloading its artifact remains network-policy blocked. Its extra change is a unit-tested click-time month calculation; screenshots from PR #12 still depict the final layout.
- Main Quality run 38301821324: all six jobs succeeded; application tree matches tested PR #13.
- Actual existing production alias serves exact application SHA in /assets/index-D47gnCAe.js and /assets/SpendingRecordsPage-DKmJHqLy.js. Expected Supabase project reference confirmed.
- Same retained PWA profile upgraded to the new entry, worker activated, Records cached; signed-out Records guards/no overflow at 320/360/390/430 and offline shell passed. TLS verification retained. No fabricated API responses or private account credentials used in these production checks.
- UI screenshots use explicitly fictional test-created responses; real database/RLS evidence comes from separate disposable Supabase CI tests. Physical phones/OS keyboard/safe-area and private production writes remain unverified.

## Real external blockers
- GitHub read/API/push/merge verified. Vercel API missingToken, VERCEL_TOKEN absent; native CLI also has no saved login. GitHub deployment metadata remains stale. Production runtime is verified, but current deployment ID/management terminal state is unverified. Do not say complete live acceptance.
- SUPABASE_ACCESS_TOKEN absent and native CLI has no login; remote migration history cannot yet be read. No production DB modifications occurred.
- Secure requirements saved in cloud environment settings: VERCEL_TOKEN to api.vercel.com; SUPABASE_ACCESS_TOKEN to api.supabase.com. Both still lack saved bindings. Enter values there, never in chat. Draft setup/start instructions and additive network destinations saved; saving a draft is not environment publication.
- Local Docker vfs/32 GB cannot extract PostgreSQL; real backend CI passed. Do not retry unchanged or reset production.

## Next executable step
Securely bind the two management tokens, save settings/apply to this environment as supported, then run python3 scripts/Verify-InsightsConnections.py. Confirm Vercel project tabby-tally under monowanderer373s-projects, production deployment git SHA/alias/terminal state and read Supabase skiqsxvmxvmxfzhrzcxh migration history without applying changes. Existing feature is implemented and serving production; do not rebuild it. Update this checkpoint/report with actual management evidence.
