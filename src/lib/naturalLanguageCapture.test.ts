import { describe, expect, it } from 'vitest'
import { parseNaturalLanguageCapture } from './naturalLanguageCapture'

const options = { referenceDate: '2026-08-30' }

describe('parseNaturalLanguageCapture', () => {
  it('extracts a comma-tolerant amount, explicit currency, relative date, and category', () => {
    const result = parseNaturalLanguageCapture(
      'Dinner MYR 1,234.50 yesterday',
      options,
    )

    expect(result.draft).toEqual({
      amount: '1234.50',
      currency: 'MYR',
      description: 'Dinner MYR 1,234.50 yesterday',
      category: 'Food',
      occurredOn: '2026-08-29',
    })
    expect(result.confidence.amount).toBeGreaterThanOrEqual(0.9)
    expect(result.confidence.currency).toBe(1)
    expect(result.warnings).toEqual([])
    expect(result.originalTranscript).toBe('Dinner MYR 1,234.50 yesterday')
  })

  it('supports conservative currency symbols without pretending ambiguous symbols are certain', () => {
    const ringgit = parseNaturalLanguageCapture('coffee RM12 today', options)
    expect(ringgit.draft.currency).toBe('MYR')
    expect(ringgit.confidence.currency).toBeGreaterThanOrEqual(0.9)

    const singapore = parseNaturalLanguageCapture('train S$ 20 today', options)
    expect(singapore.draft.currency).toBe('SGD')

    const dollar = parseNaturalLanguageCapture('taxi $20 today', options)
    expect(dollar.draft.currency).toBe('USD')
    expect(dollar.confidence.currency).toBeLessThan(0.8)
    expect(dollar.warnings).toContain('ambiguous_currency_symbol')

    const yen = parseNaturalLanguageCapture('lunch ¥900 today', options)
    expect(yen.draft.currency).toBe('JPY')
    expect(yen.warnings).toContain('ambiguous_currency_symbol')
  })

  it('accepts every configured three-letter currency code case-insensitively', () => {
    const result = parseNaturalLanguageCapture('hotel 80 eur 2026-08-20', options)
    expect(result.draft.currency).toBe('EUR')
    expect(result.draft.occurredOn).toBe('2026-08-20')
    expect(result.draft.category).toBe('Accommodation')
  })

  it('does not treat an ISO date as an amount', () => {
    const result = parseNaturalLanguageCapture('museum on 2026-08-20', options)
    expect(result.draft.amount).toBeUndefined()
    expect(result.warnings).toContain('amount_not_found')
  })

  it('leaves multiple amounts unresolved and warns instead of selecting one', () => {
    const result = parseNaturalLanguageCapture('Dinner MYR 30 plus drinks 12 today', options)
    expect(result.draft.amount).toBeUndefined()
    expect(result.confidence.amount).toBe(0)
    expect(result.warnings).toContain('multiple_amounts')
  })

  it('leaves conflicting currencies and dates unresolved', () => {
    const result = parseNaturalLanguageCapture(
      'Flight USD 100 SGD today 2026-08-28',
      options,
    )
    expect(result.draft.currency).toBeUndefined()
    expect(result.draft.occurredOn).toBeUndefined()
    expect(result.warnings).toEqual(expect.arrayContaining([
      'conflicting_currencies',
      'ambiguous_date',
    ]))
  })

  it('flags bounded participant split language without inventing an ID or split', () => {
    const result = parseNaturalLanguageCapture(
      'Dinner MYR 48 with Lan half yesterday',
      options,
    )

    expect(result.draft).toEqual(expect.objectContaining({
      amount: '48',
      currency: 'MYR',
      description: 'Dinner MYR 48 with Lan half yesterday',
    }))
    expect(result.draft).not.toHaveProperty('participantIds')
    expect(result.draft).not.toHaveProperty('splitMode')
    expect(result.warnings).toContain('participant_split_requires_review')
  })

  it('does not treat unbounded split-like words as participant instructions', () => {
    const result = parseNaturalLanguageCapture(
      'Split dinner MYR 48 with a very long free form participant description',
      options,
    )

    expect(result.warnings).not.toContain('participant_split_requires_review')
  })

  it('rejects a non-calendar reference date', () => {
    expect(() => parseNaturalLanguageCapture('lunch 10 MYR today', {
      referenceDate: '2026-02-30',
    })).toThrow('referenceDate must be a valid ISO calendar date')
  })
})
