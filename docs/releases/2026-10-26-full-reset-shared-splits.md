# Full Reset clears old Split — implementation and rollout

Status: application implemented; final isolated CI passed. Production
schema installation and application release have not happened. This document
is a checkpoint, not a live-completion claim.

## Resulting behavior

A newly confirmed full Reset clears old amounts owed in both directions from
the current shared relationship. The resetting user's current records start
fresh; other affected users retain the original bills. They can remove their
own cleared record or explicitly re-tag the resetting participant. Reset sends
no notification. A later re-tag requires recipient acceptance through the
existing compact notification dialog; pending or declined requests create no
debt. Removal never deletes somebody else's bill or hides active debt.

Original purchases, participant UUIDs, accepted payments and actual bank
entries remain immutable. Previously paid portions cannot be collected again;
re-tag restores only eligible unpaid amounts and does not create another
purchase or cash deduction. A third person's separate edge in a Group/Trip
bill is not reassigned or cleared. Multi-currency values remain native integer
minor units; reference FX never posts money.

Old pending shared payment authorizations cannot charge after Reset or lock a
future opening review. Legitimate new settlements and actual cash reversals
continue through the original procedures. Old personal cash activity is period
archived without changing balances. Later actual funding of an archived bill
remains new-period cash activity, not duplicate spending. Recurring bills,
instalments and private pending deductions continue their original workflows.

This follows the user's explicit revised Reset policy and supersedes the old
personal-only policy. Installing the schema alone does not perform a Reset;
previously completed personal-only resets are not silently upgraded.

## Implementation

- Forward `202610260001_shared_restart.sql`: seven metadata tables with RLS,
  versioned/idempotent V2 wrapper around the original atomic period/native
  opening transaction, current obligation/transfer exclusions, protected
  original-bill re-tag and caller-only dismissal. Old 001/002/003 stay frozen.
- Event-time unpaid attribution retains original selected-bill intent and
  actual transfer order. A later re-tag cannot steal an earlier payment from
  an already paid new bill. Correction descendants preserve paid amounts;
  pending source versions, live membership, permissions and consent are checked.
- `sharedRestart` service/parser and `SharedRestartActions`: strict integer
  handling, frozen owner session per dispatch, stable operation IDs, compact
  paper dialogs, privacy reveal and double-submit protection.
- Existing ledger/settlement repositories, current Shared/Person/Space/
  CollectPay/Home/notifications/personal-period adapters consume the same
  release facts. Financial formula, original pairing and posting RPCs remain.
- Final Reset warning explains both-direction clearing, retained counterpart
  bills and no Reset notice. Original opening review, same-user session,
  stale-preview detection and interrupted-request reconciliation remain.
- Schema-only installer, workflow historical installation/concurrency checks,
  SQL regression suite and actual two-user browser journey added. No new app,
  production project, dependency, demo fallback or relaxed original RLS.

## Verification

Baseline: 726 unit tests and lint PASS. Current local: 732 unit tests, lint,
TypeScript and production PWA build PASS; serialized 21 Me tests and five
new re-tag tests PASS (combined 26 cases, 38.4 seconds). SQL and embedded PL/pgSQL
syntax parsing PASS. An overlapping local build caused one initial recovery
test failure; the unchanged test passed in the serialized run.

Latest source `bac7e8082cb937db8d5ff77c430032c03a4a6549`,
[Quality 40298736067](https://github.com/monowanderer373/monosplit/actions/runs/40298736067):

| Check | Current result |
| --- | --- |
| Application units/lint/typecheck/build/audit | PASS |
| Strict database lint and pgTAP | PASS, 974 assertions / 21 files |
| Original + V2 native opening/concurrency | PASS, 15 deterministic samples each |
| Historical upgrade / complete installer twice | PASS |
| Production module UI | PASS, 213 cases |
| Collect/Pay browser | PASS, 10 cases |
| Travel browser | PASS, 16 cases |
| Full authenticated browser / real two-user Reset + native settlement | PASS, final browser job succeeded |
| Hosted schema install / authenticated capability | BLOCKED, writer unavailable |
| New production deployment / live full-Reset regression | NOT RUN |
| Physical Honor / OS keyboard / actual browser UI zoom | NOT RUN |

All seven jobs finished SUCCESS. Chromium installation stalled before tests on
the first browser attempt; only that job was cancelled/retried. The final
browser job has one initial legacy Phase 5C person-card readiness timeout
annotation and succeeded under the existing retry policy, with no weakened
assertions. Raw full-browser artifact retrieval returned HTTP 403; detailed
per-case/retry counts are not independently claimed.

Four real React synthetic screenshots cover 320/360/390/430 CSS px. UI checks
also cover 125/150/200% root text, long amounts, masking/reveal and one-RPC
double acceptance. These are browser simulations, not physical-device evidence.
No private production screenshots or customer financial test writes were used.
Local Docker's known vfs capacity blocker was not retried; actual backend
verification uses disposable isolated GitHub runners.

## Rollout and recovery

[PR #39](https://github.com/monowanderer373/monosplit/pull/39), branch
`feat/reset-shared-splits`. Production/main remains
`f6433971419e04166636899ebec64839cb82f099`; hosted database remains 31 migrations.
Current management SQL role is read-only. The complete installer is 84,471
bytes, SHA-256 `09b232e808dbbac7ce14a24b6197dbeddbb2b9dc656954236dd01006d647d884`;
the pinned source download was independently HTTP 200 and byte-identical.
Follow the
[concrete installation runbook](../runbooks/shared-restart-sql-editor.md),
independently verify the install, then merge/deploy and verify native READY,
exact public SHA, ordinary owned QA preview/Cancel and PWA update.

Existing URL: https://tabby-tally-monowanderer373s-projects.vercel.app/ . No new
deployment ID exists for this feature yet. No production Reset will be used
for verification. A schema-only ten-function source snapshot is not a full
database backup; provider snapshots/PITR remain unavailable as documented.
After a committed full Reset, preserve metadata and forward-fix; never roll
back filters in a way that resurrects debt.

External recovery/evidence: `/workspace/verification/shared-reset-2026-10-26`.
Read PROJECT_STATUS, WORK_LOG, this report and current git/provider evidence
after interruption. Do not replay a committed Reset or old financial fixtures.
