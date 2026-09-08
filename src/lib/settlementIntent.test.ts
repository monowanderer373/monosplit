import { describe, expect, it } from 'vitest'
import { resolveSettlementAmount } from './settlementIntent'

const base = {
  outstandingMinor: 10_000,
  currency: 'MYR',
}

describe('settlement intent', () => {
  it('requires an explicit Full or Partial choice', () => {
    expect(() => resolveSettlementAmount({
      ...base,
      intent: null,
      partialAmount: '',
    })).toThrow('settlement_intent_required')
  })

  it('submits the exact current amount for Full and ignores stale typed text', () => {
    expect(resolveSettlementAmount({
      ...base,
      intent: 'full',
      partialAmount: '40.00',
    })).toBe(10_000)
  })

  it.each(['', '   '])('rejects blank Partial input: %j', (partialAmount) => {
    expect(() => resolveSettlementAmount({
      ...base,
      intent: 'partial',
      partialAmount,
    })).toThrow('partial_amount_required')
  })

  it.each(['0', '0.00', '-1', 'abc', '1.001', '90071992547410.00'])(
    'rejects invalid Partial input: %s',
    (partialAmount) => {
      expect(() => resolveSettlementAmount({
        ...base,
        intent: 'partial',
        partialAmount,
      })).toThrow()
    },
  )

  it('rejects Partial amounts above the current outstanding amount', () => {
    expect(() => resolveSettlementAmount({
      ...base,
      intent: 'partial',
      partialAmount: '100.01',
    })).toThrow('amount_exceeds_outstanding_balance')
  })

  it('returns an explicit valid Partial minor-unit amount', () => {
    expect(resolveSettlementAmount({
      ...base,
      intent: 'partial',
      partialAmount: '40.00',
    })).toBe(4_000)
  })
})
