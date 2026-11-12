# Settle Up member repayment UI — 2026-11-12 UTC

Trip → Settle up → Record payment for members now guides an authorized creator or delegate through choosing members, entering actual money, and reviewing. Choosing a visible outstanding item fills only payer, recipient and native currency. Actual paid money starts blank. Review can add another repayment while retaining previous rows and requiring a fresh review and attestation before the single atomic posting.

PR62 / validated application `0ceec063bde1f8da4c11696ad65b50c9c70316c6`; Quality `43221323348` all8SUCCESS. Application merge `bfd2a7fbb8b8c691d20ed51984546b8e028a4a80` has the identical full tree. Subsequent completion commits change documentation only; the delivery checks record the actual final served commit independently.

## Implementation

- `CreatorMemberPairPicker`: equal 52px controls in two columns at320–430px; mutually exclusive full-width in-flow light menu, dark text, visible outline, member avatars/failure initials, ellipsis, full accessible names, selected checks and restored focus. Escape first closes the menu.
- `CreatorRepaymentForm`: actual native amount and currency together; optional method, intermediary/native reduction, date, note, system/custom quote and actor-owned account controls. `AmountInput` honors an explicitly requested inputMode while preserving its decimal default and parser behavior.
- `TripCreatorSettlement`: choose/amount/review stages, add-another invalidation, preserved existing rows, stale quote/expiry gates and existing actor-bound uncertain-request recovery. Scoped paper colors and clipping keep header/footer in the usable viewport, including short viewport/reduced-motion checks. New text uses the existing English/Chinese dictionary.
- `TripLedger`: supplies only its existing authorized native debt derivation. No extra private or cross-Trip reads, demo names/balances, or client-side source-of-truth arithmetic.
- No migration or financial service changes. Existing creator policy/delegation, multi-recipient/MixedFX/route-first coverage, holder-only private accounts, atomic recording/outbox, notice deep links, correction and whole reversal remain. Ordinary single/batch/routed and Issue01–08 flows are preserved. No production financial QA writes or SQL reinstallation.

## Validation

| Check | Actual result |
| --- | --- |
| Handoff Node24 reference tests | 35PASS |
| Node22 repository units | 918PASS /130files |
| Lint / TypeScript / production PWA build | PASS |
| Targeted local mobile production graph | 65 unique scenarios PASS: creator15, batch18, routed12, Issue08single/account20 |
| Final creator source0cee mobile rerun | 15PASS; additional paint/geometry diagnostics PASS |
| Targeted real PostgreSQL | 296PASS: creator79/routed67/batch82/Issue08 68 |
| Real creator concurrency | All5 scenarios PASS |
| Installed upgrade/replay DB audit | Exact migration history,47bodies/ACLs, RLS/private tables/notice policy/worker/realtime/STABLE normalizer PASS |
| Hosted full database | 1377PASS /27files, all10 concurrency scripts, strictSQLlint and historical install/upgrade/replay PASS |
| Hosted production module graph | 398PASS,0unexpected/flaky/skipped |
| Hosted complete browser suite | 566PASS,0unexpected/flaky/skipped |
| Hosted real Supabase browser / Travel / CollectPay | 17/17/10PASS,0unexpected/flaky/skipped |

Earlier f463's full suite had563 direct passes and3 retry passes, all initial failures waiting15s for home-header after account/login setup. Preserve that evidence. No relevant assertion, timeout or unrelated product code was loosened; final0cee executed the original complete suite with0retry flakes. Initial handoff selector/recovery-screen failures and portable-plus font fix are recorded in WORK_LOG.

## Publication and remaining limits

The existing GitHub/Vercel Production integration reported success for deployment7738159213 at applicationmergebfd2a7f. The canonical site compiled the matching source with entryindex-jXfWmS6v.js;102manifest JS/CSS, new member flow, all original creator/routed/batch/account/QuickSplit and currency-alignment markers passed. Public320/390/430 had no overflow, page errors or automatic authentication.

A clean public retained profile was warmed at actualpreviousd6 before merging. First normal update/close/reopen activated and cached new resources but timed out on the old document. The unchanged second normal cycle passed the current entry plus5moduleassets, service-worker control and offline public shell, without deleting static caches. Completion doc-build source is checked again independently.

Fresh management APIs returned Supabase401invalidtoken and Vercel403teamscope. No credentials/network settings were changed. This UI-only release needed no schema operation; native GitHub deployment status plus canonical compiled source/PWA provide publication evidence. Do not claim a fresh production function-body audit from this task. The independent installed local upgrade audit and actual hosted financial tests passed.

Delivery: `/workspace/artifacts/settle-up-ui/index.html` and `REPORT.md`.15mobile images use final0cee actual production build with isolated synthetic SDK responses.4supplemental real-backend images use earlierf463 (only the two decorative plus characters differ). Final0cee real-backend17tests passed, but its artifact/log storagehostproductionresultssa12 was denied by network policy. Both sources are explicitly labeled. Physical Honor Magic7Pro and its OS keyboard were not tested; mobile/dark/short viewport/keyboard-space checks are Chromium emulation.
