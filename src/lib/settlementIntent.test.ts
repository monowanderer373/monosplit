import { describe, expect, it } from 'vitest'
import { resolveSettlementAmount, resolveSettlementProposal } from './settlementIntent'

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

  it('keeps a round-up gift outside shared T', () => {
    expect(resolveSettlementProposal({
      ...base,
      intent: 'partial',
      partialAmount: '100.50',
      overpayDisposition: 'gift',
    })).toEqual({
      sharedAmountMinor: 10_000,
      cashAmountMinor: 10_050,
      overpayDisposition: 'gift',
    })
  })

  it('puts a carry-forward overpayment fully into shared T', () => {
    expect(resolveSettlementProposal({
      ...base,
      intent: 'partial',
      partialAmount: '100.50',
      overpayDisposition: 'carry',
    })).toEqual({
      sharedAmountMinor: 10_050,
      cashAmountMinor: 10_050,
      overpayDisposition: 'carry',
    })
  })

  it('rejects an overpay disposition when there is no overpayment', () => {
    expect(() => resolveSettlementProposal({
      ...base,
      intent: 'partial',
      partialAmount: '40.00',
      overpayDisposition: 'gift',
    })).toThrow('overpay_disposition_requires_overpayment')
  })
})
