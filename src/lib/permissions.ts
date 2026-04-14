import type { Group, GroupMembership, GroupRole, Person } from '../types'

export function isManualTraveller(person: Person): boolean {
  return !person.authUserId
}

export function getGroupRole(args: {
  ownerId?: string | null
  authUserId?: string | null
  membership?: GroupMembership | null
}): GroupRole | null {
  const { ownerId, authUserId, membership } = args
  if (!authUserId) return null
  if (ownerId && ownerId === authUserId) return 'owner'
  return membership?.role ?? null
}

export function canEditGroup(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access'
}

export function canManageManualTravellers(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access'
}

export function canManageMembers(role: GroupRole | null): boolean {
  return role === 'owner'
}

export function canInviteMembers(role: GroupRole | null): boolean {
  return role === 'owner'
}

export function canComment(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access' || role === 'view'
}

export function canEditExpenses(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access'
}

export function canSettle(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access'
}

export function canEditOwnPaymentInfo(role: GroupRole | null): boolean {
  return role === 'owner' || role === 'full_access' || role === 'view'
}

export function getLinkedPerson(group: Group, authUserId?: string | null): Person | null {
  if (!authUserId) return null
  return group.people.find((person) => person.authUserId === authUserId) ?? null
}
