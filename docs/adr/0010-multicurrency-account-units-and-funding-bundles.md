# Multi-currency account units, actual funding and balance coverage

Accepted implementation decision — 2026-10-16. Product authority: the user's
MultiCurrency Complete Handoff, Q1–Q12 A and approved active entry points.

## Preserve the accounting units

Keep every existing `personal_accounts.id`, original currency, opening and
immutable journal unchanged. Additional currencies are explicit new accounting
units in the same existing account/journal model, mapped to one visible parent
by `personal_account_currencies`. Do not merge accounts by their names.

The original parent ID remains its original currency unit and global default.
The old account SELECT policy excludes only mapped child units. A guarded
owner-only RPC enumerates the complete current units for the new client. Old
clients continue to select their original accounts; their native sums cannot
accidentally include another currency. Entry FKs, integer money, original cash
leg/recurring/installment/refund commands and their permissions remain valid.
New unit IDs are never financial/security Participants.

Parent archive propagates to children; child units cannot become global default
accounts. Currency archive keeps its history. Unit and parent versions are
checked before new financial writes. Existing commands already increment the
account version for native postings; captured journal entry IDs supplement that
version for balance coverage. No timestamp is used as proof of inclusion.

## Actual funding is one atomic bundle

Keep the original funding intent and its server-derived accepted owner payer
contribution. A private bundle stores intended parent without asserting a debit
currency. Deferred expense creation uses the original canonical compiler and
command plus an unposted intent in one transaction: no reference-rate debit.

Confirmation validates the current expense/contribution/intent and all source
units, then posts existing native journal transactions for all legs in one
database transaction. Same-currency legs reconcile to the owner contribution.
Mixed currencies are an explicit whole-payment bundle, never a sum of raw mixed
units or a public-rate allocation. The first leg remains the legacy head pointer;
the complete immutable leg relation is authoritative for multi-source display.

An owner/request fingerprint receipt is checked before current-version checks.
Replay returns the original result; changed payloads conflict. Guard legacy
completion of managed bundles and reversal of individual bundle/movement legs
so older APIs cannot partially post/reverse them. Normal owner SDK JWT, target
lease and current authority are still required; a client preflight is not the
database permission boundary.

## Observed balances and late deductions

Setting an observed balance captures server unit version, the exact journal
cutoff, explicitly included entries and current pending intent IDs. The current
balance equals the observed balance plus captured entries excluded by the user.
Use original opening/reconciliation facts rather than changing old entries or
creating income. With unknown baseline and included −20, observed100 creates a
residual opening120, giving100. Current-time setup includes the displayed current
entries; changing coverage/as-of requires explicit review.

A pending deduction captured by that anchor, or a newly recorded backdated
ambiguous charge, needs an explicit inclusion decision for the resolved unit.
Included16.20 posts its real debit and a linked reconciliation calibration in
the same transaction, keeping100. Not included posts just the debit, giving83.80.
The calibration is not spending, income, a refund, or confirmation of another
pending charge. Unknown source currency is resolved before asking coverage.

## Own money movements and fees

Exchange/transfer/withdrawal reuse the original transfer journal. Principal is
not a canonical consumption expense. Included fees split the native containing
leg internally, not an extra deduction: total150 with fee2 remains −150. Separate
fees use an explicitly selected real unit and additional native debit. A linked
canonical fee contributes to spending once through existing expense authority.
Balance coverage is recorded per immutable journal component. A separate actual
fee from the same currency unit can have different inclusion from its principal.
The command sums only explicitly covered native components and creates one linked
calibration per unit, avoiding both mixed-currency arithmetic and intermediate
range/order errors. Included source/target fees share their containing physical
leg's coverage. A coverage choice in the app is pinned to the observed anchor ID;
a refreshed anchor requires a new explicit choice.

Later itemisation of an already observed fee is classification only and must
prevent ordinary funding from taking that fee again. Reversal/correction is an
explicit atomic append operation, never mutation or fake Undo of accepted facts.

## Existing source map and checks

| Current source | Authority | Integration |
| --- | --- | --- |
| `personalAccountReadRepository`, `quickAccounts` | accounts + immutable entries | owner unit RPC, parent grouping, native sums |
| `compileExpense`, `ledgerRepository`, Universal Quick Add | original `create_expense`/accepted payer contributions | optional actual/deferred funding plan, original editor retained |
| `notificationRepository`, `homeNotifications`, AccountNotice/NotificationTarget | current typed source/resolver/SDK lease | distinct intent grouping, current0/1/N destination, atomic confirm and next |
| journal migration001, funding002 | original single-entry/transfer/reversal invariants | compose native commands, never change F=E−T+R |
| recurring003, installment004, settlement005 | existing versioned owner cash commands | unit IDs remain existing account IDs; parent/archive/coverage guards |
| `fx.ts`, current persistent FX snapshot | display-only rational conversion | approximate recorded value/completeness, no posting input |

Validate new schema/RLS/grants/atomicity/concurrency and old-client/historical
behavior in disposable database tests. Test both production and harness module
graphs, current privacy and native return behavior. Expand schema first; require
capability verification before enabling new writes. Production is the existing
project only, with migration/history/backup checks and no reset or history replay.


Interrupted commands retain only owner-scoped opaque request metadata in session storage. A mounted uncertain action freezes its original command. After a closed/reloaded form presents a different draft, `reconcile_personal_money_operation` acquires the same actor/request locks as posting: it returns a committed receipt intact, or records an unsubmitted-request fence before a delayed original request can post. Only then can a different request be issued. The fence creates no journal/expense/financial reversal. Successful actions acknowledge/remove local recovery metadata after the required authoritative refresh; deliberately repeating the same movement later receives a new request ID. Structured connection failures remain uncertain. Two-session tests cover both original-first and fence-first ordering.
