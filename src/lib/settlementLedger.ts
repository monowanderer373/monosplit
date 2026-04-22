import type {
  Expense,
  Group,
  Settlement,
  SettlementPayment,
  SettlementPaymentAllocation,
} from '../types'
import { getSplitPairShareAmount, getSplitRepaidPayerIds, isRefundExpense } from './refund'

type DebtLine = {
  expenseId: string
  splitIndex: number
  debtorId: string
  creditorId: string
  currency: string
  amount: number
  sortOrder: number
}

export type SettlementCounterpartyBalance = {
  creditorId: string
  currency: string
  directAmount: number
  reverseAmount: number
  netAmount: number
}

export type SettlementPaymentAllocationSummary = SettlementPaymentAllocation & {
  appliedAmount: number
}

export type SettlementPaymentSummary = {
  payment: SettlementPayment
  totalAllocated: number
  totalApplied: number
  unappliedAmount: number
  allocations: SettlementPaymentAllocationSummary[]
}

export type SettlementSnapshot = {
  settlements: Settlement[]
  splitOutstanding: Record<string, number>
  paymentSummaries: SettlementPaymentSummary[]
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

function splitKey(expenseId: string, splitIndex: number): string {
  return `${expenseId}::${splitIndex}`
}

function sanitizeAllocation(allocation: SettlementPaymentAllocation): SettlementPaymentAllocation {
  return {
    creditorId: allocation.creditorId,
    amount: Math.max(0, round4(allocation.amount || 0)),
  }
}

function sanitizePayment(payment: SettlementPayment): SettlementPayment {
  return {
    ...payment,
    repayAmount: Math.max(0, round4(payment.repayAmount || 0)),
    allocations: (payment.allocations || []).map(sanitizeAllocation).filter((allocation) => allocation.amount > 0.0001),
    note: payment.note ?? null,
    rate: payment.rate ?? null,
    rateSource: payment.rateSource ?? null,
    rateDate: payment.rateDate ?? null,
  }
}

function getBaseDebtLines(expenses: Expense[]): { lines: DebtLine[]; splitOutstanding: Record<string, number> } {
  const lines: DebtLine[] = []
  const splitOutstanding: Record<string, number> = {}

  const sortedExpenses = expenses
    .slice()
    .sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime())

  sortedExpenses.forEach((expense, expenseOrder) => {
    const payerIds = expense.payerIds ?? []
    expense.splits.forEach((split, splitIndex) => {
      const key = splitKey(expense.id, splitIndex)
      if (payerIds.includes(split.personId) || split.amount == null) {
        splitOutstanding[key] = 0
        return
      }
      if (split.repaid) {
        splitOutstanding[key] = 0
        return
      }

      const activePayerIds = isRefundExpense(expense)
        ? payerIds.filter((payerId) => !getSplitRepaidPayerIds(split, payerIds).includes(payerId))
        : payerIds
      if (activePayerIds.length === 0) {
        splitOutstanding[key] = 0
        return
      }

      let totalForSplit = 0
      activePayerIds.forEach((payerId, payerOrder) => {
        const amount = round4(getSplitPairShareAmount(expense, split))
        if (amount <= 0.0001) return
        totalForSplit += amount
        lines.push({
          expenseId: expense.id,
          splitIndex,
          debtorId: split.personId,
          creditorId: payerId,
          currency: expense.paidCurrency,
          amount,
          sortOrder: expenseOrder * 1000 + splitIndex * 10 + payerOrder,
        })
      })
      splitOutstanding[key] = round4(totalForSplit)
    })
  })

  return { lines, splitOutstanding }
}

export function createSettlementSnapshot(args: {
  expenses: Expense[]
  settlementPayments?: SettlementPayment[]
}): SettlementSnapshot {
  const { lines, splitOutstanding: baseOutstanding } = getBaseDebtLines(args.expenses)
  const remainingByLine = new Map<string, number>()
  lines.forEach((line) => {
    remainingByLine.set(`${line.expenseId}:${line.splitIndex}:${line.creditorId}`, line.amount)
  })

  const lineBuckets = new Map<string, DebtLine[]>()
  lines.forEach((line) => {
    const key = `${line.debtorId}:${line.creditorId}:${line.currency}`
    const current = lineBuckets.get(key) ?? []
    current.push(line)
    lineBuckets.set(key, current)
  })
  lineBuckets.forEach((bucket) => bucket.sort((a, b) => a.sortOrder - b.sortOrder))

  const paymentSummaries: SettlementPaymentSummary[] = []
  const sortedPayments = (args.settlementPayments ?? [])
    .map(sanitizePayment)
    .sort((a, b) => new Date(a.paymentDate || a.createdAt).getTime() - new Date(b.paymentDate || b.createdAt).getTime())

  sortedPayments.forEach((payment) => {
    const allocationSummaries: SettlementPaymentAllocationSummary[] = []
    let totalAllocated = 0
    let totalApplied = 0

    payment.allocations.forEach((allocation) => {
      const requested = round4(allocation.amount)
      totalAllocated += requested
      let remainingRequest = requested
      const bucket = lineBuckets.get(`${payment.debtorId}:${allocation.creditorId}:${payment.currency}`) ?? []
      for (const line of bucket) {
        if (remainingRequest <= 0.0001) break
        const lineKey = `${line.expenseId}:${line.splitIndex}:${line.creditorId}`
        const lineRemaining = remainingByLine.get(lineKey) ?? 0
        if (lineRemaining <= 0.0001) continue
        const applied = Math.min(lineRemaining, remainingRequest)
        remainingByLine.set(lineKey, round4(lineRemaining - applied))
        remainingRequest = round4(remainingRequest - applied)
        totalApplied += applied
      }
      allocationSummaries.push({
        creditorId: allocation.creditorId,
        amount: requested,
        appliedAmount: round4(requested - remainingRequest),
      })
    })

    paymentSummaries.push({
      payment,
      totalAllocated: round4(totalAllocated),
      totalApplied: round4(totalApplied),
      unappliedAmount: round4(totalAllocated - totalApplied),
      allocations: allocationSummaries,
    })
  })

  const splitOutstanding = { ...baseOutstanding }
  lines.forEach((line) => {
    const key = splitKey(line.expenseId, line.splitIndex)
    const lineKey = `${line.expenseId}:${line.splitIndex}:${line.creditorId}`
    splitOutstanding[key] = round4((splitOutstanding[key] ?? 0) - (line.amount - (remainingByLine.get(lineKey) ?? 0)))
  })

  const pairTotals = new Map<string, number>()
  lines.forEach((line) => {
    const lineKey = `${line.expenseId}:${line.splitIndex}:${line.creditorId}`
    const remaining = remainingByLine.get(lineKey) ?? 0
    if (remaining <= 0.0001) return
    const key = `${line.debtorId}|${line.creditorId}|${line.currency}`
    pairTotals.set(key, round4((pairTotals.get(key) ?? 0) + remaining))
  })

  const settlements: Settlement[] = []
  pairTotals.forEach((amount, key) => {
    if (amount <= 0.0001) return
    const [debtorId, creditorId, currency] = key.split('|')
    settlements.push({ debtorId, creditorId, currency, amount })
  })

  return {
    settlements: settlements.sort((a, b) =>
      `${a.debtorId}|${a.creditorId}|${a.currency}`.localeCompare(`${b.debtorId}|${b.creditorId}|${b.currency}`),
    ),
    splitOutstanding,
    paymentSummaries: paymentSummaries.sort(
      (a, b) => new Date(b.payment.updatedAt).getTime() - new Date(a.payment.updatedAt).getTime(),
    ),
  }
}

export function createGroupSettlementSnapshot(group: Group): SettlementSnapshot {
  return createSettlementSnapshot({
    expenses: group.expenses,
    settlementPayments: group.settlementPayments,
  })
}

export function getSettlementPairOutstanding(
  snapshot: SettlementSnapshot,
  debtorId: string,
  creditorId: string,
  currency: string,
): number {
  return (
    snapshot.settlements.find(
      (settlement) =>
        settlement.debtorId === debtorId &&
        settlement.creditorId === creditorId &&
        settlement.currency === currency,
    )?.amount ?? 0
  )
}

export function getCounterpartyBalances(
  snapshot: SettlementSnapshot,
  debtorId: string,
  currency: string,
): SettlementCounterpartyBalance[] {
  const creditorIds = new Set<string>()
  snapshot.settlements.forEach((settlement) => {
    if (settlement.currency !== currency) return
    if (settlement.debtorId === debtorId) creditorIds.add(settlement.creditorId)
    if (settlement.creditorId === debtorId) creditorIds.add(settlement.debtorId)
  })

  return [...creditorIds]
    .map((creditorId) => {
      const directAmount = getSettlementPairOutstanding(snapshot, debtorId, creditorId, currency)
      const reverseAmount = getSettlementPairOutstanding(snapshot, creditorId, debtorId, currency)
      return {
        creditorId,
        currency,
        directAmount,
        reverseAmount,
        netAmount: round4(Math.max(0, directAmount - reverseAmount)),
      }
    })
    .filter((row) => row.directAmount > 0.0001 || row.reverseAmount > 0.0001)
    .sort((a, b) => b.netAmount - a.netAmount || b.directAmount - a.directAmount)
}

export function autoAllocateSettlement(
  balances: Array<{ creditorId: string; amount: number }>,
  totalAmount: number,
): SettlementPaymentAllocation[] {
  const normalized = balances
    .map((balance) => ({ creditorId: balance.creditorId, amount: Math.max(0, round4(balance.amount)) }))
    .filter((balance) => balance.amount > 0.0001)

  const totalOutstanding = normalized.reduce((sum, balance) => sum + balance.amount, 0)
  let remainingBudget = Math.max(0, round4(totalAmount))
  if (normalized.length === 0 || remainingBudget <= 0.0001 || totalOutstanding <= 0.0001) {
    return normalized.map((balance) => ({ creditorId: balance.creditorId, amount: 0 }))
  }
  if (remainingBudget >= totalOutstanding) {
    return normalized.map((balance) => ({ creditorId: balance.creditorId, amount: balance.amount }))
  }

  const allocations = new Map<string, number>()
  normalized.forEach((balance) => allocations.set(balance.creditorId, 0))
  let active = normalized.map((balance) => ({ ...balance }))

  while (remainingBudget > 0.0001 && active.length > 0) {
    const activeOutstanding = active.reduce((sum, balance) => sum + balance.amount, 0)
    if (activeOutstanding <= 0.0001) break

    active.forEach((balance, index) => {
      if (remainingBudget <= 0.0001) return
      const proposed =
        index === active.length - 1
          ? remainingBudget
          : round4((remainingBudget * balance.amount) / activeOutstanding)
      const nextAmount = Math.min(balance.amount, proposed)
      allocations.set(balance.creditorId, round4((allocations.get(balance.creditorId) ?? 0) + nextAmount))
      balance.amount = round4(balance.amount - nextAmount)
      remainingBudget = round4(remainingBudget - nextAmount)
    })

    active = active.filter((balance) => balance.amount > 0.0001)
  }

  return normalized.map((balance) => ({
    creditorId: balance.creditorId,
    amount: round4(allocations.get(balance.creditorId) ?? 0),
  }))
}

export function getSplitOutstandingAmountFromSnapshot(
  snapshot: SettlementSnapshot,
  expenseId: string,
  splitIndex: number,
): number {
  return Math.max(0, round4(snapshot.splitOutstanding[splitKey(expenseId, splitIndex)] ?? 0))
}

export function isSplitFullySettledFromSnapshot(
  snapshot: SettlementSnapshot,
  expenseId: string,
  splitIndex: number,
): boolean {
  return getSplitOutstandingAmountFromSnapshot(snapshot, expenseId, splitIndex) <= 0.001
}
