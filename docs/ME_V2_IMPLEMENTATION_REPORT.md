# Me V2 implementation report —2026-10-25

## Delivery status

Implemented in [PR #36](https://github.com/monowanderer373/monosplit/pull/36) and merged to main `121df2b54d2598bbf6cdf2219807f6b9f7ddf368`; its complete tree equals validated PR head `adb266e0b3c983a9870f40cd39f56166c5ca882d`. The existing production deployment is **READY**, `dpl_8MtUcABW87GNJCWeWc3i9XrL8wSA`, and the canonical public bundle contains that exact main SHA. Live: https://tabby-tally-monowanderer373s-projects.vercel.app/ .

Normal tagged-owned QA login verified real profile update/readback/restoration, persisted EN/ZH, centered language dialog, focused subpages, explicit password page without a production password change, disabled deferred actions, authoritative Fresh Start preview/opening review only, verified empty archive, Records total/tab/scroll return, and amount privacy. No API interception, financial mutation RPCs, runtime errors or production Reset. Hashes of ten financial tables and all period IDs remain unchanged. Retained PWA caches contain the current entry, ProfilePage, Records, Accounts and Shared chunks after native registration.update(); stable paper assets match source hashes even offline. Signed-out Records guards pass at 320/360/390/430 px and its updated shell loads offline. Final documentation-only deployment metadata is recorded externally in delivery-final.json to avoid a self-referential commit loop.

The owner installed001and then the V2bundle after the two concrete SQL Editor requests.001readback verified29migrations/0periods/0openings; final readback verified30versions,9function bodies after only CRLF-to-LF canonicalization,6owner RLS tables/no direct writes,0periods/openings, normal tagged-QA safety2/preview/anonymous denial and unchanged financial hashes. No production Reset was run.001is frozen byte-for-byte. The SQL binding remains supabase_read_only_user/read-only/noCREATE; the owner completed both required SQL Editor installation steps. Normal development/push/merge/production authorization already exists; no secret in chat is needed.

The complete V2bundle is docs/runbooks/personal-periods-production-apply.sql, generated from001+002. It skips installed001, atomically installs missing002, targets30versions and returns TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025_V2. Earlier35032-byte bundles/marker are superseded. Do not reinstall old multicurrency/FX releases.

## Real implementation

Primary source: TabbyTally_Me_V2_Design_Implementation_Spec.md. Complete pasted request, all12approved PNGs and prototype were reviewed; MD and financial security win over mock examples.

- Compact horizontal profile, divided row groups, separate Reset/Sign out. No Manage Accounts/Appearance. Existing nav/Quick Add stay on main Me; subpages hide both.
- Display-name saving uses a real current-user UPDATE plus authoritative readback. Original UPSERT failed INSERT RLS; no permissions were widened. A late response cannot rename the next login; local form state is keyed by Auth identity.
- Existing persisted EN/ZH setter drives a truly centered native language dialog, Escape/Back/focus return and refresh persistence. Security reads actual email verification. Password manager is explicit and neutral; email/OAuth is never treated as proof of an existing password. No public has_password or2FA.
- Existing guest linking, password update and signout remain. Warn for guest access, real outbox/entered Quick Add/profile work; empty restored forms do not trigger a warning.
- Avatar upload, new recovery email flow, CSV, privacy URL, deletion, feedback upload/submission and guides are visibly unavailable. Feedback text stays on this screen; no automatic diagnostic or financial submission.
- Twelve states use real React/CSS/SVG/routes. No screenshot-as-UI/fake OS bars/prototype financial data or fallback.

## Financial boundaries

Logical owner periods archive only truly personal history references. Canonical expenses, Participants/Person identities, contributions/shares, settlements/allocations/reversals, native journals, transfer/fee references and funding remain authoritative. Shared/Group/Trip correction components are protected; raw shared calculations retain the full ledger. F=E−T+R and integer-money engines are unchanged.

Confirmed user policy: recurring bills, open instalments and pending deductions keep their original flows. Later actual postings enter the new period. Funding an archived purchase becomes native cash activity, never second spending. Daily/Insights/Records share the personal membership boundary. Personal metadata loading/error does not hide independently verified Shared summaries.

The server owns classification, exact native amounts, reference fingerprint, signed recent AMR and locking; refresh iat is insufficient reauthentication. Opening choices compose the original versioned balance-anchor command once per existing native currency, including units sharing a parent, negative balances and explicit unknown review. Original positive-owed liability semantics remain. No FX estimate becomes money.

Commit is atomic across periods, membership, native anchors and receipt, with ordinary-writer table exclusion, actor lock and fingerprint recheck. Failures roll back entirely. Identical request replay returns its receipt; changed payload conflicts. Reconciliation returns committed status or fences an unposted request so a delayed original cannot post later. Only an identity-scoped UUID is persisted; no password/opening amounts. Reload/OAuth/Back require renewed opening review/confirmation. Reporting invalidates on a known period transition until authoritative refresh.

### Safety limitation over the prototype

Pending tracked shared cash, active instalment principal/repayment accounts and due/unposted recurring cash cannot infer bank inclusion in a different opening.002requires recorded known balances to be retained and leaves the original obligations untouched. Unknown linked balances block review rather than becoming zero. The server rejects forged changed openings. This limits the prototype's freely editable fields instead of redesigning settlement/repayment models.

Archives are owner-only read-only projections of canonical facts/native activity/opening snapshots. No delete/edit/Restore promise. Fresh Start is separate from Auth deletion and any future Restore milestone.

## Tests and actual scope

| Check | Checkpoint result | Limit / evidence |
|---|---|---|
| Baseline unit/lint/build | PASS |704tests/103files |
| Latest unit/lint/TypeScript/PWA build | PASS |717tests/104files |
| Full local production-module UI | PASS |198passed in2.8m with latest safety/status changes |
| Latest Me journeys | PASS |14cases,12states plus linked-known/unknown gates, recovery, native precision and focus/Back |
| View/text/keyboard simulations | PASS |320/360/390/430;125/150/200%root text;420px resized layout |
| Real disposable SQL | PASS |Source3d37393:919pgTAP/20files,57new; original862also pass |
| Real concurrency/property tests | PASS |Ordinary-writer exclusion/stale rollback, duplicate receipt/fence/recovery,15signed-native conservation samples |
| Complete historical bundle twice | PASS |Source3d37393; preserves old79429-byte multicurrency bundle |
| Full authenticated browser/Travel/CollectPay/production graph | PASS |Final PR head Quality40169865461 all seven jobs SUCCESS, zero failure annotations: 354 full browser, 16 Travel, 10 CollectPay, 198 production UI. Includes real isolated password update then new-password login with the same principal. |
| Physical Honor/native IME/fonts/browser UI zoom | NOT RUN |Simulations are distinct |
| Local Docker backend | BLOCKED |Actualvfs; extraction failure not repeated. Real backend uses disposable GitHub Actions |
| Production Reset/financial writes | NOT RUN |Prohibited for QA; mutating tests run only isolated |
|001+002production install/API smoke | PASS |30versions/9body hashes/6RLS tables; normal QA safety2/preview and unchanged financial facts |
| Existing production/live/PWA | PASS |Native READY/exact public main SHA, normal owned-QA live checks and current ProfilePage cache. No production financial writes. |

Earlier failed attempts are retained in WORK_LOG: schema/lint references, test-only trigger search path, wrong liability-sign expectation, original profile UPSERT/RLS, and one Back/Forward test race fixed with exact heading/control readiness. They are not current passing results. A pre-final source run also retried two existing multi-user navigation timeouts; final PR-head CI passed without failure annotations. Initial live readback compared innerText against a textContent matcher (hidden accessibility copy differed); the external verifier now compares textContent consistently. The application did not change for that verifier fix, and the complete live rerun passed.

Backup API lists no physical snapshots/PITR; operator encrypted backups are outside this workspace and unverified here. The install is additive/forward-fix, never a production Reset/test restore.

## Screenshots and differences

Safe gallery: /workspace/verification/me-v2-2026-10-25/delivery/index.html . Twelve approved references are paired with unchanged actual390×852 application captures and a hash/source manifest. Actual captures use synthetic intercepted API data, not private production accounts or physical hardware.

The app omits fake system bars, displays actual profile/auth/version data, disables future services and uses server-derived impact/native balances. Long impact/account/archive content scrolls safely. Linked-opening restrictions and explanations are necessary financial adaptations, not a pixel-perfect mock-data claim.

## Rollout / recovery

1. Completed: owner installed 001 + 002; independent exact-version/function/RLS/API verification passed. **No further SQL action is needed.** Both deployed migrations are immutable.
2. Completed: final exact-head CI and normal merge; existing-project native READY/public SHA/owned-QA live readback. Detailed safe evidence is under /workspace/verification/me-v2-2026-10-25.
3. The final checkpoint changes documentation only. Verify its exact native deployment/public SHA and retained caches into external delivery-final.json; no repeat financial tests or schema installation.
4. Preserve period-aware reporting after periods are used; an old pre-period UI rollback ignores that boundary. Use forward migrations for corrections. Automated Restore is out of scope.

## All modified files

- `.github/workflows/quality.yml`
- `docs/ME_V2_IMPLEMENTATION_REPORT.md`
- `docs/PROJECT_STATUS.md`
- `docs/WORK_LOG.md`
- `docs/adr/0011-personal-reporting-periods.md`
- `docs/runbooks/personal-periods-production-apply.sql`
- `docs/runbooks/personal-periods-sql-editor.md`
- `e2e/fixtures/insightsUi.ts`
- `e2e/fixtures/notifications.ts`
- `e2e/me-v2-backend.spec.ts`
- `e2e/me-v2-ui.spec.ts`
- `e2e/travel.spec.ts`
- `e2e/trip-period.spec.ts`
- `e2e/universal-quick-add.spec.ts`
- `playwright.production-ui.config.ts`
- `scripts/generate-multicurrency-apply.py`
- `scripts/generate-personal-periods-apply.py`
- `scripts/report-database-failure.py`
- `scripts/report-database-results.py`
- `src/App.tsx`
- `src/components/AppShell.tsx`
- `src/components/home/HomeScreen.tsx`
- `src/components/me/FreshStart.tsx`
- `src/components/me/MeIcon.tsx`
- `src/components/me/MeUI.tsx`
- `src/hooks/useAuth.test.tsx`
- `src/hooks/useAuth.ts`
- `src/hooks/useHomeModel.test.tsx`
- `src/hooks/useHomeModel.ts`
- `src/hooks/usePersonalLedger.test.tsx`
- `src/hooks/usePersonalLedger.ts`
- `src/hooks/useSpendingView.ts`
- `src/lib/homeView.ts`
- `src/lib/personalPeriods.test.ts`
- `src/lib/personalPeriods.ts`
- `src/lib/quickDraft.test.ts`
- `src/lib/quickDraft.ts`
- `src/pages/PersonalLedgerPage.tsx`
- `src/pages/ProfilePage.tsx`
- `src/pages/me-v2.css`
- `supabase/migrations/202610250001_personal_ledger_periods.sql`
- `supabase/migrations/202610250002_personal_period_opening_safety.sql`
- `supabase/tests/personal_ledger_periods.sql`
- `supabase/tests/personal_period_concurrency.py`
