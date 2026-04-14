import type { Expense, Split } from '../types'

export function isRefundExpense(expense: Expense): boolean {
  return expense.type === 'refund'
}

export function getSplitRepaidPayerIds(split: Split, payerIds: string[]): string[] {
  const validPayerIds = new Set(payerIds)
  return (split.repaidPayerIds ?? []).filter((payerId) => validPayerIds.has(payerId))
}

export function getSplitPairShareAmount(expense: Expense, split: Split): number {
  const amount = split.amount ?? 0
  const payerCount = Math.max(1, (expense.payerIds ?? []).length)
  return amount / payerCount
}

export function isRefundPairRepaid(expense: Expense, split: Split, payerId: string): boolean {
  if (!isRefundExpense(expense)) return split.repaid
  if (!(expense.payerIds ?? []).includes(payerId)) return false
  return split.repaid || getSplitRepaidPayerIds(split, expense.payerIds ?? []).includes(payerId)
}

export function getSplitOutstandingAmount(expense: Expense, split: Split): number {
  const amount = split.amount ?? 0
  if (amount <= 0) return 0
  if (!isRefundExpense(expense)) return split.repaid ? 0 : amount
  if (split.repaid) return 0

  const payerIds = expense.payerIds ?? []
  const payerCount = payerIds.length
  if (payerCount === 0) return amount

  const repaidPayerCount = getSplitRepaidPayerIds(split, payerIds).length
  const outstandingShareCount = Math.max(0, payerCount - repaidPayerCount)
  return amount * (outstandingShareCount / payerCount)
}

export function isSplitFullySettled(expense: Expense, split: Split): boolean {
  return getSplitOutstandingAmount(expense, split) <= 0.001
}
