# Home startup / Collect-Pay performance — 2026-10-17

The user's private 51.47s recording shows a long Home skeleton, full-page Collect/Pay waits and repeated Home loading after return. Reviewed privately; recording frames, account amounts and private screenshots are excluded from release evidence.

PR [26](https://github.com/monowanderer373/monosplit/pull/26) merged. Validated source `e41d0f11fbe96fa76b9a53d87ed7d7fd6b49f3fe`; feature production/main `cdb629b3673d60c32e584af50684673283f86390`, exact whole-tree equality verified. Later documentation-only checkpoints do not change application sources; read actual current main/provider/public entry before continuing.

## Confirmed causes and changes

- `useHomeData`: all five independent slices were withheld behind one `Promise.all`. Publish each guarded result immediately; preserve participant identity, obsolete-request cleanup, error/cache eviction and last-verified return display.
- `personalAccountReadRepository`: native accounts, movement history, funding/legs/bundles, activity and task queries waited sequentially. Start independent paginated reads together; transaction→entry chain begins independently of account metadata. Return the same complete account snapshot, rejecting the whole slice on a failed financial read. Pagination, exact amounts and original mappings retained.
- `notificationRepository` / `collectPayRepository`: fetched complete Home funding/journal/task history solely to use `accounts`. Reuse the existing authoritative native-account RPC directly. Existing notification funding/permission sources remain; Collect/Pay membership reads begin as soon as spaces resolve.
- `CollectPayController`: an ordinary initial read refreshed expenses a second time and cleared all verified Home data. Entry now reads its own current snapshot; explicit refresh and mutation callbacks still invalidate Home and reread ledger/current snapshot. Original financial preview/save/version/fingerprint/idempotency services unchanged.
- `usePersonalLedger`: startup called `refresh` and empty-outbox `flush`, whose final refresh duplicated expense loading. Skip startup flush only for an empty outbox; original nonempty reconciliation, dispatch, online/retry and uncertain-write behavior retained.

No theme/CSS, auth bootstrap, dependency, RLS, SQL/migration, money-model, historical principal or transactional mutation changes. No additional persistent private cache, estimated debit or production financial write introduced.

## Measured normal production QA

Canonical URL: https://tabby-tally-monowanderer373s-projects.vercel.app/

Same owned normal authenticated QA account, seven existing controlled expenses, one active Chromium tab, 390×844 CSS px, en-MY/Asia-Kuala-Lumpur. No API interception. Warm runs preserve the retained PWA/static caches; cold runs use a new HTTP/service-worker cache and restore the normal session in memory. This is not a new empty account or a physical phone benchmark.

Home readiness means a real balance is rendered and both shared summaries are ready; it does not mean every optional FX/notification/background request has completed. Return timing measures visible last-verified data; background rereads are timed separately.

| Stage | Before | After |
| --- | ---: | ---: |
| Signed-in warm Home critical content | 4.255–4.935s (3 runs) | 1.880–1.915s (2 runs) |
| Open Collect | 3.390–3.719s | 0.957–1.014s |
| Open Pay | 3.367–3.478s | 0.909–0.919s |
| Return Home: verified content visible | 3.344–3.447s | 0.056–0.080s |
| New static cache Home | 5.786s (1 run) | 3.450s (1 run) |
| API requests for reload + both destinations/returns | 177 each run | 124 each run |

After return, complete observed background API reads take 2.012–2.048s. The fast cached display is not a zero-latency authoritative reread. Subsequent financial actions retain the original fresh preview/authorization/version/RPC checks. Network/device/account size affect these small samples; no p95, large-history performance or universal five-second guarantee claimed.

Initial 12–15s QA observations restored 37 historical browser tabs and are excluded from comparisons. The extra tabs were closed before controlled measurements. The first post-release timing still ran the old PWA bundle, failed the exact-commit gate and is also excluded. The private user recording remains separate real-device evidence; its delays are not relabeled as QA measurements.

Every controlled before/after session had zero financial mutation RPCs and zero JavaScript runtime exceptions. Normal owner snapshots before/after are identical for all seven expenses, 21 entries, 17 transactions, four movements and five funding legs. No customer accounts/data or physical device accessed. Passwords/tokens/browser storage/private snapshots remain outside repository/delivery evidence; sessions logged out/auth cleared after checks.

## Current checks

- PASS: 642 Vitest tests / 96 files, ESLint, TypeScript, production/PWA build.
- PASS: 140 actual production-module browser contracts locally, including the two new performance contracts. Existing compact Home/mascot, notifications and multicurrency responsive/accessibility cases retained.
- PASS: deferred unrelated-trip regression fails before the fix and passes after; same-owner late error, identity switch, return failure, complete concurrent snapshot and empty-outbox tests pass.
- PASS: exact application source [Quality 39041293946](https://github.com/monowanderer373/monosplit/actions/runs/39041293946), all seven jobs. Current logs confirm 862 pgTAP checks / 19 files, database lint/concurrency, historical SQL upgrade/apply twice, dedicated Collect/Pay 10 and Travel 16. Full authenticated browser job succeeded; its raw isolated log host denied access, so no unobserved detailed case/retry/skip count claimed.
- Follow-up: merged-main production-ui found the new request-count test included a queued Home notification reread in the Collect/Pay phase (2 vs 1). Both normal-live runs independently show one expense read per Collect/Pay entry. Added a Home `networkidle` boundary before phase counting, retaining the strict one-read assertion and held-return gate; 24/24 repeated production-graph cases pass locally. Follow-up CI must confirm this test-only fix; the failure is not silently counted as a pass.
- Production Git-provider success: “Deployment has completed”, GitHub deployment `7141243203`, Vercel key `B3Du3CefFu7PtRGbWW8SzxRXrBJP`, URL https://tabby-tally-ilq7nnf04-monowanderer373s-projects.vercel.app/ . Canonical entry `index-SR0nM8QN.js` contains actual feature main; current Records/Accounts chunks are in the published worker.
- PWA: normal registration was observed reaching feature cdb629b, but a later documentation deployment remained on that older worker through repeated navigations. Native `registration.update()` then successfully installed/activated the new worker without deleting caches, with no worker errors. Do not claim immediate automatic update, forced page reload or that existing drafts are discarded. Existing PWA lifecycle is preserved in this scoped performance change; latest-version cache/offline evidence follows outside this report.
- Direct Vercel API credential currently returns 403 `invalidToken`. Existing Git integration publishes successfully and provider completion/public-bundle/live checks are verified; a raw native `readyState`/`READY` field is not directly observed. No generic deployment reauthorization or secret in chat needed. Refresh that binding securely only for future direct Vercel API operations.
- NOT RUN: physical Honor/other phone repeat, OS keyboard/font/browser UI zoom and large-history/load/p95 measurements. Viewport/text checks are browser simulations.
- BLOCKED locally: known Docker vfs capacity; not blindly retried. Current real backend checks passed on disposable GitHub Actions; production/shared DB never reset.

Persistent task state: `docs/PROJECT_STATUS.md`, `docs/WORK_LOG.md`. Safe current-run JSON/timings and synthetic UI captures are outside the repository under `/workspace/verification/startup-performance-2026-10-17`; exclude private files/profile/video and signed artifact URLs from any archive.
