import { getSplitPairShareAmount, getSplitRepaidPayerIds, isRefundExpense } from './refund'
import type { Expense, Settlement } from '../types'

export function getSettlements(expenses: Expense[]): Settlement[] {
  const debts: Record<string, Record<string, Record<string, number>>> = {}

  for (const expense of expenses) {
    const payerIds = expense.payerIds ?? []

    for (const split of expense.splits) {
      if (payerIds.includes(split.personId) || split.repaid) continue

      // Always use the recorded paid currency — repayment conversion is handled in the UI
      const currency = expense.paidCurrency
      const totalOwed = split.amount
      if (totalOwed == null || Number.isNaN(totalOwed)) continue

      const settledPayerIds = isRefundExpense(expense)
        ? new Set(getSplitRepaidPayerIds(split, payerIds))
        : new Set<string>()
      const activePayerIds = isRefundExpense(expense)
        ? payerIds.filter((payerId) => !settledPayerIds.has(payerId))
        : payerIds
      const perPayer = getSplitPairShareAmount(expense, split)

      for (const payerId of activePayerIds) {
        if (!debts[split.personId]) debts[split.personId] = {}
        if (!debts[split.personId][payerId]) debts[split.personId][payerId] = {}
        debts[split.personId][payerId][currency] = (debts[split.personId][payerId][currency] || 0) + perPayer
      }
    }
  }

  const settlements: Settlement[] = []
  for (const [debtorId, creditors] of Object.entries(debts)) {
    for (const [creditorId, currencies] of Object.entries(creditors)) {
      for (const [currency, amount] of Object.entries(currencies)) {
        if (amount > 0.001) settlements.push({ debtorId, creditorId, currency, amount })
      }
    }
  }
  return settlements
}
