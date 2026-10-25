# Me V2 implementation report —2026-10-25

## Delivery status

Implemented on feat/me-v2, [PR36](https://github.com/monowanderer373/monosplit/pull/36), against current-main baseline ddb4333586f9dacc4005dc8f3d1e8d2a39dbec28. This checkpoint is **not a production completion claim**. Existing production: https://tabby-tally-monowanderer373s-projects.vercel.app/ .

The owner installed001and then the V2bundle after the two concrete SQL Editor requests.001readback verified29migrations/0periods/0openings; final30-version/code/permissions verification is recorded externally before frontend rollout. No production Reset is run.001is frozen byte-for-byte. Current SQL role is supabase_read_only_user/read-only/noCREATE; installation needs the existing project's SQL Editor. Normal development/push/merge/production authorization already exists; no secret in chat is needed.

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
| Full authenticated browser/Travel/CollectPay/production graph | PASS at3d37393; final source pending |CI40167019668all7SUCCESS; final code/status split and isolated password-save check require final SHA |
| Physical Honor/native IME/fonts/browser UI zoom | NOT RUN |Simulations are distinct |
| Local Docker backend | BLOCKED |Actualvfs; extraction failure not repeated. Real backend uses disposable GitHub Actions |
| Production Reset/financial writes | NOT RUN |Prohibited for QA; mutating tests run only isolated |
|002install/new production/live/PWA | BLOCKED |Read-only SQL binding;001installed only |

Earlier failures are retained in WORK_LOG: schema/lint references, test-only trigger search path, wrong liability-sign expectation, original profile UPSERT/RLS, and one Back/Forward test race fixed with exact heading/control readiness. They are not current passing results.

Backup API lists no physical snapshots/PITR; operator encrypted backups are outside this workspace and unverified here. The install is additive/forward-fix, never a production Reset/test restore.

## Screenshots and differences

Safe gallery: /workspace/verification/me-v2-2026-10-25/delivery/index.html . Twelve approved references are paired with unchanged actual390×852 application captures and a hash/source manifest. Actual captures use synthetic intercepted API data, not private production accounts or physical hardware.

The app omits fake system bars, displays actual profile/auth/version data, disables future services and uses server-derived impact/native balances. Long impact/account/archive content scrolls safely. Linked-opening restrictions and explanations are necessary financial adaptations, not a pixel-perfect mock-data claim.

## Rollout / recovery

1. Finish final source checks. Download the full pinned V2file, run once in existing skiqsxvmxvmxfzhrzcxh SQL Editor; no fragments, manual history rows or secrets.
2. Independently verify30versions, final function bodies, owner RLS/grants, safety version2, normal tagged-owned QA capability/preview and unchanged financial fact hashes. Never execute production Reset as QA.
3. Merge only after installation. Deploy existing Vercel project, verify native READY/exact main SHA/public entry, normal login/profile/language/security/Records/privacy and retained PWA update.
4. SQL failure rolls back the bundle. Preserve installed001and use forward migrations. Once periods are used, preserve period-aware reporting; an old pre-period UI rollback ignores that boundary. Automated Restore is out of scope.

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
