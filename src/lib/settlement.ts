import type { Expense, Settlement } from '../types'

export function getSettlements(expenses: Expense[]): Settlement[] {
  const debts: Record<string, Record<string, Record<string, number>>> = {}

  for (const expense of expenses) {
    const payerId = expense.payerId
    for (const split of expense.splits) {
      if (split.personId === payerId || split.repaid) continue
      if (!debts[split.personId]) debts[split.personId] = {}
      if (!debts[split.personId][payerId]) debts[split.personId][payerId] = {}

      const currency = split.repayCurrency || expense.paidCurrency
      const addAmount = split.convertedAmount ?? split.amount
      if (addAmount == null || Number.isNaN(addAmount)) continue

      debts[split.personId][payerId][currency] = (debts[split.personId][payerId][currency] || 0) + addAmount
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
