# Issue07 — Unified Trip expense editor

Validated application source `3f229f1a9fbe50a236c0a8fee048a28516ecce61` / Quality41202531523 all eight jobs successful. Production schema installation is blocked by the actual read-only SQL connection. Implementation on `feat/unified-trip-expense-editor`, draft PR #48. This document is a recovery checkpoint, not a production completion claim.

The approved Issue07 handoff is the source of requirements. All 24 manifest entries were checked, all specifications and the three approved/product component boards read. Existing React/TypeScript/Vite, identities, integer money, financial history and Issue01–06 remain.

## Application and financial integration

- One fullscreen controlled draft with terracotta editable amount, original note/category/date, private account candidate, independent payers/consumers, Equally/Amounts/By item, one Save and separate original cancellation. No Trip editor Apply split, nested Split modal or editor History. Existing Quick Add Split and Group/Direct flows remain.
- New self-only Trip captures reuse canonical `personal` expenses and owner-private `personal_expense_affiliations.trip_id`; existing Space records remain Shared, including legacy self-only/zero-balance bills. Old label-only affiliations are not guessed into same-named Trips.
- New editor RPC composes original financial replacement/correction/metadata/cancel/defer helpers inside one transaction. Request receipt and expected versions protect retries. Unknown responses use the original transactional money-operation fence; browser recovery stores only request UUID and SHA256 fingerprint.
- Cross-audience corrections create a canonical successor and retain the original immutable predecessor. Original parent RLS protects private history and account journals. Shared-to-private requires owner confirmation, no other historic positive contributions/shares and no Trip settlement/reversal dependencies; the existing global balance write exclusion prevents a concurrent conversion from hiding a settlement.
- Posted funding stays on its original expense, is read through authorized lineage, and is never reposted or inferred from FX. Explicit pending account changes compose original cancel/defer commands; explicit No account creates no new deduction candidate, while Verify later is distinct; selecting a candidate never confirms cash. Only the current actor's unposted funding can follow a successor; another actor's private funding is not edited.
- My spending includes own linked private consumption plus own Shared shares. Shared trip total/count and Balances include only original Shared facts. Visible list includes own private plus authorized Shared, including zero-share bills; private period/archive filtering and pending outbox recovery remain. History/activity retain private RLS.
- Existing historical Shared read rights and Fresh Start protections for correction chains remain; current Trip membership does not grant private access. No financial formula, identity merge, dependency or deployed migration is rewritten.

## Mobile and accessibility

Fixed header/body/footer, native decimal editing without changing the raw input on focus, comma grouping in displayed money and original share/payer AmountInput, safe area and visualViewport handling. Only body scrolls, background navigation/+ is hidden and inert, dirty Back/Close is guarded, focus stays in the editor, disabled fieldsets are excluded from Tab navigation. Root font changes are simulations, not physical device/OS zoom evidence.

Browser tests reproduced and fixed translation-closure refetching, same-URL parent history reseeding during dirty Back, and focus-formatting selection loss. The existing navigation policy now checks actual browser overlay state before a stale parent effect can reseed history.

## Verification checkpoint (2026-10-31 UTC)

| Check | Current evidence | Result |
|---|---|---|
| Unit | 866 tests / 124 files, 38.36s; focused recovery/controller/pagination13/13 | PASS |
| ESLint / TypeScript | Actual application, including reload recovery; latest visual build also checks TypeScript | PASS |
| Production build / PWA | 130 precache entries; no dependency/lockfile changes | PASS |
| Actual editor React / CSS | 18 Pixel-touch production-graph browser cases, final51.8s | PASS |
| Native SQL / strict lint / concurrence | Source275d79c,1081 pgTAP /23files, original locks/competing UUIDs/no cash repost; same migration as final visual patch | PASS |
| Historical upgrade | Source275d79c old installers then new complete installer twice | PASS |
| Full authenticated/browser regressions | Quality41201783844 still running at checkpoint; the final component/count revision gets its own exact-source Quality run | PENDING |
| Reference package | 15 supplemental tests; not application/RLS proof | PASS |
| Local disposable Supabase | Known Docker vfs capacity failure, not retried | BLOCKED |
| Production schema / release | Actual33versions; new34th not installed, existing READYe527b9b | BLOCKED |
| Physical Honor / OS keyboard, Back, zoom / screen reader | No physical-device execution available | NOT RUN |

Browser coverage includes320/360/390/430 CSS px,125/150/200% root fonts, normal390 two-member fit, large VND/safe integer, long names, short keyboard-like viewport, focus/inert/disabled items/reduced motion, hidden amounts, Equally/Amounts/By item, original payer/consumer preservation, dirty Back, version conflict with retained draft, one Save, explicit No account versus Verify later, private conversion refusal and Keep shared, and unknown-response receipt checks after readonly/source correction/reload. These are actual application components with intercepted synthetic transport; they do not prove backend authority. The separate disposable native A/B/O/X/RLS/transactional suite does.

Failed attempts are retained honestly: initial PLpgSQL grammar/shadowing, balance-lock ordering, touch focus, old scoped count assertions, old native RPC interception and a test-only wrong journal owner column. Financial assertions and the original native180s timeout were not weakened. Full browser also reported original QuickAdd Back/Forward failure; final exact-source results must resolve it before release. Native Travel then caught a real list-count mismatch; the toolbar now counts the complete visible private+Shared list, while Shared summary/count remains Shared-only. The new mixed-list regression verifies count, rendered rows and own spending together.

## Design comparison and acceptance

Safe comparison gallery (approved references versus actual390×864 captures, plus four200% font widths):
`/workspace/verification/issue07-unified-editor-2026-10-31/delivery/index.html`.

The latest component pass adds explicit lock/Shared icons, a single-payer avatar and visible square checked consumer controls, with scoped CSS only. All18 browser cases pass after this pass. Native date formatting/icon differs by browser; actual canonical participant order and synthetic test names/dates/amounts differ from the reference sample. Disabled Save is intentionally faded until there is a valid change. Pure paper/denim colors follow the written spec rather than generated-image gradients. Close is immediate; entry/inline expansion honor reduced motion. No physical-device fidelity claim.

Privacy/financial acceptance requires original parent RLS at every entry, account owner-only projection, private predecessor confidentiality, explicit-audience transitions, versioned atomic correction, blocked settlement/reversal/pending-request conversion and original funding ancestry. SQL and the new real authenticated browser case cover A/B/O/X and150/250/0 versus Shared100. Historical Shared read rights are intentionally preserved; membership does not grant private access. Existing Fresh Start protection for correction chains remains. Old label-only private affiliations are not guessed into Trips, and Shared-to-private conservatively rejects any Trip settlement fact. These are deliberate compatibility/security limits, not silent reclassification or rewritten accounting.

## Final exact-source results

Quality41202531523 on3f229f1a9fbe50a236c0a8fee048a28516ecce61: all8SUCCESS.866units/124files, ESLint/TypeScript/PWA build,1081pgTAP/23files/strictlint/concurrence/history;480fullbrowser,317productionUI,17Travel and12nativeTrip/multiuser (each0unexpected/flaky/skipped). CollectPay jobSUCCESS; no unavailable per-case count claimed. Local18editor+2supplemental actual application UI checks passed. The earlier table is a timestamped pre-final checkpoint; these exact-source results supersede its pending CI entry. The original QuickAdd native regression now passes; supplemental multi-member verification respects its existing consumer-removal confirmation.

Fresh provider SQL is still33versions/read-only, original242functions/ACL baseline unchanged. Full safe report, current CI JSON and approved/actual comparison: `/workspace/verification/issue07-unified-editor-2026-10-31/delivery/`. Production Issue07/PWA verification remains NOT RUN until installation/release, not inferred from CI.

## Rollout and recovery

`202610310001_unified_trip_expense_editor.sql` is the 34th forward migration. The generated `docs/runbooks/trip-editor-production-apply.sql` requires the exact existing 33-version baseline, checks complete canonical bytes and installed function hashes/privileges, and is transactional/repeatable. It installs capability; it does not execute an expense edit, Reset or cash posting. Historical CI replays old installers before the new one. Never reset a linked/shared database.

Fresh read-only provider verification: existing Supabase project has 33 migrations, last `202610280001`; existing Vercel production is READY at `e527b9bc1401e8f04e13301c105a5d60a1b4bd58`. Issue07 has not been installed or released to production. Complete final exact-source CI before applying the new migration. The companion runbook is `docs/runbooks/trip-editor-sql-editor.md`; final external CI/installation evidence is recorded alongside the safe gallery. If a supported writer is unavailable, present the fully tested complete SQL once; do not claim repository edits installed it.

Recovery: read PROJECT_STATUS/WORK_LOG/git diff, then `/workspace/verification/issue07-unified-editor-2026-10-31`. Preserve the working tree and PR. Finish final application/native tests, source commit/CI, provider migration verification, merge and existing-project production READY/SHA/PWA/normal-login verification. Do not replay customer or historical QA financial writes.
