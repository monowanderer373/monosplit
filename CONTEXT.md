# Tabby Tally

A mobile-first personal and shared expense ledger. A person records an expense
once, optionally shares it with friends or a Space, and every authorized ledger
derives from that same record.

## Runtime architecture

- The frontend reads and writes the relational Tabby Tally model only:
  Participants, Spaces, Canonical Expenses, Payer Contributions, Expense
  Shares, and Settlement Payments/Allocations.
- Persisted money is integer minor units with an ISO currency code.
- Supabase Auth provides permanent and anonymous identities. Profile
  enrichment resolves the relational Participant for the active identity.
- Zustand persists presentation preferences and the per-identity ledger
  outbox/cache. It does not persist legacy group payloads.
- The former MonoSplit `groups.data` JSONB runtime, group synchronization,
  local group cache, legacy invite flow, and floating-point settlement engine
  are not part of the client.
- Historical `/legacy-spaces`, `/group/:groupId`, and `/invite/:token` URLs
  redirect to `/spaces`; historical `/embed/:groupId` URLs redirect to `/`.

## Language

### Core records

**Participant**:
An account-backed person or a manual person referenced by expenses. An anonymous
guest is account-backed through Supabase Auth even though it is not yet a
permanent account.
_Avoid_: Traveller when referring to identity

**Space**:
An explicit shared expense context with members and roles. A Space has type
Group or Trip. Personal and Direct expenses do not create hidden Spaces.
_Avoid_: Private group, implicit group

**Canonical Expense**:
The single authoritative expense record from which personal, Direct, and Space
ledgers are derived.
_Avoid_: Copied expense, ledger entry clone

**Payer Contribution**:
The integer minor-unit amount one Participant paid toward a Canonical Expense.
All Payer Contributions must equal the expense total.
_Avoid_: Payer split

**Expense Share**:
The integer minor-unit amount one Participant consumes or owes for a Canonical
Expense. All Expense Shares must equal the expense total.
_Avoid_: Allocation (reserved for settlements)

**Direct Split**:
A shared expense with account friends or manual people that is not inside a
Space. Every tagged account independently accepts or declines their own share.
_Avoid_: Two-person group

**Untracked Share**:
A manual person's Direct Expense Share. It explains the recorder's advance but
does not create an account balance.
_Avoid_: Guest debt

**Personal Ledger**:
The signed-in account's private derived view of amounts paid, personal spending,
tracked receivables/payables, pending advances, and untracked advances.

### Settlement

**Settlement Payment**:
A debtor's proposed same-currency payment toward a Direct or Space balance,
split across one or more recipients through Settlement Allocations. A proposal
does not change balances until the relevant recipient accepts.
_Avoid_: Transaction, repayment record

**Settlement Allocation**:
The portion of a Settlement Payment assigned to one recipient. Its independent
pending, accepted, declined, or reversed state controls whether it applies.
_Avoid_: Split, share

**Counterparty Balance**:
A deterministic standing between two Participants in one context and one
currency after accepted expenses and accepted Settlement Allocations.
_Avoid_: Debt pair, balance row

**Contra** (or **Reverse Amount**):
The amount owed in the opposite direction within the same context and currency,
netted before a debt is shown as outstanding.
_Avoid_: Offset, netting

**Unapplied Amount**:
The accepted Settlement Allocation amount that cannot be matched to an
outstanding debt, for example after a related expense is voided or corrected.
_Avoid_: Excess payment, leftover

### Capture

**Expense Draft**:
A reviewable, non-authoritative structure produced by manual entry, a template,
a recurring rule, natural language, voice, or OCR. Only the compiler and an
idempotent database command can turn it into a Canonical Expense.

**Recurring Draft**:
A due Expense Draft generated once for a scheduled occurrence. It never creates
a Canonical Expense without review and confirmation.
