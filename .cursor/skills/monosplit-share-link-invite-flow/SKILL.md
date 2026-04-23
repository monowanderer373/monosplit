---
name: monosplit-share-link-invite-flow
description: Implements and debugs MonoSplit share links, invite tokens, invite-role assignment, and invite acceptance without raw auto-join behavior. Use when changing invite flows, share URLs, token joins, invite page behavior, or membership creation from links in MonoSplit.
---
# MonoSplit Share Link Invite Flow

## Use This Skill When

- The task changes how users join a MonoSplit group.
- The user mentions `share link`, `invite link`, `token`, `join by link`, or `accept invite`.
- You need to control what role a new member gets from an invite.
- The app should stop auto-joining from a raw group URL.

## Canonical MonoSplit Rules

- Do not auto-join a group from a plain `/group/:id` link.
- Use token-based invite links instead.
- Invite links must carry a preset role.
- Supported invite roles are:
  - `full_access`
  - `view`
- `owner` is never granted by invite link.
- Only the `owner` can create invite links.
- `full_access` cannot create invite links.
- `view` cannot create invite links.

## Canonical Flow

### 1. Owner creates invite

The owner chooses one of:

- invite as `full_access`
- invite as `view`

The app creates a `group_invite_links` row with:

- `token`
- `group_id`
- `role`
- `created_by`
- `active`
- `created_at`
- optional `expires_at`

The share URL format is:

```text
/invite/:token
```

Not:

```text
/invite/:groupId
```

### 2. Invite recipient opens the token URL

The invite page should:

- read the token from route params
- fetch invite metadata from `group_invite_links`
- show the invite role in UI
- prompt sign-in if needed
- accept the invite after sign-in

### 3. Invite acceptance writes membership

Accepting an invite must upsert into `user_groups`:

- `user_id`
- `group_id`
- `role`

Never rely on frontend-only local state for this.

## Database Mapping Rules

Frontend types may use camelCase, but Supabase writes must use snake_case.

Important mappings:

- `groupId` -> `group_id`
- `createdBy` -> `created_by`
- `createdAt` -> `created_at`
- `expiresAt` -> `expires_at`

If invite creation succeeds locally but fails in Supabase, check field naming first.

## Membership Recovery Rules

MonoSplit has legacy groups and legacy linked users. When invite or membership logic changes:

- do not assume every linked member already has a `user_groups` row
- if a signed-in user is clearly linked to a person in the group, backfill membership when appropriate
- do not force users to manually rejoin if the app can safely recover membership

## Files Usually Involved

- `src/hooks/useAuth.ts`
- `src/pages/InvitePage.tsx`
- `src/pages/GroupPage.tsx`
- `src/pages/GroupsPage.tsx`
- `src/lib/permissions.ts`
- `src/types/index.ts`
- `src/App.tsx`
- `src/lib/i18n.ts`
- `supabase-auth-migration.sql`

## Implementation Checklist

- Route invite pages by token, not group id.
- Keep invite creation restricted to `owner`.
- Ensure invite acceptance upserts `user_groups`.
- Make invite role explicit in the UI.
- Remove old auto-join logic from group open flow.
- Keep role assignment centralized in auth/invite helpers.
- Add or update i18n keys for invite labels and errors.
- Verify copied share URLs use `/invite/${token}`.

## Common Failure Modes

- Using `/invite/:groupId` after moving to token invites.
- Creating invite rows with camelCase DB keys.
- Letting `full_access` create invite links by mistake.
- Accepting an invite locally but not writing `user_groups`.
- Keeping old auto-join code that silently conflicts with token invite logic.
- Forgetting to handle already-linked legacy members.

## Verification

Check at least these scenarios:

1. `owner` can create `full_access` and `view` invite links.
2. `full_access` cannot create invite links.
3. `view` cannot create invite links.
4. Opening `/invite/:token` shows the correct invite role.
5. Signing in from invite page successfully creates membership.
6. Accepted invite gives the correct role in `user_groups`.
7. Raw group URLs do not auto-join users.
8. Existing linked members are not accidentally stranded after invite flow changes.
