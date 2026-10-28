import { spaceRepository, type SpaceWithRole } from './spaceRepository'
import { isSpaceExpenseEligible } from './moneyContext'
export type TripMember = Awaited<ReturnType<typeof spaceRepository.listMembers>>[number]
export const validTripId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
export function sortTripMembers(rows: readonly TripMember[], self: string): TripMember[] {
  const rank = (row: TripMember) => row.participant.id === self ? 0 : row.member.role === 'owner' ? 1 : row.participant.kind === 'manual' ? 3 : 2
  return rows.filter(row => !row.member.removedAt).slice().sort((a,b) => rank(a)-rank(b) || a.participant.displayName.localeCompare(b.participant.displayName) || a.participant.id.localeCompare(b.participant.id))
}
export function tripMemberPermissions(entry: SpaceWithRole, self: string, target?: TripMember) {
  const available = entry.space.status !== 'voided'
  return {
    invite: available && entry.role === 'owner',
    add: isSpaceExpenseEligible(entry.space,entry.role),
    role: available && entry.role === 'owner' && target?.member.role !== 'owner' && target?.participant.kind === 'account' && target.participant.id !== self,
    remove: available && !!target && target.member.role !== 'owner' && (entry.role === 'owner' || target.participant.id === self),
  }
}
export async function readTripMembership(id: string, self: string) {
  const [entry, rows] = await Promise.all([spaceRepository.get(id), spaceRepository.listMembers(id)])
  if (!entry) return null
  if (!rows.length) throw new Error('empty_membership_snapshot')
  const mine = rows.find(row => row.participant.id === self && !row.member.removedAt)
  if (!mine) return null
  if (mine.member.role !== entry.role) throw new Error('membership_changed')
  return { entry, members: sortTripMembers(rows,self) }
}
export function notifyTripMembersChanged(spaceId: string) {
  window.dispatchEvent(new CustomEvent('tt:space-members-changed',{detail:{spaceId}}))
}
