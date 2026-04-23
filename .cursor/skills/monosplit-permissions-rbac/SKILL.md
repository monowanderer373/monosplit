---
name: monosplit-permissions-rbac
description: Implements and debugs MonoSplit group permissions, invite roles, linked-member vs manual-traveller rules, and owner/full-access/view UI guards. Use when editing group access rules, share links, profile edit permissions, or any owner/full access/view behavior in MonoSplit.
---
# MonoSplit Permissions RBAC

## Use This Skill When

- The task changes who can view, edit, invite, settle, or manage members in MonoSplit.
- The user mentions `owner`, `full access`, `view`, `invite link`, `share link`, `manual traveller`, or `linked member`.
- A UI action should be visible for some roles but blocked for others.
- A member can or cannot edit a profile, traveller, expense, dashboard payment info, or trip settings.

## Canonical Role Model

MonoSplit has exactly three member roles:

- `owner`
- `full_access`
- `view`

Keep `manual traveller` separate from account-linked membership.

- `linked member`: a `Person` with `authUserId`
- `manual traveller`: a `Person` without `authUserId`

Do not collapse these concepts.

## Canonical Capabilities

### `owner`

- Can do everything `full_access` can.
- Can update linked member permissions.
- Can create invite links and choose `full_access` or `view`.
- Can transfer ownership.
- Can delete the whole trip/group.

### `full_access`

- Can edit trip basic info.
- Can add, edit, and remove `manual traveller` profiles.
- Can edit expenses and settle balances.
- Can comment and edit their own payment info.
- Cannot change linked member permissions.
- Cannot create invite links.
- Cannot transfer ownership or delete the group.

### `view`

- Can view all pages.
- Can comment on dashboard.
- Can edit only their own payment info.
- Can open their own profile.
- Cannot add/edit/remove `manual traveller`.
- Cannot edit expenses, settle, change trip settings, or create invite links.

## Profile Editing Rules

These rules are easy to break. Keep them explicit:

- `manual traveller` profiles can be edited by `owner` and `full_access`.
- `linked member` profiles are read-only for everyone else.
- A linked member can edit their own name and avatar.
- `owner` is not allowed to edit another linked member's personal profile fields.
- `owner` may still change another linked member's permission level.

When implementing self-edit behavior, do not rely on a single strict equality check if legacy data may be messy. Prefer:

1. Direct `person.authUserId === authUser.id`
2. Owner/self fallback when the current account is the group owner
3. Conservative name fallback only when needed for legacy recovery

## Invite And Join Flow

- Do not auto-join from a raw group URL.
- Use token-based invite links.
- Invite links must carry a preset role: `full_access` or `view`.
- Only `owner` can create invite links.
- Accepting an invite must create or update `user_groups`.
- Keep DB writes snake_case: `group_id`, `created_by`, `created_at`.

## Files Usually Involved

- `src/lib/permissions.ts`
- `src/hooks/useAuth.ts`
- `src/pages/GroupPage.tsx`
- `src/pages/GroupsPage.tsx`
- `src/pages/InvitePage.tsx`
- `src/components/PeopleTab.tsx`
- `src/components/DashboardTab.tsx`
- `src/components/SettleTab.tsx`
- `src/components/SettlePaySheet.tsx`
- `src/store/useStore.ts`
- `src/lib/i18n.ts`
- `src/types/index.ts`

## Implementation Checklist

- Add or update role types in `src/types/index.ts`.
- Keep permission helpers centralized in `src/lib/permissions.ts`.
- Derive page/component behavior from helpers, not ad-hoc inline checks.
- Pass role-aware props into tabs and sheets instead of re-deriving logic everywhere.
- Distinguish `manual traveller` from `linked member` before enabling edit controls.
- For self profile editing, update both the person profile in the group and the account display name when appropriate.
- Keep all UI copy in `src/lib/i18n.ts`.
- Verify `owner` leave flow still requires transfer or delete.

## Common Failure Modes

- Treating every linked member as read-only, including the signed-in user.
- Letting `full_access` create invite links or edit linked member permissions.
- Letting `view` access write actions because a button was only visually hidden.
- Forgetting to update both data model and permission helpers.
- Mixing `manual traveller` logic with linked account logic.
- Writing invite rows with camelCase keys instead of DB snake_case keys.
- Assuming old groups already have clean membership rows.

## Verification

Check at least these flows:

1. `owner` can update linked member permission and create invite links.
2. `full_access` can manage manual travellers but cannot create invite links.
3. `view` can comment and edit own payment info only.
4. A linked member can edit their own avatar and name.
5. Another user cannot edit that linked member's avatar or name.
6. Invite acceptance writes the correct role into `user_groups`.
7. Group and profile pages still render correctly after refresh and re-login.
