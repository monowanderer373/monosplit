# Fresh Start — existing session confirmation

Status: implementation and all exact-source checks PASS; production BLOCKED on installation of new forward003. Existing production remains84f2540. This report is not a live-completion claim.

User revision2026-10-25 supersedes the earlier AMR/password/Google requirement. After native opening review, final confirmation is one warning with Yes/Cancel. No extra OAuth redirect, password, or second checkbox. Current signed-in permanent ownership, normal token validity, guest denial and RLS remain.

The screenshot error followed Google leaving the application: the previous policy intentionally discarded the reviewed in-memory openings. The revised flow stays in the application. Actual reload/Back still clears opening approval and exposes a direct review action; custom balances are never silently reused or persisted. Cancel performs no financial write. Unresolved request IDs still require authoritative reconciliation before another operation.

Forward003 replaces only apply_personal_fresh_start and get_personal_ledger_period_state. Comparison against002 proves the only apply changes are recent-AMR removal and authentication_method=session; state adds fresh_start_confirmation_version1. Atomic serialization, fingerprint, protected Shared/correction components, locked linked openings, original native balance RPCs, immutable history and replay/fencing remain exact. No table/RLS/identity/financial model changes.001/002 and the original60713-byteV2bundle are frozen and hash-equal.

Source56096dcf5899fc9bc2ea1617661b5af81a91febd / [PR38](https://github.com/monowanderer373/monosplit/pull/38). Quality40182992995 all seven SUCCESS with zero failure annotations:726units/lint/typecheck/PWA build;364authenticated browser;208production UI;921pgTAP/20files and15signed-native properties/concurrency; full historical patch twice;16Travel;10CollectPay. Final21Me local checks include existing email/Google API contract sessions, no interactive-auth requests, single/double click, Cancel, missing capability, reload/Back/recovery,320/360/390/430 and125/150/200%root text. Mocked Google UI is not a real Google platform login claim. Physical Honor/native keyboard/browser UI zoom NOTRUN.

Production SQL API was actually probed with read_onlyfalse and still reports supabase_read_only_user, transaction_read_onlyon and CREATEfalse. No alternate writable DB binding or callable connector exists. The exact30-version baseline and both deployed002function bodies were read back successfully. New003is still absent; installation was requested once after disposable SQL and historical tests passed. No generic development approval is missing.

## Corrected installer verified; operator execution pending

The initial13721-byte raw-DDL wrapper was rejected by its exact function-body check. Independent production readback confirms all30prior versions and both002function bodies remain;003rolled back. That old download is superseded.

The new17862-byte wrapper reconstructs the fixed UTF-8 migration from Base64 insideSQL, checks its payload hash beforeEXECUTE and retains exact body, permission and migration-history checks. Application and003migration contents are unchanged. Production read-only decoding matches canonical SHA15a8d0c43a5d21a5f87047794ca8ed090b802d81ae0f3a78737346cafed1820f. Readable migration source remains in supabase/migrations/202610250003_personal_period_session_confirmation.sql.

Disposable historical tests now reproduce the former raw-DDL indentation rejection, run LF/CRLF/indented/wrapped new scripts in rollback probes, reject corrupt payloads beforeDDL and install the canonical script twice. Corrected c7deece historical Quality40189210392 passed all those exact tests, including canonical install twice. Current921pgTAP/app/208productionUI/Travel/CollectPay pass; the duplicate full browser job is still running at this checkpoint. The former f439history failure was a test-only withheld-file path and stopped before transport checks; it is not a passing result. Use the complete [corrected V2 SQL](https://raw.githubusercontent.com/monowanderer373/monosplit/c7deece3cbe36b12e43e1a250b91dc9b88564307/docs/runbooks/personal-confirmation-production-apply.sql),17862bytes SHA7e5948fa8fdc295d9633e16689c7b9073e4d3d9e0d684d1a659f53d0c2e1bf1c. New marker: TABBY_FRESH_START_SESSION_CONFIRMATION_COMPLETE_20261025_V2. The script does not execute Reset, change balances or reinstall001/002; no secret is needed in chat.

After installation: independently verify31versions/9function hashes/RLS/grants; normal owned-QA capability1/safety2/preview with financial hashes unchanged; mergePR38; existing Vercel READY/exact public SHA; real logged-in confirmation-ready/reload/cancel/no-write checks and retained PWA. No production Reset is performed for QA. Scripts/checkpoints and six safe raw actual-component synthetic screenshots are under /workspace/verification/fresh-start-confirmation-2026-10-25. No private production screenshot or financial row is delivered.

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
