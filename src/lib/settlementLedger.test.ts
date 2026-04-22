import { describe, expect, it } from 'vitest'
import type { Expense, SettlementPayment, Split } from '../types'
import { autoAllocateSettlement, createSettlementSnapshot } from './settlementLedger'

function buildSplit(personId: string, amount: number): Split {
  return {
    personId,
    amount,
    baseAmount: amount,
    taxAmount: null,
    repayCurrency: 'JPY',
    convertedAmount: null,
    rate: null,
    rateSource: null,
    rateDate: null,
    repaid: false,
    repaidAt: null,
    repaidDate: null,
    repaidPayerIds: [],
  }
}

function buildExpense(id: string, payerIds: string[], splits: Split[], amount?: number): Expense {
  return {
    id,
    type: 'expense',
    category: 'Food',
    description: id,
    payerIds,
    amount: amount ?? splits.reduce((sum, split) => sum + (split.amount ?? 0), 0),
    paidCurrency: 'JPY',
    repayCurrency: 'JPY',
    paymentMethod: 'cash',
    splitMode: 'equal',
    itemizedInputMode: null,
    serviceTaxPct: null,
    salesTaxPct: null,
    tipsPct: null,
    taxPctTotal: null,
    receiptItems: null,
    receiptTaxAmount: null,
    date: '2026-04-23',
    createdAt: '2026-04-23T00:00:00.000Z',
    splits,
  }
}

function buildPayment(amount: number, allocations: SettlementPayment['allocations']): SettlementPayment {
  return {
    id: 'payment-1',
    debtorId: 'voo',
    currency: 'JPY',
    repayCurrency: 'JPY',
    repayAmount: amount,
    paymentDate: '2026-04-23',
    createdAt: '2026-04-23T01:00:00.000Z',
    updatedAt: '2026-04-23T01:00:00.000Z',
    rate: null,
    rateSource: null,
    rateDate: null,
    source: 'record_payment',
    note: null,
    allocations,
  }
}

describe('settlement ledger', () => {
  it('reduces outstanding balance for a partial payment', () => {
    const expenses = [buildExpense('expense-1', ['soon'], [buildSplit('voo', 100)], 100)]
    const snapshot = createSettlementSnapshot({
      expenses,
      settlementPayments: [buildPayment(40, [{ creditorId: 'soon', amount: 40 }])],
    })

    expect(snapshot.settlements).toEqual([
      { debtorId: 'voo', creditorId: 'soon', currency: 'JPY', amount: 60 },
    ])
    expect(snapshot.splitOutstanding['expense-1::0']).toBe(60)
    expect(snapshot.paymentSummaries[0]?.unappliedAmount).toBe(0)
  })

  it('caps overpayment and reports the unapplied remainder', () => {
    const expenses = [buildExpense('expense-1', ['soon'], [buildSplit('voo', 100)], 100)]
    const snapshot = createSettlementSnapshot({
      expenses,
      settlementPayments: [buildPayment(120, [{ creditorId: 'soon', amount: 120 }])],
    })

    expect(snapshot.settlements).toEqual([])
    expect(snapshot.paymentSummaries[0]?.totalApplied).toBe(100)
    expect(snapshot.paymentSummaries[0]?.unappliedAmount).toBe(20)
  })

  it('recomputes safely when expense debt shrinks after payment history exists', () => {
    const expenses = [buildExpense('expense-1', ['soon'], [buildSplit('voo', 50)], 50)]
    const snapshot = createSettlementSnapshot({
      expenses,
      settlementPayments: [buildPayment(100, [{ creditorId: 'soon', amount: 100 }])],
    })

    expect(snapshot.settlements).toEqual([])
    expect(snapshot.paymentSummaries[0]?.unappliedAmount).toBe(50)
  })

  it('auto allocates across multiple creditors by current debt weight', () => {
    const allocations = autoAllocateSettlement(
      [
        { creditorId: 'soon', amount: 100 },
        { creditorId: 'hao', amount: 50 },
      ],
      90,
    )

    expect(allocations).toEqual([
      { creditorId: 'soon', amount: 60 },
      { creditorId: 'hao', amount: 30 },
    ])
  })

  it('restores full outstanding when payment history is undone', () => {
    const expenses = [buildExpense('expense-1', ['soon'], [buildSplit('voo', 100)], 100)]
    const snapshot = createSettlementSnapshot({
      expenses,
      settlementPayments: [],
    })

    expect(snapshot.settlements).toEqual([
      { debtorId: 'voo', creditorId: 'soon', currency: 'JPY', amount: 100 },
    ])
  })
})
