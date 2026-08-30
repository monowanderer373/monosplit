import { describe, expect, it } from 'vitest'
import type { UserProfile } from '../types'
import { applyProfileEnrichment } from './authProfile'

function profile(id: string, displayName: string): UserProfile {
  return {
    id,
    participantId: null,
    email: `${id}@example.test`,
    displayName,
    avatarUrl: null,
    lang: 'en',
    themeId: 'solid-vintage',
    defaultCurrency: 'MYR',
    timezone: 'Asia/Kuala_Lumpur',
    isAnonymous: false,
  }
}

describe('profile enrichment identity guard', () => {
  it('applies enrichment only while the same account is active', () => {
    const basic = profile('account-a', 'Basic')
    const enriched = profile('account-a', 'Enriched')

    expect(applyProfileEnrichment(basic, enriched)).toEqual(enriched)
  })

  it('does not let a delayed account response overwrite another account or sign-out', () => {
    const delayedAccountA = profile('account-a', 'Delayed A')
    const accountB = profile('account-b', 'Current B')

    expect(applyProfileEnrichment(accountB, delayedAccountA)).toEqual(accountB)
    expect(applyProfileEnrichment(null, delayedAccountA)).toBeNull()
  })
})
