import { describe, expect, it } from 'vitest'
import type { SettlementPayment } from '../types'
import { editPayment, quickSettle, recordPayment } from './settlementCommands'

function buildExistingPayment(overrides: Partial<SettlementPayment> = {}): SettlementPayment {
  return {
    id: 'payment-1',
    debtorId: 'voo',
    currency: 'JPY',
    repayCurrency: 'JPY',
    repayAmount: 100,
    paymentDate: '2026-04-23',
    createdAt: '2026-04-23T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
    rate: null,
    rateSource: null,
    rateDate: null,
    source: 'record_payment',
    note: null,
    allocations: [{ creditorId: 'soon', amount: 100 }],
    ...overrides,
  }
}

describe('recordPayment', () => {
  it('builds a payment when allocations fit the budget', () => {
    const result = recordPayment({
      debtorId: 'voo',
      currency: 'JPY',
      repayCurrency: 'JPY',
      repayAmount: 100,
      rate: null,
      rateSource: null,
      rateDate: null,
      paymentDate: '2026-04-23',
      allocations: [{ creditorId: 'soon', amount: 100 }],
      note: null,
      source: 'record_payment',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        debtorId: 'voo',
        currency: 'JPY',
        repayCurrency: 'JPY',
        repayAmount: 100,
        rate: null,
        rateSource: null,
        rateDate: null,
        paymentDate: '2026-04-23',
        allocations: [{ creditorId: 'soon', amount: 100 }],
        note: null,
        source: 'record_payment',
      },
    })
  })

  it('converts the repay amount through the rate before checking the budget', () => {
    // 1 JPY = 0.03 MYR, so paying 3 MYR covers a 100 JPY debt exactly.
    const result = recordPayment({
      debtorId: 'voo',
      currency: 'JPY',
      repayCurrency: 'MYR',
      repayAmount: 3,
      rate: 0.03,
      rateSource: 'manual',
      rateDate: '2026-04-23',
      paymentDate: '2026-04-23',
      allocations: [{ creditorId: 'soon', amount: 100 }],
      note: null,
      source: 'record_payment',
    })

    expect(result.ok).toBe(true)
  })

  it('rejects allocations that exceed the converted budget', () => {
    const result = recordPayment({
      debtorId: 'voo',
      currency: 'JPY',
      repayCurrency: 'MYR',
      repayAmount: 2,
      rate: 0.03,
      rateSource: 'manual',
      rateDate: '2026-04-23',
      paymentDate: '2026-04-23',
      allocations: [{ creditorId: 'soon', amount: 100 }],
      note: null,
      source: 'record_payment',
    })

    expect(result).toEqual({ ok: false, error: 'over_allocated' })
  })

  it('rejects a negative or non-finite repay amount', () => {
    expect(
      recordPayment({
        debtorId: 'voo',
        currency: 'JPY',
        repayCurrency: 'JPY',
        repayAmount: -10,
        rate: null,
        rateSource: null,
        rateDate: null,
        paymentDate: '2026-04-23',
        allocations: [{ creditorId: 'soon', amount: 10 }],
        note: null,
        source: 'record_payment',
      }),
    ).toEqual({ ok: false, error: 'invalid_amount' })

    expect(
      recordPayment({
        debtorId: 'voo',
        currency: 'JPY',
        repayCurrency: 'JPY',
        repayAmount: Number.NaN,
        rate: null,
        rateSource: null,
        rateDate: null,
        paymentDate: '2026-04-23',
        allocations: [{ creditorId: 'soon', amount: 10 }],
        note: null,
        source: 'record_payment',
      }),
    ).toEqual({ ok: false, error: 'invalid_amount' })
  })

  it('rejects when there is nothing to allocate', () => {
    const result = recordPayment({
      debtorId: 'voo',
      currency: 'JPY',
      repayCurrency: 'JPY',
      repayAmount: 100,
      rate: null,
      rateSource: null,
      rateDate: null,
      paymentDate: '2026-04-23',
      allocations: [{ creditorId: 'soon', amount: 0 }],
      note: null,
      source: 'record_payment',
    })

    expect(result).toEqual({ ok: false, error: 'nothing_to_pay' })
  })

  it('drops zero and negative allocation rows before checking the budget', () => {
    const result = recordPayment({
      debtorId: 'voo',
      currency: 'JPY',
      repayCurrency: 'JPY',
      repayAmount: 100,
      rate: null,
      rateSource: null,
      rateDate: null,
      paymentDate: '2026-04-23',
      allocations: [
        { creditorId: 'soon', amount: 100 },
        { creditorId: 'hao', amount: 0 },
        { creditorId: 'meng', amount: -5 },
      ],
      note: null,
      source: 'record_payment',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.allocations).toEqual([{ creditorId: 'soon', amount: 100 }])
    }
  })
})

describe('quickSettle', () => {
  it('builds a single-allocation payment with no FX conversion', () => {
    const result = quickSettle({
      debtorId: 'voo',
      creditorId: 'soon',
      currency: 'JPY',
      amount: 60,
      paymentDate: '2026-04-23',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        debtorId: 'voo',
        currency: 'JPY',
        repayCurrency: 'JPY',
        repayAmount: 60,
        rate: null,
        rateSource: null,
        rateDate: null,
        paymentDate: '2026-04-23',
        allocations: [{ creditorId: 'soon', amount: 60 }],
        note: null,
        source: 'quick_settle',
      },
    })
  })

  it('rejects a zero or negative amount', () => {
    expect(
      quickSettle({ debtorId: 'voo', creditorId: 'soon', currency: 'JPY', amount: 0, paymentDate: '2026-04-23' }),
    ).toEqual({ ok: false, error: 'nothing_to_pay' })

    expect(
      quickSettle({ debtorId: 'voo', creditorId: 'soon', currency: 'JPY', amount: -5, paymentDate: '2026-04-23' }),
    ).toEqual({ ok: false, error: 'invalid_amount' })
  })
})

describe('editPayment', () => {
  it('reuses the existing payment currency and rate to validate the new allocations', () => {
    const existingPayment = buildExistingPayment({ repayCurrency: 'MYR', rate: 0.03 })
    const result = editPayment({
      existingPayment,
      repayAmount: 3,
      paymentDate: '2026-04-24',
      allocations: [{ creditorId: 'soon', amount: 100 }],
    })

    expect(result).toEqual({
      ok: true,
      value: {
        paymentDate: '2026-04-24',
        repayAmount: 3,
        allocations: [{ creditorId: 'soon', amount: 100 }],
        source: 'history_edit',
      },
    })
  })

  it('rejects allocations that exceed the edited budget', () => {
    const existingPayment = buildExistingPayment()
    const result = editPayment({
      existingPayment,
      repayAmount: 50,
      paymentDate: '2026-04-24',
      allocations: [{ creditorId: 'soon', amount: 100 }],
    })

    expect(result).toEqual({ ok: false, error: 'over_allocated' })
  })

  it('rejects a negative repay amount', () => {
    const existingPayment = buildExistingPayment()
    const result = editPayment({
      existingPayment,
      repayAmount: -1,
      paymentDate: '2026-04-24',
      allocations: [{ creditorId: 'soon', amount: 10 }],
    })

    expect(result).toEqual({ ok: false, error: 'invalid_amount' })
  })
})
