import { describe, expect, it } from 'vitest'
import type { Expense, Group, SettlementPayment } from '../types'
import { normalizeExpense, normalizeGroup, normalizeSettlementPayment } from './groupNormalize'

function buildExpense(overrides: Record<string, unknown> = {}): Expense & { payerId?: string } {
  return {
    id: 'expense-1',
    category: 'food',
    description: 'Dinner',
    payerIds: ['voo'],
    amount: 100,
    paidCurrency: 'jpy',
    repayCurrency: 'jpy',
    paymentMethod: 'cash',
    splitMode: 'equal',
    itemizedInputMode: null,
    serviceTaxPct: null,
    salesTaxPct: null,
    tipsPct: null,
    taxPctTotal: null,
    date: '2026-04-23',
    createdAt: '2026-04-23T00:00:00.000Z',
    splits: [],
    ...overrides,
  } as Expense & { payerId?: string }
}

function buildPayment(overrides: Record<string, unknown> = {}): SettlementPayment {
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
  } as SettlementPayment
}

describe('normalizeExpense', () => {
  it('migrates a legacy payerId into payerIds when payerIds is missing', () => {
    const legacy = buildExpense({ payerIds: undefined, payerId: 'voo' })
    const result = normalizeExpense(legacy)
    expect(result.payerIds).toEqual(['voo'])
    expect(result).not.toHaveProperty('payerId')
  })

  it('leaves payerIds untouched when already populated, even if a legacy payerId is also present', () => {
    const expense = buildExpense({ payerIds: ['voo', 'soon'], payerId: 'voo' })
    const result = normalizeExpense(expense)
    expect(result.payerIds).toEqual(['voo', 'soon'])
  })

  it('defaults payerIds to an empty array when neither payerIds nor payerId is present', () => {
    const expense = buildExpense({ payerIds: undefined })
    const result = normalizeExpense(expense)
    expect(result.payerIds).toEqual([])
  })

  it('sanitizes malformed receiptItems into well-formed rows', () => {
    const expense = buildExpense({
      receiptItems: [{ name: 'Coffee', unitPrice: 'not-a-number', debtorIds: ['voo', 'voo', 42] }],
    })
    const result = normalizeExpense(expense)
    expect(result.receiptItems).toEqual([
      { id: 'receipt-item-0', name: 'Coffee', unitPrice: null, quantity: null, amount: null, debtorIds: ['voo'] },
    ])
  })

  it('nulls out receiptItems when the value is not an array', () => {
    const expense = buildExpense({ receiptItems: 'garbage' })
    expect(normalizeExpense(expense).receiptItems).toBeNull()
  })

  it('nulls out a non-finite receiptTaxAmount', () => {
    const expense = buildExpense({ receiptTaxAmount: Number.NaN })
    expect(normalizeExpense(expense).receiptTaxAmount).toBeNull()
  })
})

describe('normalizeSettlementPayment', () => {
  it('trims and uppercases the currency', () => {
    const payment = buildPayment({ currency: ' jpy ' })
    expect(normalizeSettlementPayment(payment).currency).toBe('JPY')
  })

  it('falls back to repayCurrency when currency is missing', () => {
    const payment = buildPayment({ currency: '' , repayCurrency: 'myr' })
    expect(normalizeSettlementPayment(payment).currency).toBe('MYR')
  })

  it('drops allocations with a zero or negative amount', () => {
    const payment = buildPayment({
      allocations: [
        { creditorId: 'soon', amount: 100 },
        { creditorId: 'hao', amount: 0 },
        { creditorId: 'meng', amount: -5 },
      ],
    })
    expect(normalizeSettlementPayment(payment).allocations).toEqual([{ creditorId: 'soon', amount: 100 }])
  })

  it('clamps a negative repayAmount to zero', () => {
    const payment = buildPayment({ repayAmount: -50 })
    expect(normalizeSettlementPayment(payment).repayAmount).toBe(0)
  })

  it('defaults source to record_payment when missing', () => {
    const payment = buildPayment({ source: undefined })
    expect(normalizeSettlementPayment(payment).source).toBe('record_payment')
  })

  it('defaults rate, rateSource, rateDate and note to null when missing', () => {
    const payment = buildPayment({ rate: undefined, rateSource: undefined, rateDate: undefined, note: undefined })
    const result = normalizeSettlementPayment(payment)
    expect(result.rate).toBeNull()
    expect(result.rateSource).toBeNull()
    expect(result.rateDate).toBeNull()
    expect(result.note).toBeNull()
  })

  it('treats a non-array allocations field as empty', () => {
    const payment = buildPayment({ allocations: undefined })
    expect(normalizeSettlementPayment(payment).allocations).toEqual([])
  })
})

describe('normalizeGroup', () => {
  function buildGroup(overrides: Partial<Group> = {}): Group {
    return {
      id: 'group-1',
      name: 'Trip',
      startDate: null,
      endDate: null,
      defaultPaidCurrency: 'JPY',
      defaultRepayCurrency: 'MYR',
      people: [],
      expenses: [],
      settlementPayments: [],
      createdAt: '2026-04-23T00:00:00.000Z',
      ...overrides,
    }
  }

  it('normalizes every expense and settlement payment in the group', () => {
    const group = buildGroup({
      expenses: [buildExpense({ payerIds: undefined, payerId: 'voo' }) as Expense],
      settlementPayments: [buildPayment({ source: undefined })],
    })
    const result = normalizeGroup(group)
    expect(result.expenses[0].payerIds).toEqual(['voo'])
    expect(result.settlementPayments[0].source).toBe('record_payment')
  })

  it('defaults expenses and settlementPayments to empty arrays when missing or malformed', () => {
    const group = { ...buildGroup(), expenses: undefined, settlementPayments: null } as unknown as Group
    const result = normalizeGroup(group)
    expect(result.expenses).toEqual([])
    expect(result.settlementPayments).toEqual([])
  })
})
