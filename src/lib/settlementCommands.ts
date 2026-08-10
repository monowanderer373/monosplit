import type { SettlementPayment, SettlementPaymentAllocation, SettlementPaymentSource } from '../types'

/**
 * Settlement commands — the narrow, pure interface for "record a payment", "quick settle",
 * and "edit a payment". Each function validates a user's intent against the payment's own
 * FX budget and returns either the data ready to persist, or a typed error the caller maps
 * to a user-facing message. No I/O, no store access — callers own persistence.
 */

export type NewSettlementPayment = Omit<SettlementPayment, 'id' | 'createdAt' | 'updatedAt'>

export type SettlementCommandError = 'over_allocated' | 'nothing_to_pay' | 'invalid_amount'

export type SettlementCommandResult<T> = { ok: true; value: T } | { ok: false; error: SettlementCommandError }

function round4(value: number): number {
  return Number(value.toFixed(4))
}

function sanitizeAllocations(allocations: SettlementPaymentAllocation[]): SettlementPaymentAllocation[] {
  return allocations
    .map((allocation) => ({ creditorId: allocation.creditorId, amount: round4(allocation.amount || 0) }))
    .filter((allocation) => allocation.amount > 0.0001)
}

/** `rate` means "1 unit of `currency` = rate units of `repayCurrency`". */
function toDebtBudget(repayAmount: number, currency: string, repayCurrency: string, rate: number | null): number {
  if (repayCurrency !== currency && rate && rate > 0) return repayAmount / rate
  return repayAmount
}

function validateBudget(
  repayAmount: number,
  allocations: SettlementPaymentAllocation[],
  currency: string,
  repayCurrency: string,
  rate: number | null,
): SettlementCommandError | null {
  if (!Number.isFinite(repayAmount) || repayAmount < 0) return 'invalid_amount'
  const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
  if (totalAllocated <= 0.0001) return 'nothing_to_pay'
  const debtBudget = toDebtBudget(repayAmount, currency, repayCurrency, rate)
  if (round4(totalAllocated - debtBudget) > 0.001) return 'over_allocated'
  return null
}

export type RecordPaymentIntent = {
  debtorId: string
  currency: string
  repayCurrency: string
  repayAmount: number
  rate: number | null
  rateSource: string | null
  rateDate: string | null
  paymentDate: string
  allocations: SettlementPaymentAllocation[]
  note?: string | null
  source: Extract<SettlementPaymentSource, 'record_payment' | 'quick_settle'>
}

export function recordPayment(intent: RecordPaymentIntent): SettlementCommandResult<NewSettlementPayment> {
  const allocations = sanitizeAllocations(intent.allocations)
  const error = validateBudget(intent.repayAmount, allocations, intent.currency, intent.repayCurrency, intent.rate)
  if (error) return { ok: false, error }

  return {
    ok: true,
    value: {
      debtorId: intent.debtorId,
      currency: intent.currency,
      repayCurrency: intent.repayCurrency,
      repayAmount: round4(intent.repayAmount),
      rate: intent.rate,
      rateSource: intent.rateSource,
      rateDate: intent.rateDate,
      paymentDate: intent.paymentDate,
      allocations,
      note: intent.note ?? null,
      source: intent.source,
    },
  }
}

export type QuickSettleIntent = {
  debtorId: string
  creditorId: string
  currency: string
  amount: number
  paymentDate: string
}

export function quickSettle(intent: QuickSettleIntent): SettlementCommandResult<NewSettlementPayment> {
  return recordPayment({
    debtorId: intent.debtorId,
    currency: intent.currency,
    repayCurrency: intent.currency,
    repayAmount: intent.amount,
    rate: null,
    rateSource: null,
    rateDate: null,
    paymentDate: intent.paymentDate,
    allocations: [{ creditorId: intent.creditorId, amount: intent.amount }],
    note: null,
    source: 'quick_settle',
  })
}

export type EditPaymentIntent = {
  existingPayment: SettlementPayment
  repayAmount: number
  paymentDate: string
  allocations: SettlementPaymentAllocation[]
}

export type SettlementPaymentEdit = {
  paymentDate: string
  repayAmount: number
  allocations: SettlementPaymentAllocation[]
  source: Extract<SettlementPaymentSource, 'history_edit'>
}

export function editPayment(intent: EditPaymentIntent): SettlementCommandResult<SettlementPaymentEdit> {
  const { existingPayment } = intent
  const allocations = sanitizeAllocations(intent.allocations)
  const error = validateBudget(
    intent.repayAmount,
    allocations,
    existingPayment.currency,
    existingPayment.repayCurrency,
    existingPayment.rate,
  )
  if (error) return { ok: false, error }

  return {
    ok: true,
    value: {
      paymentDate: intent.paymentDate,
      repayAmount: round4(intent.repayAmount),
      allocations,
      source: 'history_edit',
    },
  }
}
