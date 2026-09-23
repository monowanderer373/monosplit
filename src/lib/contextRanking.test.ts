import { describe, expect, it } from 'vitest'
import {
  matchesContextSearch,
  rankMoneyContexts,
  type ContextActivity,
} from './contextRanking'
import type { MoneyContextRef } from './moneyContext'

const personal: MoneyContextRef = { kind: 'personal' }
const lan: MoneyContextRef = {
  kind: 'person',
  personId: 'person-lan',
  participantId: 'lan',
  participantIds: ['lan'],
  participantKind: 'manual',
  displayName: 'Lan',
}
const hanoi: MoneyContextRef = {
  kind: 'space',
  spaceId: 'hanoi',
  spaceType: 'trip',
  displayName: 'Hanoi',
}

describe('Context Picker ranking and search', () => {
  it('ranks deterministically using recency and frequency', () => {
    const activity: ContextActivity[] = [
      { context: lan, occurredAt: '2026-09-05T10:00:00Z' },
      { context: lan, occurredAt: '2026-09-04T10:00:00Z' },
      { context: hanoi, occurredAt: '2026-08-01T10:00:00Z' },
    ]

    expect(
      rankMoneyContexts({
        contexts: [personal, hanoi, lan],
        activity,
        destination: 'daily',
        nowMs: Date.parse('2026-09-06T10:00:00Z'),
      }).map((item) => item.context),
    ).toEqual([lan, hanoi, personal])
  })

  it('uses a deterministic key as its final tie-breaker', () => {
    expect(
      rankMoneyContexts({
        contexts: [hanoi, lan],
        activity: [],
        destination: 'other',
        nowMs: 0,
      }).map((item) => item.context),
    ).toEqual([lan, hanoi])
  })

  it('searches by both display name and context type', () => {
    const labels = {
      personal: 'Personal',
      person: 'Person',
      group: 'Group',
      trip: 'Trip',
    }
    expect(matchesContextSearch(hanoi, 'han', labels)).toBe(true)
    expect(matchesContextSearch(hanoi, 'trip', labels)).toBe(true)
    expect(matchesContextSearch(lan, 'group', labels)).toBe(false)
  })
})
