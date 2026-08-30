import { describe, expect, it } from 'vitest'
import { resolveCaptureDefaults } from './captureDefaults'

describe('capture defaults', () => {
  it('resolves each field with deterministic entry, template, recent, profile precedence', () => {
    const result = resolveCaptureDefaults({
      entryContext: {
        scope: 'space',
        spaceId: 'trip-1',
        participantIds: ['dav', 'lan'],
      },
      template: {
        scope: 'direct',
        category: 'Food',
        currency: 'SGD',
        participantIds: ['dav', 'mei'],
        payerParticipantIds: ['dav'],
      },
      recent: {
        category: 'Transport',
        currency: 'THB',
        shareMode: 'exact',
      },
      profile: {
        currency: 'MYR',
        shareMode: 'equal',
      },
    })

    expect(result.values).toEqual({
      scope: 'space',
      spaceId: 'trip-1',
      category: 'Food',
      currency: 'SGD',
      participantIds: ['dav', 'lan'],
      payerParticipantIds: ['dav'],
      shareMode: 'exact',
    })
    expect(result.sourceByField).toEqual({
      scope: 'entryContext',
      spaceId: 'entryContext',
      category: 'template',
      currency: 'template',
      participantIds: 'entryContext',
      payerParticipantIds: 'template',
      shareMode: 'recent',
    })
  })

  it('never carries an amount from any source', () => {
    const result = resolveCaptureDefaults({
      entryContext: { amountMinor: 900 },
      template: { amountMinor: 800 },
      recent: { amountMinor: 700, category: 'Food' },
      profile: { amountMinor: 600, currency: 'MYR' },
    })

    expect(result.values).toEqual({ category: 'Food', currency: 'MYR' })
    expect(result.reusedAmount).toBe(false)
    expect(result.values).not.toHaveProperty('amountMinor')
  })

  it('reports lower-precedence defaults corrected by the selected value', () => {
    const result = resolveCaptureDefaults({
      entryContext: { currency: 'SGD' },
      template: { currency: 'THB' },
      recent: { currency: 'MYR' },
      profile: { currency: 'MYR' },
    })

    expect(result.corrections).toEqual([{
      field: 'currency',
      selectedSource: 'entryContext',
      supersededSources: ['template', 'recent', 'profile'],
    }])
  })

  it('copies array defaults so callers cannot mutate the source through the result', () => {
    const participantIds = ['dav', 'lan']
    const result = resolveCaptureDefaults({ template: { participantIds } })

    expect(result.values.participantIds).not.toBe(participantIds)
  })

  it('keeps explicitly provided values ahead of every inferred default', () => {
    const result = resolveCaptureDefaults({
      provided: {
        currency: 'JPY',
        description: 'User-entered dinner',
        category: 'Food',
        occurredOn: '2026-08-30',
      },
      entryContext: { currency: 'SGD', category: 'Shopping' },
      template: { description: 'Template dinner', occurredOn: '2026-08-29' },
      recent: { currency: 'THB' },
      profile: { currency: 'MYR' },
    })

    expect(result.values).toMatchObject({
      currency: 'JPY',
      description: 'User-entered dinner',
      category: 'Food',
      occurredOn: '2026-08-30',
    })
    expect(result.sourceByField).toMatchObject({
      currency: 'provided',
      description: 'provided',
      category: 'provided',
      occurredOn: 'provided',
    })
  })
})
