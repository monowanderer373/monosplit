import type { Group, GroupRole } from '../types'
import type { TranslationKey } from './i18n'

export type WorkspaceSyncStatus = 'idle' | 'loading' | 'synced' | 'offline' | 'error'
export type ClaimStatus = 'idle' | 'claiming' | 'claimed'

/**
 * Decides whether `GroupPage` should silently claim an unclaimed group on
 * behalf of the signed-in user. Extracted so the auto-claim effect's guard
 * conditions can be tested without mounting the page.
 */
export function shouldAutoClaim(input: {
  authUserId: string | null | undefined
  groupId: string | null | undefined
  claimStatus: ClaimStatus
  syncStatus: WorkspaceSyncStatus
  ownerId: string | null
}): boolean {
  if (!input.authUserId || !input.groupId) return false
  if (input.claimStatus !== 'idle') return false
  if (input.syncStatus !== 'synced' && input.syncStatus !== 'error') return false
  if (input.ownerId !== null) return false
  return true
}

/**
 * Decides whether the signed-in user needs a `user_groups` row registered for
 * this group. Owners never need one (ownership is tracked on the group row
 * itself); everyone else needs exactly one, created lazily the first time
 * their resolved role is known.
 */
export function shouldRegisterMembership(input: {
  authUserId: string | null | undefined
  groupId: string | null | undefined
  hasGroup: boolean
  role: GroupRole | null
  isAlreadyMember: boolean
}): boolean {
  if (!input.authUserId || !input.groupId || !input.hasGroup || !input.role) return false
  if (input.role === 'owner' || input.isAlreadyMember) return false
  return true
}

export type DiagnosticsTextInput = {
  syncStatus: WorkspaceSyncStatus
  lastError: string | null
  groupId: string | null | undefined
  ownerId: string | null
  authUserId: string | null | undefined
  role: GroupRole | null
  membershipRole: GroupRole | null
  linkedPerson: { id: string; name: string } | null
  canEditExpenseData: boolean
}

/** Builds the copy-pasteable support diagnostics blob shown in the sync-error panel. */
export function buildDiagnosticsText(t: (key: TranslationKey) => string, input: DiagnosticsTextInput): string {
  const none = t('group.syncDebugNone')
  const linkedLabel = input.linkedPerson ? `${input.linkedPerson.name} (${input.linkedPerson.id})` : none
  return [
    `${t('group.syncDebugStatus')}: ${input.syncStatus}`,
    `${t('group.syncDebugLastError')}: ${input.lastError ?? none}`,
    `${t('group.syncDebugGroupId')}: ${input.groupId ?? none}`,
    `${t('group.syncDebugOwnerId')}: ${input.ownerId ?? none}`,
    `${t('group.syncDebugAuthUserId')}: ${input.authUserId ?? none}`,
    `${t('group.syncDebugRole')}: ${input.role ?? none}`,
    `${t('group.syncDebugMembershipRole')}: ${input.membershipRole ?? none}`,
    `${t('group.syncDebugLinkedPerson')}: ${linkedLabel}`,
    `${t('group.syncDebugCanEditExpenses')}: ${input.canEditExpenseData ? t('group.syncDebugYes') : t('group.syncDebugNo')}`,
  ].join('\n')
}

export type SaveResult = { ok: boolean; error: string | null }

export type SaveExpenseRecoveryDeps = {
  save: (group: Group) => Promise<SaveResult>
  registerMembership: (groupId: string, role: GroupRole) => Promise<void>
}

/**
 * Saves a group that just gained a new expense. If the write is rejected —
 * some linked/full-access members are missing a `user_groups` row even
 * though the UI already treats them as editable — backfill that membership
 * once and retry exactly once, rather than surfacing a confusing permission
 * error for something the UI itself said the user could do.
 */
export async function saveExpenseWithRecovery(
  deps: SaveExpenseRecoveryDeps,
  input: { group: Group; ownerId: string | null; authUserId: string | null | undefined },
): Promise<SaveResult> {
  let result = await deps.save(input.group)
  if (!result.ok && input.authUserId && input.ownerId !== input.authUserId) {
    await deps.registerMembership(input.group.id, 'full_access')
    result = await deps.save(input.group)
  }
  return result
}
