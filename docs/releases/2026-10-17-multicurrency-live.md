# MultiCurrency — production release / 2026-10-17 MYT

Multi-currency accounts, actual payment sources and recorded money movements are live in the existing Tabby Tally application. A foreign purchase can be saved while its actual charge is unknown; it does not deduct a reference estimate. Later confirmation posts one atomic, explicitly confirmed native-currency source bundle. Existing account IDs/defaults, participants, canonical financial history, original journals, RLS and transactional/versioned/idempotent commands remain authoritative.

## Delivered

- Explicit parent/native currency units, honest unknown balances, grouped available money and display-only shared Frankfurter references. Additional currency and observed-balance controls preserve old transactions and require captured-entry/late-payment coverage.
- Original Quick Add calculator/context/date/wallet/Save & next/Save & close retained; actual/deferred and multiple sources added. Changing the owner-paid amount invalidates its previous whole-payment attestation while keeping the typed actual charge.
- Account-grouped current reminders, compact original-payment record rows, 0/1/N resolver and authoritative Confirm & next/finish. Synchronous source-revision gating prevents stale financial controls being enabled before passive refresh effects. Existing repaired notification CSS remains intact.
- Actual transfer/exchange/withdrawal, independent source/net amounts, included/separate fees, later classification without another cash debit, linked movement/fee/original history. No FX-derived actual postings or new shared ledger.
- Identity-scoped opaque request recovery, locked original receipt/absent-request fences, private in-memory drafts, current native versions/anchor choices, financial conceal including free-text/ARIA, and existing offline outbox safety.

## GitHub, database and production

PR [24](https://github.com/monowanderer373/monosplit/pull/24) merged tested source `418991c8e4de3c6f66f693020530f5c3200cdedd` into feature main `242d897b4c96b54e8170df9f0d014befe183399e`; exact trees are equal. Existing project `tabby-tally` / `monowanderer373s-projects` production deployment `dpl_HBY3xQhyzX6ie37AcSCSQ3aKygtN` reached READY, and the canonical site's real entry contains the main SHA.

Live: https://tabby-tally-monowanderer373s-projects.vercel.app/
Deployment: https://tabby-tally-mtsx8g3wv-monowanderer373s-projects.vercel.app/

Existing Supabase `skiqsxvmxvmxfzhrzcxh` has28exact source migration versions including20261016130602/20261016132156. Owner installed the complete pinned7ec2252 script,79429bytes/SHA256`6694a088e6332f7d5258f954271c97bc06eb081bc247a17c4808c1c4d0d38364`; independent32-function normalized source/body hash matching, grants/anonymous denial and normal owner/other RLS checks passed. No further SQL execution is needed. No production/shared reset, replacement project, historical migration edit, forced push or customer-ledger QA.

This report is a subsequent documentation checkpoint. Its automatic deployment may have a later SHA than the financially exercised feature commit above. Re-read actual current main/READY/public bundle/PWA after publishing; the final delivery evidence records that later state. Documentation changes do not install database functions or change the validated application source.

## Validation

| Result | Check | Current evidence |
| --- | --- | --- |
| PASS | Final PR CI | Quality39020695140, all7jobs |
| PASS | Feature-main CI | Quality39021545025, all7jobs |
| PASS | Unit / type / lint / production PWA build |637Vitest,95files; TypeScript,ESLint and build |
| PASS | Real disposable database |862pgTAP/19files, DB lint; original CollectPay exclusion and4actual overlapping funding/fence races with observed advisory wait |
| PASS | Compatibility/upgrade | Historical fixture upgrade and entire generated production SQL applied twice |
| PASS | Complete browser task |265passed check-run notice (8.3m), including normal isolated authenticated financial journeys; no unobserved retry/skip distribution claim |
| PASS | Actual production module graph |114local/114CI; includes prior notification layout and all currency/form/authority cases |
| PASS | CollectPay / Travel |10/16; original Quick Add/Trip period regression retained |
| PASS | Component comparison |7supplemental real-component journeys,20design/application pairs,35approved scenes |
| PASS | Normal live financial QA | Controlled owned accounts, normal login/API, no intercepted responses; checkpointed actual single/multi-source, four movements, fee/no-double-debit, observed/late coverage and immutable original facts |
| PASS | Normal live records/FX/privacy |16width/root-font combinations, account-scoped older-day records,7actual canonical records/native totals, rational VND→MYR and chart reconciliation, original editor Escape, Month/Scope/Trend/scroll and pinned-FX return, other identity denied; final session0runtimeerrors |
| PASS | Production daily FX task |17Oct09:10UTC/17:10MYT succeeded, active daily10 9, failureNULL;12quotes, source rateDate16Oct/fetched17Oct |
| PASS | Retained PWA/public/offline | Activated controller, exact entry/Records/Accounts cached,5material SHA256s source-equal;320/360/390/430signed-out guards and offline Records shell |
| PASS | Client credentials boundary |64public application chunks checked; service-role key absent |
| BLOCKED | Local Supabase Docker | Existing vfs/capacity limitation; unchanged risky pull/start/reset/prune avoided; real backend validation used disposable CI |
| NOT RUN | Physical device/native OS | Honor hardware, native keyboard/system font/browser UI zoom; root-font/viewport/height/safe-inset simulations are distinct |

Normal production validation uses strictly owned QA identities and preserves their immutable checkpointed facts. It does not certify every customer's private writes or repeat destructive concurrency/correction scenarios on production; those run in the disposable backend suite. Initial live harness assumptions about an optional empty-history selector, whole-day pagination and local5s versus remote readiness were corrected without production source changes; final staged assertions passed.

## Screenshots and recovery

Actual browser screenshots render native React/CSS/SVG, not flattened approved images. The comparison gallery at `/workspace/verification/multicurrency/comparison/index.html` includes20pairs,35approved scenes and untouched synthetic-contract UI captures. It deliberately retains the original calculator/navigation, wraps long names/values, scrolls long forms and adds actual coverage/attestation/recovery controls beyond illustrative data. Design amounts/dates/rates never become production fallback. Private production screenshots, account IDs, auth credentials/profiles and raw logs are excluded from the delivery archive.

Source/spec/56-case map: [implementation](../multicurrency/IMPLEMENTATION.md). Financial compatibility decisions: [ADR0010](../adr/0010-multicurrency-account-units-and-funding-bundles.md). Resume [PROJECT_STATUS](../PROJECT_STATUS.md) and recent [WORK_LOG](../WORK_LOG.md), then read actual git status/diff/current main/deployment and migration history. Preserve private owned-QA request/fact checkpoints; never reseed/reset to repeat a completed stage. No additional user action is required for this release.
