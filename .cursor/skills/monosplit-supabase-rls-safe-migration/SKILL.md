---
name: monosplit-supabase-rls-safe-migration
description: Redirects database security work from removed JSONB group tables to Tabby Tally relational RLS and command functions.
---

# Relational Supabase security

The legacy `groups`, `user_groups`, and `group_invite_links` frontend runtime is
obsolete. Do not add client access to those tables.

For current changes:

- secure Participants, Spaces, Space Members, Canonical Expenses,
  participations, contributions, shares, and settlement tables with RLS
- use `auth.uid()` through the current Participant mapping
- perform financial mutations through idempotent PostgreSQL command functions
- keep Personal, Direct, and Space visibility rules explicit
- avoid cross-policy recursion by using carefully scoped security-definer
  helpers where needed
- represent persisted money with integer minor units

Historical database cleanup is separate from client work and requires explicit
approval. Consult ADR 0006 and the current Supabase migrations before changing
the relational model.
