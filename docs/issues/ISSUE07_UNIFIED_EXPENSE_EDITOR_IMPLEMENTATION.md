# Issue07 — Unified Trip expense editor

Implementation candidate on `feat/unified-trip-expense-editor`, draft PR #48. This document is a recovery checkpoint, not a production completion claim.

The approved Issue07 handoff is the source of requirements. All 24 manifest entries were checked, all specifications and the three approved/product component boards read. Existing React/TypeScript/Vite, identities, integer money, financial history and Issue01–06 remain.

## Application and financial integration

- One fullscreen controlled draft with terracotta editable amount, original note/category/date, private account candidate, independent payers/consumers, Equally/Amounts/By item, one Save and separate original cancellation. No Trip editor Apply split, nested Split modal or editor History. Existing Quick Add Split and Group/Direct flows remain.
- New self-only Trip captures reuse canonical `personal` expenses and owner-private `personal_expense_affiliations.trip_id`; existing Space records remain Shared, including legacy self-only/zero-balance bills. Old label-only affiliations are not guessed into same-named Trips.
- New editor RPC composes original financial replacement/correction/metadata/cancel/defer helpers inside one transaction. Request receipt and expected versions protect retries. Unknown responses use the original transactional money-operation fence; browser recovery stores only request UUID and SHA256 fingerprint.
- Cross-audience corrections create a canonical successor and retain the original immutable predecessor. Original parent RLS protects private history and account journals. Shared-to-private requires owner confirmation, no other historic positive contributions/shares and no Trip settlement/reversal dependencies; the existing global balance write exclusion prevents a concurrent conversion from hiding a settlement.
- Posted funding stays on its original expense, is read through authorized lineage, and is never reposted or inferred from FX. Explicit pending account changes compose original cancel/defer commands; selecting a candidate never confirms cash. Only the current actor's unposted funding can follow a successor; another actor's private funding is not edited.
- My spending includes own linked private consumption plus own Shared shares. Shared trip total/count and Balances include only original Shared facts. Visible list includes own private plus authorized Shared, including zero-share bills; private period/archive filtering and pending outbox recovery remain. History/activity retain private RLS.
- Existing historical Shared read rights and Fresh Start protections for correction chains remain; current Trip membership does not grant private access. No financial formula, identity merge, dependency or deployed migration is rewritten.

## Mobile and accessibility

Fixed header/body/footer, native decimal editing without changing the raw input on focus, comma grouping in displayed money and original share/payer AmountInput, safe area and visualViewport handling. Only body scrolls, background navigation/+ is hidden and inert, dirty Back/Close is guarded, focus stays in the editor, disabled fieldsets are excluded from Tab navigation. Root font changes are simulations, not physical device/OS zoom evidence.

Browser tests reproduced and fixed translation-closure refetching, same-URL parent history reseeding during dirty Back, and focus-formatting selection loss. The existing navigation policy now checks actual browser overlay state before a stale parent effect can reseed history.

## Verification checkpoint

- Clean main baseline: 843 unit tests / 122 files PASS.
- Application candidate: 859 unit tests / 123 files PASS; additional capture/date/controller cases passed (29 affected tests). Lint, TypeScript and production PWA build passed at preceding checkpoints; exact final source must be checked again.
- Backend candidate `886367b`: 1,074 pgTAP checks / 23 files PASS, strict database lint and historical installer/replay PASS in disposable GitHub Actions. Current forward lock-order/event changes and new competing-session script require fresh exact-source CI.
- Original nine editor browser cases passed: four phone widths, 125/150/200% root text, preserved payer/consumers, dirty Back, conflict, private publication, uncertain-save reconciliation and readonly. Final expanded editor/overview run 21/21 PASS39.2s, including all12 editor cases; the privacy fixture now initializes hidden state consistently. Earlier failed runs are retained as failed evidence.
- Reference package 15 tests PASS, supplemental only.
- Docker vfs remains blocked locally; no repeated local pull/reset. Actual PostgreSQL/Supabase validation uses disposable Actions only.
- Physical Honor/iOS/Android keyboard, OS Back/zoom and screen reader NOT RUN.

## Rollout and recovery

`202610310001_unified_trip_expense_editor.sql` is the 34th forward migration. The generated `docs/runbooks/trip-editor-production-apply.sql` requires the exact existing 33-version baseline, checks complete canonical bytes and installed function hashes/privileges, and is transactional/repeatable. It installs capability; it does not execute an expense edit, Reset or cash posting. Historical CI replays old installers before the new one. Never reset a linked/shared database.

Fresh read-only provider verification: existing Supabase project has 33 migrations, last `202610280001`; existing Vercel production is READY at `e527b9bc1401e8f04e13301c105a5d60a1b4bd58`. Issue07 has not been installed or released to production. Complete exact-source CI before applying the new migration. If a supported writer is unavailable, present the fully tested complete SQL once; do not claim repository edits installed it.

Recovery: read PROJECT_STATUS/WORK_LOG/git diff, then `/workspace/verification/issue07-unified-editor-2026-10-31`. Preserve the working tree and PR. Finish final application/native tests, source commit/CI, provider migration verification, merge and existing-project production READY/SHA/PWA/normal-login verification. Do not replay customer or historical QA financial writes.
