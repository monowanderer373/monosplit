import type { GroupRole, ParticipantKind, Space, SpaceType } from '../types'

export type MoneyContextRef =
  | Readonly<{ kind: 'personal' }>
  | Readonly<{
    kind: 'person'
    personId: string
    participantId: string
    participantIds: readonly string[]
    participantKind: ParticipantKind
    displayName: string
  }>
  | Readonly<{
    kind: 'space'
    spaceId: string
    spaceType: SpaceType
    displayName: string
  }>

export type RouteMoneyContext =
  | Readonly<{ kind: 'personal' }>
  | Readonly<{ kind: 'space-candidate'; spaceId: string }>
  | Readonly<{ kind: 'ambiguous' }>

export type GlobalDestination = 'personal' | 'friends' | 'groups-trips' | 'me'

export function resolveRouteMoneyContext(pathname: string): RouteMoneyContext {
  if (pathname === '/' || pathname === '/quick-add') return { kind: 'personal' }

  const spaceMatch = /^\/space\/([^/]+)$/.exec(pathname)
  if (spaceMatch?.[1]) {
    return { kind: 'space-candidate', spaceId: decodeURIComponent(spaceMatch[1]) }
  }

  return { kind: 'ambiguous' }
}

export function globalDestinationForPath(pathname: string): GlobalDestination {
  if (pathname === '/friends') return 'friends'
  if (pathname === '/spaces' || pathname.startsWith('/space/')) return 'groups-trips'
  if (pathname === '/profile') return 'me'
  return 'personal'
}

export function isSpaceExpenseEligible(
  space: Pick<Space, 'status'>,
  role: GroupRole,
): boolean {
  return space.status === 'active' && (role === 'owner' || role === 'full_access')
}

export function isValidPersonExpenseTarget(input: {
  id: string
  displayName: string
}): boolean {
  return input.id.trim() !== '' && input.displayName.trim() !== ''
}
