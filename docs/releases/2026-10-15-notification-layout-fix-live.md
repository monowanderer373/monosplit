# Notification layout repair — production release, 2026-10-15

The user-reported vertical text was reproduced and fixed in the existing application. No financial model, actions, schema, RLS, identity, dependencies or ordinary editor changed.

## Root cause and repair
The actual production module graph (VITE_HOME_VISUAL=0) loaded old home.css after Notifications A. Its three-track grid overrode the new four-track grid, while the unread pseudo marker remained a fourth grid item. The icon occupied the flexible column and the text landed in the16px arrow column; short Food rows grew to about600px high. The harness changed chunk ordering, so previous checks loaded these rules in the opposite order and missed the bug.

Notification-only row/tab/copy/dialog overrides now win regardless of route stylesheet insertion order. The audit also reproduced incorrect form spacing (16px instead of approved12px) and scoped inner form/type/meta/context styles. The fixed short row has259px text and64px height. The actual centered dialog retains342px width,20px padding and14px radius.

## Changed files
- src/components/home/notifications-a.css: scoped component cascade repair.
- e2e/home-notifications.spec.ts: readable copy-width assertions supplement overflow checks.
- e2e/notification-row-layout.spec.ts: short Food/linked-account rows, dialog geometry/form gap, Activity and zero navigation writes.
- playwright.production-ui.config.ts and .github/workflows/quality.yml: additional actual production-graph job. Existing harness/browser/device configuration retained.
- PROJECT_STATUS, WORK_LOG and release documentation; earlier release explicitly links this correction.

## Git and production
- PR [23](https://github.com/monowanderer373/monosplit/pull/23), MERGED; branch fix/notifications-row-layout.
- Validated source e979882c0f375dcedc84537f486ec8e91a75e6da.
- Application main4bbf391eebc3412be266173af27f00596715a024; source/main exact tree diff empty.
- Existing tabby-tally / monowanderer373s-projects production READY: dpl_3Lykq3E8o9AcLWyTRNt6WNtBigMz.
- https://tabby-tally-monowanderer373s-projects.vercel.app/ actual index-BNS4LVQF.js contains full4bb SHA; Records SpendingRecordsPage-Ddgybp_l.js precached.
- Exact-source [Quality38762126611](https://github.com/monowanderer373/monosplit/actions/runs/38762126611): all seven jobs SUCCESS. Main auto-recheck38763748490 is separate; source/main tree equality is independently checked.

A documentation-only checkpoint follows this verified application release. Its final existing production READY/currentSHA/public bundle/readonly normal-login/PWA readback is recorded in the delivered final-release-evidence.json. Runtime, test and migration trees remain identical; this avoids recursive documentation-only releases.

## Current validation

| Check | Result | Evidence |
| --- | --- | --- |
| Pre-fix reproduction | FAIL as expected | actual production graph16px copy/~600px row; form gap16vs12 independently reproduced |
| Units | PASS |604 tests/91 files locally and exact-source app CI |
| ESLint, TypeScript, production PWA build | PASS | current local checks and exact-source app CI |
| Production-graph notification browser tests | PASS |79/79,2.4min locally,0 retries/skips; additional CI job SUCCESS |
| Harness-enabled same scenarios | PASS |79/79,2.8min locally,0 retries/skips; fixed Food PNG SHA256 and geometry identical across both graphs |
| Backend disposable CI | PASS |742 pgTAP/18 files, DB lint/concurrency and historical upgrade; no production database reset |
| Collect/Pay, Travel/QuickAdd/Trip | PASS | exact CI dedicated10 and16 cases; full browser job SUCCESS |
| Normal owned production QA | PASS | no intercepted API:32 list geometry combinations, completed target no old action, exact open request/original destination focused,0 financial navigation writes/0 runtime errors |
| Retained PWA and public pages | PASS | existing worker updated/activated, actual current entry+Records cached; five stable material hashes equal source;320/360/390/430 signed-out guards and offline Records shell |
| Local Supabase | BLOCKED / not retried | known Docker vfs capacity restriction; existing disposable GitHub Actions tested backend |
| Physical Honor/OS keyboard/system fonts/browser UI zoom | NOT RUN | viewport/root text/safe-area/height simulations do not establish real device behavior |

Coverage includes320/360/390/430 CSSpx,100/125/150/200% root text, long names/amounts, all task/detail/state screens, conceal, keyboard/touch/simulated height/safe inset, original versioned actions/return/outbox reconciliation. Detailed full-CI browser retry/per-case distribution was not independently observed: combined CLI logs repeat another job's summary, so no count is inferred from it. Local79+79 zero retries/skips are observed.

The live checks used existing strictly tagged owned QA principals and preserved their immutable financial facts. They did not repeat the previous release's financial writes, manufacture pending Food tasks or access customer accounts. Comprehensive task states/actions are isolated application tests; this CSS repair does not claim every branch was freshly written on production. QA sessions were logged out and client authentication cleared.

## Evidence and remaining actions
Gallery /workspace/verification/notifications-layout-fix/index.html separates controlled Food reproduction from normal live QA. before/after metrics, build-graph proof, actual component PNGs,32 live geometry combinations and safe aggregate release metadata are delivered separately. Before Food facts have no selected account; after Food facts also verify linked-account amount-entry behavior. These fixtures never enter production fallback.

Fresh correct-project Vercel connection and26/26 remote migrations matched. No SQL, secret sharing, environment settings changes or user action is required. Physical-device validation remains unperformed.
