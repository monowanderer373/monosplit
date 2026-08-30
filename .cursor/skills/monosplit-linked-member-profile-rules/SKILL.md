---
name: monosplit-linked-member-profile-rules
description: Marks the removed MonoSplit JSONB person-profile workflow obsolete and redirects profile work to Tabby Tally Participants.
---

# Obsolete: JSONB linked-member profiles

The old `Group.people`, `Person.authUserId`, `PeopleTab`, and group-local avatar
editing workflow no longer exists in the frontend.

For current work:

- Treat `Participant` as the identity record.
- Account Participants are linked through `auth_user_id`.
- Manual Participants are relational records with `kind = manual`.
- Account profile updates belong in `user_profiles` and auth/profile flows.
- Space membership permissions belong in `space_members`.
- Do not recreate group-local people arrays or legacy self-matching heuristics.

Read `.cursor/skills/monosplit-context/SKILL.md` and `CONTEXT.md` before making
profile or Participant changes.
