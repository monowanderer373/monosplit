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
  if (!authUserId) {
    // Guest-first: a trip nobody has claimed belongs to whichever device is
    // holding it, so the app is fully usable without an account. Once a trip has
    // an owner, a guest needs to sign in and be invited like anyone else.
    return ownerId ? null : 'owner'
  }
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

/**
 * Bank details are a personal profile field, so they follow the same boundary as
 * names and avatars: your own record is yours, a manual traveller is maintained
 * by whoever runs the trip (they have no account to do it themselves), and
 * another account holder's record stays read-only whatever your role.
 */
export function canEditPaymentInfoFor(args: {
  role: GroupRole | null
  person: Person
  myPersonId?: string | null
}): boolean {
  const { role, person, myPersonId } = args
  if (!canEditOwnPaymentInfo(role)) return false
  if (myPersonId && person.id === myPersonId) return true
  return isManualTraveller(person) && canManageManualTravellers(role)
}

export function getLinkedPerson(group: Group, authUserId?: string | null): Person | null {
  if (!authUserId) return null
  return group.people.find((person) => person.authUserId === authUserId) ?? null
}

/**
 * Which traveller is "me" on this screen.
 *
 * An account link wins, because it survives across devices. `localPersonId` is
 * the guest fallback: a device-only pick that lets the me-first screens work
 * before anyone signs in. Returns null if the picked traveller has since been
 * deleted, so callers fall back to asking again rather than showing stale data.
 */
export function getMyPerson(
  group: Group,
  authUserId?: string | null,
  localPersonId?: string | null,
): Person | null {
  const linked = getLinkedPerson(group, authUserId)
  if (linked) return linked
  if (!localPersonId) return null
  return group.people.find((person) => person.id === localPersonId) ?? null
}
