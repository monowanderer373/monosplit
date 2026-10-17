import type { SharedFilter, SharedTab } from './sharedAPresentation'

export type SharedTabMemory = {
  query: string
  filter: SharedFilter
  currency: string
  searching: boolean
  scrollTop: number
}

export type SharedOrigin = {
  identity: string
  tab: SharedTab
  view: 'list' | 'review'
  tabs: Record<SharedTab, SharedTabMemory>
}

const originKey = (identity: string) => `tt-shared-origin:${identity}`

export const emptyTabMemory = (currency: string): SharedTabMemory => ({
  query: '',
  filter: 'all',
  currency,
  searching: false,
  scrollTop: 0,
})

export function emptySharedOrigin(identity: string, currency: string): SharedOrigin {
  return {
    identity,
    tab: 'friends',
    view: 'list',
    tabs: {
      friends: emptyTabMemory(currency),
      groups: emptyTabMemory(currency),
      trips: emptyTabMemory(currency),
    },
  }
}

function isTab(value: unknown): value is SharedTab {
  return value === 'friends' || value === 'groups' || value === 'trips'
}

export function saveSharedOrigin(identity: string, value: SharedOrigin): void {
  if (!identity || value.identity !== identity || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(originKey(identity), JSON.stringify(value))
  } catch {
    /* Navigation remains available. */
  }
}

export function readSharedOrigin(identity: string, currency: string): SharedOrigin {
  const fallback = emptySharedOrigin(identity, currency)
  if (typeof sessionStorage === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(originKey(identity))
    const parsed = raw ? JSON.parse(raw) as SharedOrigin : null
    if (!parsed || parsed.identity !== identity || !isTab(parsed.tab)) return fallback
    return {
      identity,
      tab: parsed.tab,
      view: parsed.view === 'review' ? 'review' : 'list',
      tabs: {
        friends: { ...fallback.tabs.friends, ...parsed.tabs?.friends },
        groups: { ...fallback.tabs.groups, ...parsed.tabs?.groups },
        trips: { ...fallback.tabs.trips, ...parsed.tabs?.trips },
      },
    }
  } catch {
    return fallback
  }
}

export function tabFromParam(value: string | null): SharedTab {
  return value === 'groups' || value === 'trips' ? value : 'friends'
}

export function filterFromParam(value: string | null): SharedFilter {
  return value === 'balances' ? 'balances' : 'all'
}
