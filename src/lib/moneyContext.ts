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
  | Readonly<{ kind: 'person-candidate'; personId: string }>
  | Readonly<{ kind: 'ambiguous' }>

export type GlobalDestination = 'daily' | 'insights' | 'shared' | 'me'

export type ContextRankSurface = 'daily' | 'friends' | 'groups' | 'other'

export function resolveRouteMoneyContext(pathname: string): RouteMoneyContext {
  if (pathname === '/' || pathname === '/quick-add') return { kind: 'personal' }

  const spaceMatch = /^\/space\/([^/]+)$/.exec(pathname)
  if (spaceMatch?.[1]) {
    return { kind: 'space-candidate', spaceId: decodeURIComponent(spaceMatch[1]) }
  }

  const personMatch = /^\/person\/([^/]+)$/.exec(pathname)
  if (personMatch?.[1]) {
    return { kind: 'person-candidate', personId: decodeURIComponent(personMatch[1]) }
  }

  return { kind: 'ambiguous' }
}

export function globalDestinationForPath(pathname: string): GlobalDestination {
  if (pathname === '/insights') return 'insights'
  if (
    pathname === '/shared'
    || pathname === '/friends'
    || pathname.startsWith('/person/')
    || pathname === '/spaces'
    || pathname.startsWith('/space/')
  ) return 'shared'
  if (pathname === '/profile') return 'me'
  return 'daily'
}

export function contextRankSurfaceForPath(pathname: string): ContextRankSurface {
  if (pathname === '/friends' || pathname.startsWith('/person/') || pathname === '/shared') return 'friends'
  if (pathname === '/spaces' || pathname.startsWith('/space/')) return 'groups'
  if (pathname === '/' || pathname === '/quick-add' || pathname === '/insights') return 'daily'
  return 'other'
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
