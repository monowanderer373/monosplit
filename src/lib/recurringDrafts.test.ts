import { describe, expect, it } from 'vitest'
import {
  dedupeOccurrenceKeys,
  generatePendingRecurringDrafts,
  nextLocalCalendarDate,
  recurringOccurrenceKey,
} from './recurringDrafts'

describe('recurring drafts', () => {
  it('advances weekly dates by local calendar weeks without timezone arithmetic', () => {
    expect(nextLocalCalendarDate('2026-03-01', { unit: 'weekly' })).toBe('2026-03-08')
    expect(nextLocalCalendarDate('2026-12-27', { unit: 'weekly' })).toBe('2027-01-03')
  })

  it('clamps monthly occurrences while preserving the configured anchor day', () => {
    const cadence = { unit: 'monthly', dayOfMonth: 31 } as const
    expect(nextLocalCalendarDate('2026-01-31', cadence)).toBe('2026-02-28')
    expect(nextLocalCalendarDate('2026-02-28', cadence)).toBe('2026-03-31')
    expect(nextLocalCalendarDate('2028-01-31', cadence)).toBe('2028-02-29')
  })

  it('builds stable occurrence keys and deduplicates them in first-seen order', () => {
    const key = recurringOccurrenceKey('rule-1', '2026-08-30')
    expect(key).toBe('rule-1:2026-08-30')
    expect(dedupeOccurrenceKeys([key, key, 'rule-2:2026-08-30'])).toEqual([
      key,
      'rule-2:2026-08-30',
    ])
  })

  it('idempotently emits pending drafts only, never canonical expenses', () => {
    const result = generatePendingRecurringDrafts([{
      id: 'rule-1',
      active: true,
      nextDueOn: '2026-08-02',
      cadence: { unit: 'weekly' },
      payload: { category: 'Food', currency: 'MYR' },
    }], '2026-08-30', [
      'rule-1:2026-08-09',
      'rule-1:2026-08-23',
    ])

    expect(result.drafts.map((draft) => draft.scheduledFor)).toEqual([
      '2026-08-02',
      '2026-08-16',
      '2026-08-30',
    ])
    expect(result.nextDueOnByRule).toEqual({ 'rule-1': '2026-09-06' })
    for (const draft of result.drafts) {
      expect(draft).toEqual(expect.objectContaining({
        kind: 'recurring_draft',
        status: 'pending',
      }))
      expect(draft).not.toHaveProperty('id')
      expect(draft).not.toHaveProperty('clientRequestId')
      expect(draft).not.toHaveProperty('totalMinor')
    }
  })

  it('stops at the inclusive rule end date', () => {
    const result = generatePendingRecurringDrafts([{
      id: 'rule-1',
      active: true,
      nextDueOn: '2026-08-01',
      endOn: '2026-08-15',
      cadence: { unit: 'weekly' },
      payload: {},
    }], '2026-08-31')

    expect(result.drafts.map((draft) => draft.scheduledFor)).toEqual([
      '2026-08-01',
      '2026-08-08',
      '2026-08-15',
    ])
  })
})
