---
name: monosplit-share-link-invite-flow
description: Redirects removed MonoSplit group invites to Tabby Tally relational Space and friend invite flows.
---

# Relational invite flows

The old `/invite/:token`, `group_invite_links`, `user_groups`, and JSONB group
hydration flow is obsolete. `/invite/:token` is now a data-free redirect to
`/spaces`.

Current invite routes:

- `/space-invite/:token` for Space membership
- `/friend-invite/:token` for friend relationships

Space invite preview and acceptance must use relational command functions and
`space_members`. Do not fetch `groups.data`, restore an old group cache, or
auto-join from `/group/:groupId`.

Preserve anonymous Supabase auth so invited guests can receive an account-backed
Participant without reviving legacy membership code.
