# Personal reporting periods preserve financial source facts

Status: implemented in `feat/me-v2`; rollout requires disposable SQL/concurrency/authenticated tests and verified production installation. Primary design contract: Me V2 implementation specification,2026-10-25. User policy: keep all recurring rules, open instalments and pending deductions on their existing workflows; subsequent actual postings belong to the new period.

Fresh Start changes the owner's personal reporting boundary. It does not delete an Auth account, change a Participant, relink a Person, void an expense, reverse a settlement, rebuild a debt ledger, convert currencies or zero accounts. The canonical engine and F=E−T+R remain authoritative.

## Ownership and reference graph

Owner-only period/membership/opening/preview/receipt tables have RLS and no authenticated DML grants. Public functions derive the permanent account Participant from signed Auth claims. Every readable correction component touching a non-personal scope or another principal, and every settlement-attributed expense, is protected. Reversal chains touching shared expenses or settlement transactions are protected as well. Source rows and reference IDs are never rewritten. Archive is an owner-authorized read-only projection of canonical facts; future purely personal corrections inherit the original period, while a transition touching a shared scope is never hidden from shared computations.

The raw ledger context stays complete. Daily/Insights/Spending records apply the personal membership filter only at their reporting boundary. Shared/person/space debt calculations continue using the original full ledger. A later actual payment for an archived expense becomes new-period native cash activity with `affectsPersonalSpending=false`, retaining its original expense reference. The old purchase does not become new spending.

## Native balances and continuing obligations

Each existing active account/currency is explicitly reviewed. Known balances can be retained; unknown balances require an observed value; signed balances and currency precision use the existing money parser. No FX reference estimate becomes money. The transaction composes the original versioned `set_personal_currency_balance` for each unit and records its anchor/opening snapshot once. Existing immutable entries remain intact, and normal anchor inclusion rules prevent later old pending deductions from being charged twice. Calibration is classified as a baseline, not new income or spending. Instalment principal/schedules, recurring rules and pending funding records are not modified by Reset; their later original commands continue normally.

## Concurrency and interrupted requests

A persisted15-minute server preview includes an authoritative fingerprint over visible canonical expense/participation/share/contribution/settlement/correction facts and all relevant owner cash/funding/account/recurring/instalment/period graphs. Commit verifies owner, signed AMR authentication within5minutes, the fingerprint, native account identities and exact opening values. Refreshed JWT `iat` is not reauthentication.

The Reset/reconciliation owner advisory lock provides idempotence and fencing. Existing ordinary writers do not use that lock, so bounded `SHARE ROW EXCLUSIVE` table locks establish a real serialization boundary; the preview is rechecked after acquiring them. A stale version, lock timeout, conflict, malformed opening or any mid-operation failure rolls back periods, membership, anchors and receipt together. Identical request replay returns the original receipt; changed payload conflicts. Reconciliation either returns the committed receipt or fences the request while holding the same owner lock, preventing a delayed original from committing after a new review.

The browser persists only an identity-scoped request UUID in session storage before posting. It never persists a reauthentication password or opening amounts. An unresolved UUID blocks another Reset until authoritative reconciliation. Reload/OAuth discards opening choices and requires review again; it cannot silently use previous custom values or commit on return.

## Rollout and limits

No actual Reset is run against production, even for owned QA. Disposable PostgreSQL tests cover atomic rollback, RLS, recency, original pending funding, continuing obligations, balance conservation and competing sessions. Authenticated disposable browser tests compare both participants' shared/settlement facts and native balances before/after. Production checks install/capability/preview/auth/PWA only. A missing capability disables Reset and prevents personal reports from presenting old archived history as active; a read/network/permission error is never an empty archive or verified zero balance. Unknown future native journal types fail closed pending audit.
