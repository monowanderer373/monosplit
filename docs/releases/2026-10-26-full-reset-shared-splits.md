# Full Reset clears old Split — implementation and rollout

Status: LIVE application published and authenticated read-only regressions verified,
2026-10-26 Asia/Bangkok. PR #39 merged; application main
`0c31226bad4f175427fb89001636d82e70f71ec6`, existing Vercel production READY
`dpl_CxXzVwqKLh136MCtJfq24eKUjDFY`. Final documentation-only deployment/SHA
readback is saved externally in `delivery-final.json`, avoiding a self-referential
commit loop. No production Reset or financial QA mutation was performed.

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

Final reviewed PR head `5a4c0d7ad82d0d7c8a2037f8118d9f086ac1663f`,
[Quality 40302777164](https://github.com/monowanderer373/monosplit/actions/runs/40302777164):
all seven jobs SUCCESS, zero failure annotations. Merged application tree is
identical to this reviewed head.

| Check | Current result |
| --- | --- |
| Application units/lint/typecheck/build/audit | PASS, 732 units |
| Strict database lint and pgTAP | PASS, 974 assertions / 21 files |
| Original + V2 native opening/concurrency | PASS, 15 deterministic samples each |
| Historical upgrade / complete installer twice | PASS |
| Production module UI | PASS, 213 cases |
| Collect/Pay browser | PASS, 10 cases |
| Travel browser | PASS, 16 cases |
| Full authenticated browser, including two-user Reset/re-tag/native settlement | PASS, 370 cases |
| Hosted schema, capabilities, computed fields, permissions and realtime bindings | PASS |
| Native production READY / exact public commit | PASS |
| Live normal owned-QA preview, confirmation warning, reload and Cancel | PASS, eight width/root-text cases |
| Ten owned-QA financial table hashes / period state before and after | PASS, unchanged; zero financial writes |
| Retained PWA current routes/materials and offline public Records guard | PASS |
| Actual production Reset/re-tag/settlement mutation | NOT RUN; write coverage is isolated backend CI |
| Physical Honor / OS keyboard / actual browser UI zoom | NOT RUN |

Earlier sourcebac7e80's first browser attempt stalled before tests installing
Chromium; a job-only retry passed with one initial legacy person-card timeout
annotation. The final reviewed head above then passed all seven jobs without
failure annotations. No assertions or timeouts were weakened. Raw browser
artifact download returned HTTP 403; the 370 passing count is independently
observed in the final job annotation, not an invented artifact/per-case count.

Four real React synthetic screenshots cover 320/360/390/430 CSS px. UI checks
also cover 125/150/200% root text, long amounts, masking/reveal and one-RPC
double acceptance. These are browser simulations, not physical-device evidence.
No private production screenshots or customer financial test writes were used.
Local Docker's known vfs capacity blocker was not retried; actual backend
verification uses disposable isolated GitHub runners.

## Rollout and recovery

[PR #39](https://github.com/monowanderer373/monosplit/pull/39) is MERGED.
Feature branch was `feat/reset-shared-splits`; application main0c31226 has an
exact whole-tree match with reviewed5a4c0d7. Existing production URL:
https://tabby-tally-monowanderer373s-projects.vercel.app/ . Native READY above
and public entry `index-C_a0Kkv-.js` both identify the actual application commit.

The owner installed the complete 84,471-byte schema-only installer. Independent
catalog verification passed: all32versions,24exact function bodies,7RLS tables,
no authenticated direct writes/anonymous execution/private helper execution,
5protected original bodies and3realtime bindings. Normal owned-QA confirms
capability1, original openingSafety2/sessionConfirmation1, authoritative preview,
legacy-null/new computed-field contracts and no financial changes. An initial
external probe incorrectly required non-null reset metadata for unrestarted
bills; corrected the probe to the existing optional parser contract, with no
application or SQL change. No more SQL/operator action is required.

Normal owned-QA live UI used the actual public app with no API interception:
new both-direction/no-notice warning, no extra Google/password/checkbox,
320/360/390/430 at100/200%roottext, reload/re-review/Cancel, zero financial
mutation RPCs and runtime exceptions. All ten financial table hashes and
period state stayed identical. No customer account, private screenshot or
production Reset was used. Retained PWA activated current entry/Home/Profile/
Shared/Accounts/Records; five paper materials and four offline Home/QuickAdd
assets match source bytes. Signed-out private guards and offline Records shell
passed all four widths. No static cache was deleted.

The management SQL role remains read-only but installation is complete. Do not
re-run 003 or the new install during routine development. Follow the
[installation/recovery runbook](../runbooks/shared-restart-sql-editor.md) for
future diagnosis. A private ten-function source/ACL snapshot is not a full
database backup; provider snapshots/PITR remain unavailable as documented.
After a committed full Reset, preserve metadata and forward-fix; never roll
back filters in a way that resurrects debt.

External recovery/evidence: `/workspace/verification/shared-reset-2026-10-26`.
The allowlisted delivery gallery contains four synthetic real-component re-tag
captures and the current confirmation state, not private production data.
Read PROJECT_STATUS, WORK_LOG, this report and current git/provider evidence
after interruption. Do not replay a committed Reset or old financial fixtures.
