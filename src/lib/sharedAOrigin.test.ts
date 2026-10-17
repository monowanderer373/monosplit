/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { emptySharedOrigin, readSharedOrigin, saveSharedOrigin, tabFromParam } from './sharedAOrigin'

afterEach(() => {
  sessionStorage.clear()
})

describe('Shared A origin memory', () => {
  it('keeps tab memory per identity and does not leak another account', () => {
    const origin = emptySharedOrigin('ada', 'MYR')
    origin.tab = 'trips'
    origin.tabs.trips.query = 'bali'
    origin.tabs.trips.scrollTop = 180
    saveSharedOrigin('ada', origin)
    expect(readSharedOrigin('ada', 'MYR').tabs.trips.query).toBe('bali')
    expect(readSharedOrigin('ada', 'MYR').tabs.trips.scrollTop).toBe(180)
    expect(readSharedOrigin('other', 'MYR').tab).toBe('friends')
    expect(readSharedOrigin('other', 'MYR').tabs.trips.query).toBe('')
  })

  it('reads friends as the default shared tab', () => {
    expect(tabFromParam(null)).toBe('friends')
    expect(tabFromParam('groups')).toBe('groups')
  })
})
