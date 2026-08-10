import type { Expense, Group, ReceiptItem, SettlementPayment, SettlementPaymentAllocation } from '../types'

/**
 * The single place that turns possibly-dirty Expense/SettlementPayment/Group data — from an old
 * localStorage schema, an inbound Supabase sync payload, or a stale in-memory shape — into the
 * current schema. Called by the persist `migrate` steps, inbound sync (`replaceGroup`/`upsertGroup`),
 * outbound `partialize`, and `settlementLedger`. No I/O, no group-membership pruning — see
 * docs/adr for why orphan-reference pruning stays a separate, partialize-only step.
 */

function round4(value: number): number {
  return Number(value.toFixed(4))
}

export function normalizeCurrencyCode(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase()
}

function migrateExpensePayerIds(expense: Expense & { payerId?: string }): Expense {
  if (expense.payerIds && expense.payerIds.length > 0) return expense as Expense
  const legacyId = expense.payerId
  if (legacyId) {
    const rest = { ...expense }
    delete rest.payerId
    return { ...rest, payerIds: [legacyId] } as Expense
  }
  return { ...expense, payerIds: expense.payerIds ?? [] } as Expense
}

function sanitizeReceiptItems(items: unknown): ReceiptItem[] | null {
  if (!Array.isArray(items)) return null
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `receipt-item-${index}`,
      name: typeof item.name === 'string' ? item.name : '',
      unitPrice: typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) ? item.unitPrice : null,
      quantity: typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : null,
      amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : null,
      debtorIds: Array.isArray(item.debtorIds)
        ? Array.from(new Set(item.debtorIds.filter((id): id is string => typeof id === 'string')))
        : [],
    }))
}

export function normalizeExpense(expense: Expense & { payerId?: string }): Expense {
  const migrated = migrateExpensePayerIds(expense)
  return {
    ...migrated,
    receiptItems: sanitizeReceiptItems(migrated.receiptItems),
    receiptTaxAmount:
      typeof migrated.receiptTaxAmount === 'number' && Number.isFinite(migrated.receiptTaxAmount)
        ? migrated.receiptTaxAmount
        : null,
  }
}

function normalizeAllocation(allocation: SettlementPaymentAllocation): SettlementPaymentAllocation {
  const amount = typeof allocation.amount === 'number' && Number.isFinite(allocation.amount) ? allocation.amount : 0
  return { creditorId: allocation.creditorId, amount: Math.max(0, round4(amount)) }
}

export function normalizeSettlementPayment(payment: SettlementPayment): SettlementPayment {
  const currency = normalizeCurrencyCode(payment.currency) || normalizeCurrencyCode(payment.repayCurrency)
  const repayAmount =
    typeof payment.repayAmount === 'number' && Number.isFinite(payment.repayAmount) ? payment.repayAmount : 0
  return {
    ...payment,
    currency,
    repayAmount: Math.max(0, round4(repayAmount)),
    rate: typeof payment.rate === 'number' && Number.isFinite(payment.rate) ? payment.rate : null,
    rateSource: payment.rateSource ?? null,
    rateDate: payment.rateDate ?? null,
    note: payment.note ?? null,
    source: payment.source ?? 'record_payment',
    allocations: (Array.isArray(payment.allocations) ? payment.allocations : [])
      .map(normalizeAllocation)
      .filter((allocation) => allocation.amount > 0.0001),
  }
}

export function normalizeGroup(group: Group): Group {
  return {
    ...group,
    expenses: Array.isArray(group.expenses)
      ? group.expenses.map((expense) => normalizeExpense(expense as Expense & { payerId?: string }))
      : [],
    settlementPayments: Array.isArray(group.settlementPayments)
      ? group.settlementPayments.map((payment) => normalizeSettlementPayment(payment as SettlementPayment))
      : [],
  }
}
