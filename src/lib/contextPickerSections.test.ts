import { describe, expect, it } from 'vitest'
import type { MoneyContextRef } from './moneyContext'
import { matchesContextSearch } from './contextRanking'
import {
  contextIdentityKey,
  dedupeContextPickerSections,
  type ContextPickerSections,
} from './contextPickerSections'

const personal: MoneyContextRef = { kind: 'personal' }
const lan: MoneyContextRef = {
  kind: 'person',
  personId: 'person-lan',
  participantId: 'participant-lan',
  participantIds: ['participant-lan'],
  participantKind: 'manual',
  displayName: 'Lan',
}
const hanoiGroup: MoneyContextRef = {
  kind: 'space',
  spaceId: 'space-hanoi-group',
  spaceType: 'group',
  displayName: 'Hanoi',
}
const hanoiTrip: MoneyContextRef = {
  kind: 'space',
  spaceId: 'space-hanoi-trip',
  spaceType: 'trip',
  displayName: 'Hanoi',
}

const labels = {
  personal: 'Personal',
  person: 'Person',
  group: 'Group',
  trip: 'Trip',
}

function sections(
  overrides: Partial<Parameters<typeof dedupeContextPickerSections>[0]> = {},
): ContextPickerSections {
  return dedupeContextPickerSections({
    personal: [personal],
    recent: [],
    people: [],
    groups: [],
    trips: [],
    includeRecent: true,
    ...overrides,
  })
}

function rendered(sections: ContextPickerSections): MoneyContextRef[] {
  return [
    ...sections.personal,
    ...sections.recent,
    ...sections.people,
    ...sections.groups,
    ...sections.trips,
  ]
}

describe('Context Picker section deduplication', () => {
  it('renders a recent Person only once instead of repeating it in People', () => {
    const result = sections({ recent: [lan], people: [lan] })

    expect(result.recent).toEqual([lan])
    expect(result.people).toEqual([])
  })

  it('renders a recent Group only once instead of repeating it in Groups', () => {
    const result = sections({
      recent: [hanoiGroup],
      groups: [hanoiGroup],
    })

    expect(result.recent).toEqual([hanoiGroup])
    expect(result.groups).toEqual([])
  })

  it('renders a recent Trip only once instead of repeating it in Trips', () => {
    const result = sections({
      recent: [hanoiTrip],
      trips: [hanoiTrip],
    })

    expect(result.recent).toEqual([hanoiTrip])
    expect(result.trips).toEqual([])
  })

  it('keeps different Persons that share a display name', () => {
    const otherLan: MoneyContextRef = {
      ...lan,
      personId: 'person-other-lan',
      participantId: 'participant-other-lan',
      participantIds: ['participant-other-lan'],
    }
    const result = sections({ people: [lan, otherLan] })

    expect(result.people).toEqual([lan, otherLan])
    expect(new Set(result.people.map(contextIdentityKey)).size).toBe(2)
  })

  it('returns each matching context once while search hides Recent', () => {
    const result = sections({
      recent: [lan, hanoiGroup, hanoiTrip],
      people: [lan],
      groups: [hanoiGroup],
      trips: [hanoiTrip],
      includeRecent: false,
    })
    const matches = rendered(result).filter((context) =>
      matchesContextSearch(context, 'hanoi', labels),
    )

    expect(matches.map(contextIdentityKey)).toEqual([
      'group:space-hanoi-group',
      'trip:space-hanoi-trip',
    ])
  })

  it('keeps Personal pinned before Recent and removes its duplicate', () => {
    const result = sections({
      recent: [personal, lan],
      people: [lan],
    })

    expect(result.personal).toEqual([personal])
    expect(result.recent).toEqual([lan])
    expect(rendered(result).map(contextIdentityKey)).toEqual([
      'personal',
      'person:person-lan',
    ])
  })
})
