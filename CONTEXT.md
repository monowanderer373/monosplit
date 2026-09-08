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

**Person Relationship**:
An owner-scoped identity and money-relationship record. It may be Manual, Link
Pending, or Linked. Linking changes who the relationship points to for new
Direct actions; it never rewrites historical financial principals or grants
visibility or Space membership.
_Avoid_: using Person as an authorization principal

**Participant**:
The immutable financial and security principal referenced by expenses, shares,
contributions, settlements, and Space membership. A Participant is
account-backed or manual. An anonymous guest is account-backed through Supabase
Auth even though it is not yet a permanent account.
_Avoid_: treating a Person relationship ID as a Participant ID

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

## Development status

- Phase 1 — Navigation Foundation: complete
- Phase 2 — Universal Quick Add + Context Picker: complete
- Phase 2.1 — Category provenance: complete
- Phase 3 — Person Identity / Manual to Linked: complete
- Phase 4 — Person / Group / Trip money-first hierarchy: complete
- Phase 5 — Settlement + Correction / Edit / Void / Undo: **closed**
- Next: Phase 6 — Personal Home + UI Redesign

Phase 5 development and local verification are complete. Production rollout is
pending; `202609080001_phase5_financial_trust.sql` has not been deployed to the
linked project.

## Locked Phase 5 financial trust

- Balance is derived. The current relational position is `F = E - T + R`,
  where `E` is effective expense obligations, `T` is accepted settlement
  transfers, and `R` is immutable settlement reversal facts.
- Settlement residual remains directional credit or debt. Accepted settlements
  are immutable; reversal is a separate fact.
- For a confirmed Direct correction, A remains effective while B is pending.
  Final participant authority atomically supersedes A and activates B.
- Confirmed Direct cancellation requires participant authority. Space
  correction uses existing authorized Space creator/owner authority.
- Correction lineage is durable and machine-readable. Pending, declined, or
  withdrawn candidates never enter authoritative lineage.
- Historical Manual transactions keep their original Manual Participant UUIDs;
  new linked Direct transactions use the Account Participant.
- Person is a relationship/display identity, never a financial or security
  principal.
- Safe Undo is limited to genuinely reversible unflushed or owner-local states.
  Accepted settlement, reversal, correction, and shared confirmed history are
  never fake-Undone.
- Historical facts remain distinct from current derived financial
  interpretation.
- Realtime events only invalidate and refetch authoritative state; event arrival
  order never becomes financial truth.

Phase 6 must preserve the money-first hierarchy and must not redesign Phase 5
correction, cancellation, settlement, identity, or security semantics.

## Phase 5 verification baseline

- Unit: 233 / 233
- pgTAP: 279 / 279
- Separate-session concurrency: 17 / 17
- Playwright: 23 / 23
- Database reset: 13 migrations
- Database lint: zero errors or warnings
- ESLint, production build, and `git diff --check`: passed
- Deterministic local E2E: `npm run test:e2e:phase5`

The first shared deployment makes the Phase 5 migration immutable migration
history. Any later database correction must use a new guarded forward
migration.
