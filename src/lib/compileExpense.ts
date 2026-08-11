import type {
  Expense,
  ExpenseType,
  Group,
  ItemizedInputMode,
  PaymentMethod,
  RateMode,
  ReceiptItem,
  Split,
  SplitMode,
} from '../types'
import type { ReceiptItemInput } from '../components/AdjustSplitSheet'
import type { RateResult } from './currency'
import { normalizeCategory } from './categories'
import {
  calcAdjustmentSplits,
  calcEqualSplits,
  calcItemizedSplits,
  calcPercentageSplits,
  calcReceiptGrandTotal,
  calcReceiptSplits,
  calcReceiptSubtotal,
  calcSharesSplits,
  assertPayerHasItemizedValue,
  getReceiptItemAmount,
  mergeRepaidState,
} from './splitCalc'

/**
 * Everything the "add/edit expense" wizard needs to hold in state.
 * This is the canonical definition — UI components import it from here.
 */
export type FormState = {
  expenseType: ExpenseType
  category: string
  description: string
  payerIds: string[]
  amount: string
  paidCurrency: string
  repayCurrency: string
  paymentMethod: PaymentMethod
  splitMode: SplitMode
  splitPersonIds: string[]
  itemizedInputMode: ItemizedInputMode
  itemizedInput: Record<string, string>
  percentageInput: Record<string, string>
  sharesInput: Record<string, string>
  adjustmentInput: Record<string, string>
  receiptItems: ReceiptItemInput[]
  receiptTaxAmount: string
  serviceTaxPct: string
  salesTaxPct: string
  tipsPct: string
  rateMode: RateMode
  manualRate: string
  date: string
}

export type CompileExpenseContext = {
  group: Group
  rateInfo: RateResult | null
  initialExpense?: Expense | null
}

export type ItemizedSummary = {
  enteredTotal: number
  enteredTaxIncTotal: number
  filledCount: number
  diff: number | null
  hasExpenseAmount: boolean
  preTaxBudget: number | null
  isPretaxMode: boolean
}

export type ReceiptSummary = {
  parsedItems: ReceiptItem[]
  validItems: ReceiptItem[]
  subtotal: number
  taxAmount: number
  grandTotal: number
  filledCount: number
  diff: number | null
  hasAmount: boolean
}

export type ExpenseCompileErrorKey =
  | 'no_travellers'
  | 'missing_description'
  | 'invalid_amount'
  | 'missing_payer'
  | 'missing_split'
  | 'itemized_mismatch'
  | 'receipt_needs_item'
  | 'receipt_invalid_item'
  | 'percentage_mismatch'
  | 'shares_all_zero'
  | 'itemized_payer_missing_value'

export type CompileExpenseError =
  | { errorKey: 'itemized_mismatch'; diff: number }
  | { errorKey: 'percentage_mismatch'; totalPct: number }
  | { errorKey: Exclude<ExpenseCompileErrorKey, 'itemized_mismatch' | 'percentage_mismatch'> }

export type CompileExpenseResult =
  | { ok: true; expense: Omit<Expense, 'id' | 'createdAt'> }
  | ({ ok: false } & CompileExpenseError)

export function getTotalTaxPct(form: Pick<FormState, 'serviceTaxPct' | 'salesTaxPct' | 'tipsPct'>): number {
  return Number(form.serviceTaxPct || '0') + Number(form.salesTaxPct || '0') + Number(form.tipsPct || '0')
}

export function computeEffectiveRate(
  form: Pick<FormState, 'paidCurrency' | 'repayCurrency' | 'rateMode' | 'manualRate'>,
  rateInfo: RateResult | null,
): number | null {
  if (form.paidCurrency === form.repayCurrency) return 1
  if (form.rateMode === 'manual') {
    const value = Number(form.manualRate)
    return Number.isFinite(value) && value > 0 ? value : null
  }
  return rateInfo?.rate ?? null
}

export function getActiveSplitPersonIds(form: FormState): string[] {
  if (form.expenseType === 'refund' || form.splitMode === 'equal') return form.splitPersonIds

  if (form.splitMode === 'receipt') {
    const ids = new Set<string>()
    form.receiptItems.forEach((item) => {
      item.debtorIds.forEach((personId) => ids.add(personId))
    })
    return Array.from(ids)
  }

  if (form.splitMode === 'itemized') {
    return form.splitPersonIds.filter((personId) => {
      const raw = form.itemizedInput[personId]
      if (raw == null || raw === '') return false
      const value = Number(raw)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'percentage') {
    return form.splitPersonIds.filter((personId) => {
      const value = Number(form.percentageInput[personId] || 0)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'shares') {
    return form.splitPersonIds.filter((personId) => {
      const value = Number(form.sharesInput[personId] || 0)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'adjustment') {
    return form.splitPersonIds.filter((personId) => hasFiniteNumberInput(form.adjustmentInput[personId]))
  }

  return form.splitPersonIds
}

function hasFiniteNumberInput(raw: string | undefined): boolean {
  if (raw == null || raw === '') return false
  const value = Number(raw)
  return Number.isFinite(value)
}

export function parseReceiptItemInputs(items: ReceiptItemInput[]): ReceiptItem[] {
  return items.map((item) => {
    const unitPrice = item.unitPrice.trim() === '' ? null : Number(item.unitPrice)
    const quantity = item.quantity.trim() === '' ? null : Number(item.quantity)
    return {
      id: item.id,
      name: item.name.trim(),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      quantity: Number.isFinite(quantity) ? quantity : null,
      amount: null,
      debtorIds: item.debtorIds,
    }
  })
}

export function computeItemizedSummary(
  form: Pick<FormState, 'amount' | 'itemizedInput' | 'itemizedInputMode' | 'splitMode' | 'splitPersonIds'>,
  totalTaxPct: number,
): ItemizedSummary | null {
  if (form.splitMode !== 'itemized') return null
  const expenseAmount = Number(form.amount)
  const taxFactor = totalTaxPct / 100
  const hasExpenseAmount = Number.isFinite(expenseAmount) && expenseAmount > 0

  let enteredPreTaxSum = 0
  let enteredTaxIncSum = 0
  let filledCount = 0

  for (const personId of form.splitPersonIds) {
    const raw = form.itemizedInput[personId]
    if (raw == null || raw === '') continue
    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) continue
    filledCount += 1
    if (form.itemizedInputMode === 'total') {
      enteredTaxIncSum += value
      enteredPreTaxSum += value / (1 + taxFactor)
    } else {
      enteredPreTaxSum += value
      enteredTaxIncSum += value * (1 + taxFactor)
    }
  }

  const preTaxBudget = hasExpenseAmount && taxFactor > 0
    ? Number((expenseAmount / (1 + taxFactor)).toFixed(2))
    : hasExpenseAmount ? expenseAmount : null

  const isPretaxMode = form.itemizedInputMode === 'pretax'
  const displayTotal = isPretaxMode
    ? Number(enteredPreTaxSum.toFixed(2))
    : Number(enteredTaxIncSum.toFixed(2))
  const compareTarget = isPretaxMode ? preTaxBudget : (hasExpenseAmount ? expenseAmount : null)
  const diff = compareTarget != null ? Number((compareTarget - displayTotal).toFixed(2)) : null

  return {
    enteredTotal: displayTotal,
    enteredTaxIncTotal: Number(enteredTaxIncSum.toFixed(2)),
    filledCount,
    diff,
    hasExpenseAmount,
    preTaxBudget,
    isPretaxMode,
  }
}

export function computeReceiptSummary(
  form: Pick<FormState, 'amount' | 'receiptItems' | 'receiptTaxAmount'>,
): ReceiptSummary {
  const parsedItems = parseReceiptItemInputs(form.receiptItems)
  const validItems = parsedItems.filter((item) => item.name && item.debtorIds.length > 0 && getReceiptItemAmount(item) > 0)
  const subtotal = Number(calcReceiptSubtotal(validItems).toFixed(2))
  const taxAmountRaw = Number(form.receiptTaxAmount || 0)
  const taxAmount = Number.isFinite(taxAmountRaw) && taxAmountRaw > 0 ? Number(taxAmountRaw.toFixed(2)) : 0
  const grandTotal = Number(calcReceiptGrandTotal(validItems, taxAmount).toFixed(2))
  const amountValue = Number(form.amount)
  const hasAmount = Number.isFinite(amountValue) && amountValue > 0
  const diff = hasAmount ? Number((amountValue - grandTotal).toFixed(2)) : null
  return {
    parsedItems,
    validItems,
    subtotal,
    taxAmount,
    grandTotal,
    filledCount: validItems.length,
    diff,
    hasAmount,
  }
}

/**
 * Validates the wizard form and assembles the Expense payload to save.
 * Pure: no DOM/localStorage/network access, no side effects.
 */
export function compileExpense(form: FormState, ctx: CompileExpenseContext): CompileExpenseResult {
  const { group, rateInfo, initialExpense = null } = ctx

  const totalTaxPct = getTotalTaxPct(form)
  const itemizedSummary = computeItemizedSummary(form, totalTaxPct)
  const receiptSummary = computeReceiptSummary(form)
  const activeSplitPersonIds = getActiveSplitPersonIds(form)

  if (group.people.length === 0) return { ok: false, errorKey: 'no_travellers' }
  if (!form.description.trim()) return { ok: false, errorKey: 'missing_description' }

  const amount = Number(form.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, errorKey: 'invalid_amount' }
  if (form.payerIds.length === 0) return { ok: false, errorKey: 'missing_payer' }
  if (form.splitPersonIds.length === 0) return { ok: false, errorKey: 'missing_split' }
  if (activeSplitPersonIds.length === 0) return { ok: false, errorKey: 'missing_split' }

  if (
    form.expenseType !== 'refund' &&
    form.splitMode === 'itemized' &&
    itemizedSummary?.hasExpenseAmount &&
    itemizedSummary.diff != null &&
    Math.abs(itemizedSummary.diff) > 0.5
  ) {
    return { ok: false, errorKey: 'itemized_mismatch', diff: itemizedSummary.diff }
  }

  if (form.expenseType !== 'refund' && form.splitMode === 'receipt') {
    if (receiptSummary.validItems.length === 0) return { ok: false, errorKey: 'receipt_needs_item' }

    const invalidItem = receiptSummary.parsedItems.find((item) => {
      if (!item.name.trim()) return false
      const lineAmount = getReceiptItemAmount(item)
      return lineAmount <= 0 || item.debtorIds.length === 0
    })
    if (invalidItem) return { ok: false, errorKey: 'receipt_invalid_item' }
  }

  if (form.splitMode === 'percentage') {
    const totalPct = form.splitPersonIds.reduce((s, pid) => s + Number(form.percentageInput[pid] || 0), 0)
    if (Math.abs(totalPct - 100) > 0.5) return { ok: false, errorKey: 'percentage_mismatch', totalPct }
  }

  if (form.splitMode === 'shares') {
    const totalShares = form.splitPersonIds.reduce(
      (s, pid) => s + Math.max(0, Number(form.sharesInput[pid] || 0)),
      0,
    )
    if (totalShares <= 0) return { ok: false, errorKey: 'shares_all_zero' }
  }

  if (form.expenseType !== 'refund' && form.splitMode === 'itemized') {
    const payerMissingValue = form.payerIds.some((pid) => !assertPayerHasItemizedValue(pid, form.itemizedInput))
    if (payerMissingValue) return { ok: false, errorKey: 'itemized_payer_missing_value' }
  }

  const effectiveRate = computeEffectiveRate(form, rateInfo)
  const commonArgs = {
    repayCurrency: form.repayCurrency,
    rate: effectiveRate,
    rateSource: form.rateMode === 'manual' ? 'manual' : rateInfo?.source ?? null,
    rateDate: form.rateMode === 'manual' ? form.date : rateInfo?.date ?? null,
  }

  let splits: Split[]
  if (form.expenseType === 'refund') {
    splits = calcEqualSplits({ peopleIds: form.splitPersonIds, totalAmount: amount, ...commonArgs })
  } else if (form.splitMode === 'itemized') {
    splits = calcItemizedSplits({
      peopleIds: activeSplitPersonIds,
      itemizedInput: form.itemizedInput,
      itemizedInputMode: form.itemizedInputMode,
      serviceTaxPct: Number(form.serviceTaxPct || '0'),
      salesTaxPct: Number(form.salesTaxPct || '0'),
      tipsPct: Number(form.tipsPct || '0'),
      ...commonArgs,
    })
  } else if (form.splitMode === 'percentage') {
    splits = calcPercentageSplits({
      peopleIds: activeSplitPersonIds,
      percentageInput: form.percentageInput,
      totalAmount: amount,
      ...commonArgs,
    })
  } else if (form.splitMode === 'shares') {
    splits = calcSharesSplits({
      peopleIds: activeSplitPersonIds,
      sharesInput: form.sharesInput,
      totalAmount: amount,
      ...commonArgs,
    })
  } else if (form.splitMode === 'adjustment') {
    splits = calcAdjustmentSplits({
      peopleIds: activeSplitPersonIds,
      adjustmentInput: form.adjustmentInput,
      totalAmount: amount,
      ...commonArgs,
    })
  } else if (form.splitMode === 'receipt') {
    splits = calcReceiptSplits({
      receiptItems: receiptSummary.validItems,
      receiptTaxAmount: receiptSummary.taxAmount,
      ...commonArgs,
    })
  } else {
    splits = calcEqualSplits({
      peopleIds: form.splitPersonIds,
      totalAmount: amount,
      ...commonArgs,
    })
  }

  if (initialExpense) {
    splits = mergeRepaidState(splits, initialExpense.splits)
  }

  const expense: Omit<Expense, 'id' | 'createdAt'> = {
    type: form.expenseType,
    category: form.expenseType === 'refund' ? 'Refund' : normalizeCategory(form.category),
    description: form.description.trim(),
    payerIds: form.payerIds,
    amount,
    paidCurrency: form.paidCurrency,
    repayCurrency: form.repayCurrency,
    paymentMethod: form.paymentMethod,
    splitMode: form.expenseType === 'refund' ? 'equal' : form.splitMode,
    itemizedInputMode: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? form.itemizedInputMode : null,
    serviceTaxPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.serviceTaxPct || '0') : null,
    salesTaxPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.salesTaxPct || '0') : null,
    tipsPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.tipsPct || '0') : null,
    taxPctTotal: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? totalTaxPct : null,
    receiptItems: form.splitMode === 'receipt' && form.expenseType !== 'refund' ? receiptSummary.validItems : null,
    receiptTaxAmount: form.splitMode === 'receipt' && form.expenseType !== 'refund' ? receiptSummary.taxAmount : null,
    date: form.date,
    splits,
  }

  return { ok: true, expense }
}
