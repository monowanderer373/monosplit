# ADR 0006: Tabby Tally uses one relational canonical expense

## Status

Accepted — 2026-08-30

## Context

MonoSplit stored a complete group, including people, expenses, and settlements,
in one JSONB row. That model cannot safely support a private personal ledger,
no-group Direct Splits, participant-level confirmation, or concurrent row-level
writes. It also represented money as floating-point major units.

## Decision

- Evolve the product in place as Tabby Tally.
- Store Personal, Direct, Group, and Trip expenses in the same relational
  `expenses` model.
- Use `scope = personal | direct | space`; Personal and Direct never create a
  hidden group.
- Represent all persisted money as safe integer minor units plus an ISO
  currency code.
- Store who paid in Payer Contributions and who consumed in Expense Shares.
  Both sets reconcile exactly to the canonical expense total.
- Keep Group and Trip as one Space model distinguished by `spaces.type`.
- Require each account participant to accept their own Direct participation
  before it creates a balance. Manual Direct participants remain untracked.
- Propose settlements separately from expenses. A recipient's allocation only
  affects the balance after that recipient accepts it.
- Send every capture source through an `ExpenseDraft` review and compile path.
- Perform financial mutations through idempotent PostgreSQL command functions;
  browsers receive only the Supabase anon key and user session.
- Remove the legacy `groups.data` client runtime. The frontend does not fetch,
  hydrate, mutate, subscribe to, or locally persist JSONB group payloads.
- Keep historical MonoSplit routes as data-free redirects into the relational
  application; do not load legacy repositories while redirecting.

## Consequences

- The client exposes only the integer Equal and Exact compile path. The former
  floating-point split, refund, and settlement calculators are removed.
- Queries can derive a personal ledger across spaces without duplicating
  expense rows.
- RLS can enforce Personal, Direct, and Space visibility independently.
- Material Direct edits must reset affected confirmations.
- Cross-currency conversion is out of scope for the MVP; balances and
  settlements remain separate per currency.
- Zustand migrations discard any old group cache while preserving language,
  theme, and relational ledger outbox/cache state.
- Historical database cleanup remains a separately approved operation outside
  this client-runtime decision.
