---
name: monosplit-permissions-rbac
description: Redirects permission work from removed JSONB groups to Tabby Tally relational Space membership and RLS.
---

# Relational permissions only

The legacy `groups`, `user_groups`, permission helpers, and group-page UI guards
are obsolete in the client.

Current rules:

- Space roles remain `owner`, `full_access`, and `view`.
- Membership lives in `space_members` and references a `Participant`.
- Owners manage Space membership and invites.
- Write authorization must be enforced by relational RLS and command functions,
  with UI guards used only for presentation.
- Personal, Direct, and Space visibility are separate relational policies.
- Do not reintroduce `Group`, `GroupMembership`, `Person`, or JSONB permission
  helpers.

Use `src/lib/spaceRepository.ts`, relational command functions, `CONTEXT.md`,
and ADR 0006 as the current sources of truth.
