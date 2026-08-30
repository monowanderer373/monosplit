import { describe, expect, it } from 'vitest'
import type { Expense, Group, Person } from '../types'
import { compileExpense, computeReceiptSummary, getActiveSplitPersonIds, type FormState } from './compileExpense'

function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'voo',
    name: 'Voo',
    avatarDataUrl: null,
    nameColor: null,
    paymentInfo: { qrCodeDataUrl: null, bankName: '', accountHolder: '', accountNumber: '', notes: '' },
    paymentProofs: [],
    ...overrides,
  }
}

function buildGroup(overrides: Partial<Group> = {}): Group {
  return {
    id: 'group-1',
    name: 'Trip',
    startDate: null,
    endDate: null,
    defaultPaidCurrency: 'JPY',
    defaultRepayCurrency: 'MYR',
    people: [buildPerson({ id: 'voo' }), buildPerson({ id: 'soon', name: 'Soon' })],
    expenses: [],
    settlementPayments: [],
    createdAt: '2026-04-23T00:00:00.000Z',
    ...overrides,
  }
}

function buildForm(overrides: Partial<FormState> = {}): FormState {
  return {
    expenseType: 'expense',
    category: 'Other',
    description: 'Dinner',
    payerIds: ['voo'],
    amount: '100',
    paidCurrency: 'JPY',
    repayCurrency: 'JPY',
    paymentMethod: 'card',
    splitMode: 'equal',
    splitPersonIds: ['voo', 'soon'],
    itemizedInputMode: 'pretax',
    itemizedInput: {},
    percentageInput: {},
    sharesInput: {},
    adjustmentInput: {},
    receiptItems: [],
    receiptTaxAmount: '',
    serviceTaxPct: '',
    salesTaxPct: '',
    tipsPct: '',
    rateMode: 'auto',
    manualRate: '',
    date: '2026-04-23',
    ...overrides,
  }
}

describe('compileExpense — happy paths', () => {
  it('compiles a valid equal-split expense', () => {
    const result = compileExpense(buildForm(), { group: buildGroup(), rateInfo: null })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.expense.amount).toBe(100)
    expect(result.expense.splitMode).toBe('equal')
    expect(result.expense.splits).toEqual([
      expect.objectContaining({ personId: 'voo', amount: 50 }),
      expect.objectContaining({ personId: 'soon', amount: 50 }),
    ])
  })

  it('compiles a refund using an equal split over the "paid back by" people, ignoring splitMode', () => {
    const form = buildForm({
      expenseType: 'refund',
      splitMode: 'itemized',
      payerIds: ['voo'],
      splitPersonIds: ['soon'],
    })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.expense.type).toBe('refund')
    expect(result.expense.category).toBe('Refund')
    expect(result.expense.splitMode).toBe('equal')
    expect(result.expense.splits).toEqual([expect.objectContaining({ personId: 'soon', amount: 100 })])
  })

  it('carries over repaid state from the previous version of the expense when editing', () => {
    const initialExpense: Expense = {
      id: 'expense-1',
      category: 'Other',
      description: 'Dinner',
      payerIds: ['voo'],
      amount: 100,
      paidCurrency: 'JPY',
      repayCurrency: 'JPY',
      paymentMethod: 'card',
      splitMode: 'equal',
      itemizedInputMode: null,
      serviceTaxPct: null,
      salesTaxPct: null,
      tipsPct: null,
      taxPctTotal: null,
      date: '2026-04-23',
      createdAt: '2026-04-23T00:00:00.000Z',
      splits: [
        { personId: 'voo', amount: 50, baseAmount: null, taxAmount: null, repayCurrency: 'JPY', convertedAmount: null, rate: null, rateSource: null, rateDate: null, repaid: true, repaidAt: '2026-04-24T00:00:00.000Z', repaidDate: '2026-04-24' },
        { personId: 'soon', amount: 50, baseAmount: null, taxAmount: null, repayCurrency: 'JPY', convertedAmount: null, rate: null, rateSource: null, rateDate: null, repaid: false, repaidAt: null, repaidDate: null },
      ],
    }

    const result = compileExpense(buildForm(), { group: buildGroup(), rateInfo: null, initialExpense })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    const vooSplit = result.expense.splits.find((s) => s.personId === 'voo')
    expect(vooSplit?.repaid).toBe(true)
    expect(vooSplit?.repaidAt).toBe('2026-04-24T00:00:00.000Z')
  })

  it('uses a manual rate to populate the converted amount', () => {
    const form = buildForm({ paidCurrency: 'JPY', repayCurrency: 'MYR', rateMode: 'manual', manualRate: '0.03' })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('expected ok result')
    expect(result.expense.splits[0].rate).toBe(0.03)
    expect(result.expense.splits[0].rateSource).toBe('manual')
    expect(result.expense.splits[0].convertedAmount).toBe(1.5)
  })
}) 

describe('compileExpense — validation', () => {
  it('rejects when the group has no travellers', () => {
    const result = compileExpense(buildForm(), { group: buildGroup({ people: [] }), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'no_travellers' })
  })

  it('rejects a blank description', () => {
    const result = compileExpense(buildForm({ description: '   ' }), { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'missing_description' })
  })

  it('rejects a non-positive amount', () => {
    const result = compileExpense(buildForm({ amount: '0' }), { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'invalid_amount' })
  })

  it('rejects when no payer is selected', () => {
    const result = compileExpense(buildForm({ payerIds: [] }), { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'missing_payer' })
  })

  it('rejects when no split person is selected', () => {
    const result = compileExpense(buildForm({ splitPersonIds: [] }), { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'missing_split' })
  })

  it('rejects itemized mode when nobody has entered a value yet (active split is empty)', () => {
    const form = buildForm({ splitMode: 'itemized', itemizedInput: {} })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'missing_split' })
  })

  it('rejects an itemized split that does not tally with the total amount', () => {
    const form = buildForm({
      splitMode: 'itemized',
      payerIds: ['voo'],
      itemizedInput: { voo: '40', soon: '40' },
    })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.errorKey).toBe('itemized_mismatch')
    if (result.errorKey === 'itemized_mismatch') expect(result.diff).toBe(20)
  })

  it('rejects itemized mode when a payer has not entered a value', () => {
    const form = buildForm({
      splitMode: 'itemized',
      payerIds: ['voo'],
      itemizedInput: { soon: '100' },
      amount: '100',
    })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'itemized_payer_missing_value' })
  })

  it('rejects a receipt split whose only item has an assigned debtor but no name (not "valid")', () => {
    // debtorIds alone keep getActiveSplitPersonIds non-empty, so this reaches the
    // receipt-specific check instead of being caught earlier by "missing_split".
    const form = buildForm({
      splitMode: 'receipt',
      receiptItems: [{ id: 'r1', name: '', unitPrice: '10', quantity: '1', debtorIds: ['voo'] }],
    })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'receipt_needs_item' })
  })

  it('rejects a receipt item that has a name but no assigned debtors', () => {
    const form = buildForm({
      splitMode: 'receipt',
      receiptItems: [
        { id: 'r1', name: 'Coffee', unitPrice: '10', quantity: '1', debtorIds: ['voo'] },
        { id: 'r2', name: 'Snack', unitPrice: '5', quantity: '1', debtorIds: [] },
      ],
    })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'receipt_invalid_item' })
  })

  it('rejects percentages that do not add up to 100', () => {
    const form = buildForm({ splitMode: 'percentage', percentageInput: { voo: '50', soon: '40' } })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.errorKey).toBe('percentage_mismatch')
    if (result.errorKey === 'percentage_mismatch') expect(result.totalPct).toBe(90)
  })

  it('rejects shares that are all zero (via the earlier "missing_split" guard, since nobody has an active share)', () => {
    // This mirrors the original ExpenseForm behaviour: getActiveSplitPersonIds already
    // filters out zero/blank shares, so the dedicated shares_all_zero check below it is
    // only reachable in states the UI cannot otherwise produce. We keep it for safety.
    const form = buildForm({ splitMode: 'shares', sharesInput: { voo: '0', soon: '0' } })
    const result = compileExpense(form, { group: buildGroup(), rateInfo: null })
    expect(result).toEqual({ ok: false, errorKey: 'missing_split' })
  })
})

describe('getActiveSplitPersonIds', () => {
  it('returns everyone for equal split', () => {
    const form = buildForm({ splitMode: 'equal', splitPersonIds: ['voo', 'soon'] })
    expect(getActiveSplitPersonIds(form)).toEqual(['voo', 'soon'])
  })

  it('only returns people with a positive itemized value', () => {
    const form = buildForm({ splitMode: 'itemized', splitPersonIds: ['voo', 'soon'], itemizedInput: { voo: '10' } })
    expect(getActiveSplitPersonIds(form)).toEqual(['voo'])
  })
})

describe('computeReceiptSummary', () => {
  it('sums valid items and the flat tax amount into a grand total', () => {
    const summary = computeReceiptSummary({
      amount: '110',
      receiptItems: [{ id: 'r1', name: 'Coffee', unitPrice: '10', quantity: '10', debtorIds: ['voo'] }],
      receiptTaxAmount: '10',
    })
    expect(summary.subtotal).toBe(100)
    expect(summary.taxAmount).toBe(10)
    expect(summary.grandTotal).toBe(110)
    expect(summary.diff).toBe(0)
  })
})
