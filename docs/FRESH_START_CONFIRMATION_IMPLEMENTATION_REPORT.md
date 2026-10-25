# Fresh Start — existing session confirmation

Release checkpoint: 2026-10-26 (Asia/Bangkok). PR [#38](https://github.com/monowanderer373/monosplit/pull/38) merged; application main `8e97c6d127c4db2dd260370e5d69cbed07bb98ea` exactly matches validated source `d2ced1c5965b2810f3bf832752c127ee9c468083`. Production application and authenticated/PWA live verification COMPLETE. A final documentation-only deployment follows, with final native READY/SHA/cache evidence saved externally.

## Behavior

The user's latest instruction replaces the previous recent-AMR/password/Google requirement. After the existing impact and native opening-balance review, final confirmation presents a warning and Yes/Cancel. No additional OAuth redirect, password or second checkbox. A normal signed-in permanent owner remains required; invalid/changed sessions and guests are still rejected.

The reported Google flow left the application and intentionally discarded in-memory opening review. The new flow stays in the application. Reload/Back still requires explicit opening review, now with a direct recovery button. Cancel does not post a transaction. Unknown balances require an explicit reviewed value; locked linked obligations retain recorded balances. No balances/passwords are persisted for recovery, and unresolved operation IDs still require authoritative reconciliation.

## Backend and installer

Forward003 replaces only two functions: remove recent-AMR policy and use the session audit label in apply_personal_fresh_start; advertise confirmation capability1 in get_personal_ledger_period_state. Exact comparison proves all original fingerprints, locking, native balance anchors, protected Shared/settlement history, request idempotence and reconciliation remain. No table/RLS/identity/financial model change. Frozen001/002 and their60713-byteV2bundle are unchanged.

The first raw-DDL installer failed its strict function-body checksum and rolled back: independent readback confirmed30versions and original002functions. It is superseded. The corrected17862-byte installer decodes canonical UTF-8 migration from Base64, validates payload hash before DDL and retains exact function/grant/history checks. Disposable historical tests reproduce the former indentation failure, validate LF/CRLF/indented/wrapped transport, reject corruption, preserve002on rollback and install twice successfully.

Owner installed correctedV2. Independent existing-production verification PASS: all31migration versions match,9function bodies match after CRLF-to-LF canonicalization only,6tables retain ownerRLS/no authenticated direct writes, anonymous execution and private-helper public execution remain denied. Real normal owned-QA state returns confirmation1/openingSafety2; authoritative six-unit preview and anonymous denial PASS, five financial-table hashes unchanged. No additional SQL action is needed. The Codex management SQL connection remains read-only; installation used the owner's existing SQL Editor.

## Checks and limits

| Check | Result |
|---|---|
| Local726unit tests, ESLint, TypeScript, production PWA build | PASS |
| Final21focused Me UI regressions | PASS |
| Corrected-installer source c7deece Quality40189210392 | PASS: all7jobs, zero failure annotations;364browser,208UI,921pgTAP/20files,15native properties/concurrency/history,16Travel,10CollectPay |
| Current-head d2ced1c Quality40189904679 | PASS: all7jobs; one initial15s account-bootstrap readiness timeout annotation in complete browser job, which subsequently succeeds. Not a zero-retry claim |
| Production31migration/9body/RLS/grants and normal-session preview | PASS, no financial writes |
| Production actual Fresh Start/Reset | NOT RUN intentionally; real commit/rollback/shared/native preservation verified in disposable CI |
| Physical Honor, native keyboard and browser UI zoom | NOT RUN;320/360/390/430 and125/150/200%root-text tests are simulations |
| Local Supabase Docker | BLOCKED by previously observed vfs capacity; unchanged failure not retried. Real backend checks use disposable CI |

A first external live check assumed all six existing QA account units had known balances. Continue correctly stayed disabled for one unknown unit; ten financial hashes remained unchanged. This is recorded as an unsuccessful automation attempt, not a passing confirmation journey. Final confirmation checks use another existing permanent owned QA account with no account units; no balance is fabricated and no financial guard is relaxed. Actual native-account apply behavior remains covered by isolated backend tests, not a production Reset claim.

## Deployment and evidence

Existing project tabby-tally, team monowanderer373s-projects. Native production READY `dpl_9XrTYgeJbjzteaaKkJi2ZWHUY4Fu`, application commit `8e97c6d127c4db2dd260370e5d69cbed07bb98ea`. Canonical URL: https://tabby-tally-monowanderer373s-projects.vercel.app/ . Public entry index-BIh5n92o.js contains the exact commit; ProfilePage-C3Z99Uou and current routes are precached.

Final native authenticated checks PASS with no API interception: existing permanent owned-QA session, genuine preview/opening review, enabled Yes with no Google/password/second checkbox, reload disables Yes until renewed opening review, Cancel returns to Me, zero extra auth requests/financial mutation RPCs/runtime errors. Eight viewport/root-text combinations (320/360/390/430 ×100/200%) have no horizontal overflow and at least44px primary target. Ten financial-table hashes and personal-period state are unchanged. No customer account was touched and no private screenshot was taken.

Retained PWA activated/current entry/Profile/Home/Records/Accounts/Shared chunks PASS without clearing static caches. Five Insights material hashes match source, four Home/QuickAdd materials work offline and match source. Public signed-out Records guards PASS at all four widths and remain guarded in the updated offline shell. Immediate automatic-update timing and physical-device behavior are not claimed. Safe screenshot gallery: /workspace/verification/fresh-start-confirmation-2026-10-25/delivery/index.html. Six unedited actual React-component screenshots use synthetic API data, not private production screenshots or physical-device captures. Google-session UI fixtures do not claim a real Google platform sign-in. Private account identities, credentials, raw financial rows, logs and browser profiles are excluded from delivery.

A final documentation-only checkpoint may follow. Its actual native deployment/current public SHA/cache proof is saved externally in delivery-final.json to avoid a self-referential documentation/deployment loop. Main repeat CI is independently observed; previous successful source checks are identified above rather than presented as a new run.

## Changed files

- src/components/me/FreshStart.tsx
- src/lib/personalPeriods.ts
- src/lib/personalPeriods.test.ts
- supabase/migrations/202610250003_personal_period_session_confirmation.sql
- supabase/tests/personal_ledger_periods.sql
- scripts/generate-personal-confirmation-apply.py
- scripts/verify-personal-confirmation-transport.py
- docs/runbooks/personal-confirmation-production-apply.sql
- e2e/me-v2-ui.spec.ts
- e2e/me-v2-backend.spec.ts
- .github/workflows/quality.yml
- docs/adr/0011-personal-reporting-periods.md
- docs/PROJECT_STATUS.md
- docs/WORK_LOG.md
- docs/FRESH_START_CONFIRMATION_IMPLEMENTATION_REPORT.md
