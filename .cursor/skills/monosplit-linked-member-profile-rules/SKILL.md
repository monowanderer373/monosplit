---
name: monosplit-linked-member-profile-rules
description: Applies MonoSplit rules for linked members, self-editable account profiles, manual traveller editing, avatar upload behavior, and profile read-only boundaries. Use when changing profile editing, avatar uploads, linked-member permissions, or owner/full-access behavior around person records in MonoSplit.
---
# MonoSplit Linked Member Profile Rules

## Use This Skill When

- The task changes profile editing in MonoSplit.
- The user mentions `profile`, `avatar`, `upload photo`, `linked member`, `manual traveller`, or `why can't I edit my own profile`.
- You need to decide who can edit a person's name or avatar.
- You are changing `PeopleTab`, profile edit dialogs, or person-matching logic.

## Canonical Person Types

MonoSplit has two different person concepts. Do not merge them.

- `linked member`: a `Person` with `authUserId`
- `manual traveller`: a `Person` without `authUserId`

This distinction controls edit permissions.

## Canonical Editing Rules

### `manual traveller`

- Can be added by `owner` and `full_access`
- Can be edited by `owner` and `full_access`
- Can be removed by `owner` and `full_access`

### `linked member`

- Default behavior is read-only to everyone else
- The linked member can edit their own profile
- `owner` cannot directly edit another linked member's personal profile fields
- `owner` may still edit that member's permission level when allowed

### Self-edit behavior

When the signed-in member edits their own linked profile, they can:

- change their displayed person name in the group
- pick a preset avatar
- upload a custom avatar
- adjust the uploaded avatar before saving

If the edited linked member is the signed-in user, also keep account display name in sync when appropriate.

## Identity Matching Rules

Use direct account matching first:

- `person.authUserId === authUser.id`

For legacy MonoSplit groups, allow conservative fallback matching only when needed:

1. current user is the group owner
2. direct `authUserId` match is missing
3. person name clearly matches account display name or email prefix

Keep fallback logic narrow. Do not over-match unrelated people.

## Avatar Rules

Preset avatars:

- selecting a preset should update the draft avatar immediately

Uploaded avatars:

- selecting a local image should not save instantly
- open an adjust/crop editor first
- allow drag to reposition
- allow zoom
- save the adjusted result back into the draft avatar
- only commit to the group profile on explicit save

## Files Usually Involved

- `src/components/PeopleTab.tsx`
- `src/pages/ProfilePage.tsx`
- `src/hooks/useAuth.ts`
- `src/lib/permissions.ts`
- `src/store/useStore.ts`
- `src/types/index.ts`
- `src/lib/i18n.ts`

## Implementation Checklist

- Distinguish linked members from manual travellers before enabling controls.
- Compute `isEditingSelf` separately from group-wide role permissions.
- Keep self-edit allowed even when other linked members remain read-only.
- Gate remove actions to manual travellers only.
- Keep owner permission editing separate from profile field editing.
- After avatar upload, open an adjustment editor instead of saving immediately.
- Update i18n for any new avatar editor controls or hints.
- Verify the signed-in member sees save controls for their own linked profile.

## Common Failure Modes

- Treating all linked members as read-only, including the signed-in user
- Letting owner edit another linked member's avatar or name
- Using only exact-name equality and failing to recognize legacy self records
- Uploading an avatar directly without an adjustment step
- Saving the account profile but not the group person record, or vice versa
- Showing save/remove buttons for the wrong person type

## Verification

Check at least these cases:

1. Owner can edit a manual traveller's name and avatar.
2. Full access can edit a manual traveller's name and avatar.
3. View cannot edit manual traveller profiles.
4. A linked member can edit their own name and avatar.
5. Owner cannot edit another linked member's name or avatar.
6. Uploading a local photo opens the adjustment editor.
7. Adjusted avatar is only saved after explicit confirmation.
8. Self name edits stay reflected in both group profile and account display name when intended.
