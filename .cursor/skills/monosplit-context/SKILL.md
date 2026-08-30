---
name: monosplit-context
description: Provides current Tabby Tally project context for any feature, bug fix, data model, UI, sync, auth, or PWA work in this repository.
---

# Tabby Tally Project Context

## Product

Tabby Tally is a mobile-first personal and shared expense ledger. A Canonical
Expense is recorded once and authorized ledgers derive from that record.

## Stack

- React 19, Vite, TypeScript, and React Router
- Tailwind CSS
- Zustand persistence for language, theme, and relational ledger cache/outbox
- Supabase Auth, PostgreSQL relational tables, RLS, and command functions
- Vitest and Playwright

## Canonical model

- `Participant`: account-backed or manual identity
- `Space`: explicit Group or Trip context with `space_members`
- `CanonicalExpense`: one Personal, Direct, or Space expense
- `PayerContribution`: integer minor-unit amount paid
- `ExpenseShare`: integer minor-unit amount consumed or owed
- `SettlementPayment` and allocations: confirmation-gated relational settlement

Persist money as integer minor units plus an ISO currency code. Personal and
Direct expenses never create hidden Spaces.

## Runtime boundaries

- `src/lib/compileExpense.ts` contains only the relational
  `compileLedgerExpense` pipeline.
- `src/lib/ledgerRepository.ts` and relational repositories call Supabase.
- `src/hooks/usePersonalLedger.ts` owns ledger fetching, optimistic commands,
  retries, and reconciliation.
- `src/store/useStore.ts` persists language, theme, and per-identity relational
  ledger state. Persist version 7 removes old group caches.
- `src/hooks/useAuth.ts` owns permanent/anonymous auth, relational profile and
  Participant enrichment, account upgrades, profile updates, and sign-out.
- `src/types/index.ts` contains relational DTOs. `GroupRole` remains the Space
  membership role type.

## Removed legacy model

The frontend must not restore the old MonoSplit JSONB runtime:

- no `groups.data` fetch, save, realtime subscription, or hydration
- no local `groups` Zustand slice or traveller identity cache
- no legacy group membership or invite helpers in `useAuth`
- no floating-point split/refund/settlement engine
- no legacy group pages, tabs, forms, exports, backups, or repositories

Historical routes are data-free redirects:

- `/legacy-spaces`, `/group/:groupId`, `/invite/:token` -> `/spaces`
- `/embed/:groupId` -> `/`

Do not add repository loading to those redirects.

## Auth and invitations

- Anonymous Supabase users are account-backed Participants.
- Account upgrades must preserve the current identity and Participant.
- Space invites use `/space-invite/:token` and relational command functions.
- Friend invites use `/friend-invite/:token`.
- Never use old `user_groups` or `group_invite_links` client flows.

## Core documentation

- `CONTEXT.md` defines domain language.
- `docs/adr/0006-tabby-tally-relational-canonical-expense.md` records the
  canonical relational decision.
- `CHANGELOG.md` is historical and must not be rewritten to erase legacy work.

## Verification

For runtime changes, verify no legacy imports or JSONB group-table access, then
run:

```text
npm test
npm run lint
npm run build
```
