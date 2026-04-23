---
name: monosplit-supabase-rls-safe-migration
description: Designs and repairs MonoSplit Supabase migrations for groups, user_groups, invite links, and RLS without recursion or mixed uuid/text breakage. Use when editing MonoSplit SQL, fixing policy errors, investigating 500s from Supabase REST, or changing owner/member access rules.
---
# MonoSplit Supabase RLS Safe Migration

## Use This Skill When

- Editing `supabase-auth-migration.sql`
- Changing access rules for `groups`, `user_groups`, or `group_invite_links`
- Fixing Supabase SQL errors in MonoSplit
- Investigating `500`, `Group not found`, `policy recursion`, or `uuid/text` comparison issues

## MonoSplit-Specific Constraints

Treat this database as historically messy.

- Some environments behaved like mixed `uuid` / `text` schemas.
- Existing rows may contain old `role` values.
- Old policies may still exist from previous experiments.
- Re-running the migration must be safe.

Do not assume a clean greenfield Supabase project.

## Required Migration Rules

### 1. Make SQL idempotent

Prefer:

- `create table if not exists`
- `add column if not exists`
- `drop constraint if exists`
- `drop policy if exists`
- rebuilding policies instead of partial edits

### 2. Normalize old role data before enforcing checks

Before re-adding `user_groups_role_check`, convert invalid historical values to `full_access`.

### 3. Be explicit about identifier comparisons

When historical schemas may disagree on `uuid` vs `text`, compare with `::text`.

Typical MonoSplit cases:

- `owner_id::text = auth.uid()::text`
- `ug.user_id::text = auth.uid()::text`
- `ug.group_id::text = groups.id::text`

### 4. Never let `groups` and `user_groups` policies read each other directly

This is the biggest pitfall from this project.

Bad pattern:

- `groups` policy queries `user_groups`
- `user_groups` policy queries `groups`
- both tables have RLS enabled
- Supabase REST starts returning `500`
- Postgres reports `infinite recursion detected in policy`

### 5. Use `security definer` helper functions to break recursion

MonoSplit should prefer helper functions such as:

- `public.is_group_owner(target_group_id text, target_user_id text)`
- `public.is_group_member(target_group_id text, target_user_id text)`
- `public.get_group_role(target_group_id text, target_user_id text)`

Then policies call the helper instead of cross-querying each other inline.

## Canonical Tables

### `groups`

- stores shared group payload in `data`
- stores owner in separate `owner_id`

### `user_groups`

- stores `(user_id, group_id, role)`
- role must be one of `owner`, `full_access`, `view`

### `group_invite_links`

- stores invite token, target group, preset role, creator, and active state

## Safe Policy Shape

### `groups`

- `select`: ownerless group, owner, or member
- `insert`: open if app workflow needs it
- `update`: owner or `full_access`
- `delete`: owner only

### `user_groups`

- `select`: self, group owner, or group member
- `insert`: self or group owner
- `update`: self or group owner
- `delete`: self or group owner

### `group_invite_links`

- `select`: active links
- `insert/update/delete`: owner-controlled

## Failure Signatures And Meaning

### `operator does not exist: uuid = text`

- identifier types are mismatched
- add explicit `::text` comparisons

### `check constraint "user_groups_role_check" is violated`

- old rows still contain deprecated role values
- normalize data before re-adding the constraint

### `policy already exists`

- migration is not idempotent enough
- drop/rebuild policy

### `infinite recursion detected in policy for relation "user_groups"`

- `user_groups` policy is still reading `user_groups`
- or `groups` and `user_groups` are cross-querying each other with RLS on
- rebuild both policy sets using helper functions

## Recovery Checklist For `Group not found`

When UI says `Group not found`, check in this order:

1. Confirm the group row still exists in `public.groups`
2. Confirm `owner_id` is correct
3. Confirm `user_groups` membership rows exist
4. Inspect browser console for Supabase `500`
5. If console shows policy recursion, fix RLS before touching frontend
6. Only after DB is clean, debug frontend hydration or cache issues

## Verification Queries

Use these after migration changes:

```sql
select id, owner_id, data->>'name' as group_name
from public.groups
where id = '<group-id>';
```

```sql
select user_id, group_id, role
from public.user_groups
where group_id = '<group-id>';
```

```sql
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('groups', 'user_groups', 'group_invite_links')
order by tablename, policyname;
```

## Final Checks Before Finishing

- Migration re-runs cleanly.
- No duplicate legacy policies remain.
- `groups` REST reads return `200`, not `500`.
- `user_groups` REST reads return `200`, not `500`.
- Owner can open the group again.
- Invite creation and acceptance still work after policy changes.
