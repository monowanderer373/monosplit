import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'
import type {
  SettlementAttribution,
} from './relationalBalance'
import type {
  SettlementAllocation,
  SettlementPayment,
} from './settlementRepository'

export class FinancialHistoryError extends Error {
  readonly code = 'financial_invariant_violation'

  constructor() {
    super('financial_invariant_violation')
    this.name = 'FinancialHistoryError'
  }
}

export type ExpenseHistoryLifecycle =
  | 'active'
  | 'proposal_candidate'
  | 'corrected'
  | 'cancelled'
  | 'legacy_voided'

export type ExpenseRevisionEntry = {
  chainId: string
  expense: CanonicalExpense
  role: 'standalone' | 'original' | 'correction'
  lifecycle: ExpenseHistoryLifecycle
  previousExpenseId: string | null
  nextExpenseId: string | null
  previousVisible: boolean
  nextVisible: boolean
  isCurrent: boolean
}

export function deriveExpenseRevisionEntries(
  expenses: readonly CanonicalExpense[],
  directRequests: readonly DirectExpenseChangeRequest[],
): ExpenseRevisionEntry[] {
  const byId = new Map<string, CanonicalExpense>()
  for (const expense of expenses) {
    if (byId.has(expense.id)) throw new FinancialHistoryError()
    byId.set(expense.id, expense)
    if (expense.status === 'correction_pending' && expense.correctsExpenseId) {
      throw new FinancialHistoryError()
    }
  }

  const childByParent = new Map<string, CanonicalExpense>()
  const nonAuthoritativeCandidateIds = new Set(directRequests.flatMap((request) => (
    request.kind === 'correction'
    && request.state !== 'authoritative'
    && request.replacementExpenseId
      ? [request.replacementExpenseId]
      : []
  )))
  for (const child of expenses) {
    if (!child.correctsExpenseId) continue
    const existing = childByParent.get(child.correctsExpenseId)
    if (existing && existing.id !== child.id) throw new FinancialHistoryError()
    childByParent.set(child.correctsExpenseId, child)
    const parent = byId.get(child.correctsExpenseId)
    if (!parent) continue
    if (
      parent.status !== 'voided'
      || parent.terminationKind !== 'corrected'
      || parent.scope !== child.scope
      || parent.currency !== child.currency
    ) throw new FinancialHistoryError()
    if (child.scope === 'direct') {
      const authority = directRequests.find((request) => (
        request.kind === 'correction'
        && request.state === 'authoritative'
        && request.targetExpenseId === parent.id
        && request.replacementExpenseId === child.id
      ))
      if (!authority) throw new FinancialHistoryError()
    }
  }

  for (const request of directRequests) {
    if (
      request.kind !== 'correction'
      || request.state !== 'authoritative'
      || !request.replacementExpenseId
    ) continue
    const target = byId.get(request.targetExpenseId)
    const replacement = byId.get(request.replacementExpenseId)
    if (target && replacement && replacement.correctsExpenseId !== target.id) {
      throw new FinancialHistoryError()
    }
  }

  const entries: ExpenseRevisionEntry[] = []
  const visited = new Set<string>()
  const authoritativeReplacementByTarget = new Map(directRequests.flatMap((request) => (
    request.kind === 'correction'
    && request.state === 'authoritative'
    && request.replacementExpenseId
      ? [[request.targetExpenseId, request.replacementExpenseId] as const]
      : []
  )))
  const roots = expenses.filter((expense) => (
    !expense.correctsExpenseId || !byId.has(expense.correctsExpenseId)
  ))

  for (const root of roots) {
    const chain: CanonicalExpense[] = []
    const chainSeen = new Set<string>()
    let current: CanonicalExpense | undefined = root
    while (current) {
      if (chainSeen.has(current.id)) throw new FinancialHistoryError()
      chainSeen.add(current.id)
      visited.add(current.id)
      chain.push(current)
      current = childByParent.get(current.id)
    }
    entries.push(...chain.map((expense, index): ExpenseRevisionEntry => ({
      chainId: root.id,
      expense,
      role: chain.length === 1
        ? 'standalone'
        : index === 0
          ? 'original'
          : 'correction',
      lifecycle: expenseLifecycle(expense, nonAuthoritativeCandidateIds),
      previousExpenseId: expense.correctsExpenseId,
      nextExpenseId: chain[index + 1]?.id
        ?? authoritativeReplacementByTarget.get(expense.id)
        ?? null,
      previousVisible: expense.correctsExpenseId == null
        || byId.has(expense.correctsExpenseId),
      nextVisible: chain[index + 1] != null,
      isCurrent: index === chain.length - 1 && expense.status === 'active',
    })))
  }

  if (visited.size !== expenses.length) throw new FinancialHistoryError()
  return entries
}

function expenseLifecycle(
  expense: CanonicalExpense,
  nonAuthoritativeCandidateIds: ReadonlySet<string>,
): ExpenseHistoryLifecycle {
  if (nonAuthoritativeCandidateIds.has(expense.id)) return 'proposal_candidate'
  if (expense.status === 'active') return 'active'
  if (expense.status === 'correction_pending') return 'proposal_candidate'
  if (expense.terminationKind === 'corrected') return 'corrected'
  if (expense.terminationKind === 'cancelled') return 'cancelled'
  return 'legacy_voided'
}

export type SettlementHistoryKind =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'proposal_cancelled'
  | 'reversed'
  | 'legacy_reversed'

export type SettlementHistoryFact = {
  id: string
  kind: SettlementHistoryKind
  amountMinor: number
}

export type SettlementHistoryEntry = {
  settlement: SettlementPayment
  allocation: SettlementAllocation
  facts: SettlementHistoryFact[]
  currentAppliedMinor: number | null
  currentCreditMinor: number | null
}

export function deriveSettlementHistoryEntries(
  settlements: readonly SettlementPayment[],
  attributions: readonly SettlementAttribution[],
): SettlementHistoryEntry[] {
  const attributionByAllocation = new Map(
    attributions.map((attribution) => [attribution.allocationId, attribution]),
  )

  return settlements.flatMap((settlement) => settlement.allocations.map((allocation) => {
    if (
      allocation.amountMinor <= 0
      || allocation.reversalMinor < 0
      || allocation.reversalMinor > allocation.amountMinor
    ) throw new FinancialHistoryError()

    const facts: SettlementHistoryFact[] = []
    const acceptedHistorically = (
      allocation.state === 'accepted'
      || allocation.state === 'reversed'
      || allocation.reversalMinor > 0
    )
    if (acceptedHistorically) {
      facts.push({
        id: `${allocation.id}:accepted`,
        kind: 'accepted',
        amountMinor: allocation.amountMinor,
      })
    } else if (allocation.state === 'pending') {
      facts.push({
        id: `${allocation.id}:proposed`,
        kind: 'proposed',
        amountMinor: allocation.amountMinor,
      })
    } else if (allocation.state === 'declined') {
      facts.push({
        id: `${allocation.id}:declined`,
        kind: 'declined',
        amountMinor: allocation.amountMinor,
      })
    } else if (allocation.state === 'cancelled') {
      facts.push({
        id: `${allocation.id}:cancelled`,
        kind: 'proposal_cancelled',
        amountMinor: allocation.amountMinor,
      })
    }

    if (allocation.state === 'reversed') {
      facts.push({
        id: `${allocation.id}:legacy-reversed`,
        kind: 'legacy_reversed',
        amountMinor: allocation.amountMinor,
      })
    } else if (allocation.reversalMinor > 0) {
      facts.push({
        id: `${allocation.id}:reversed`,
        kind: 'reversed',
        amountMinor: allocation.reversalMinor,
      })
    }

    const attribution = attributionByAllocation.get(allocation.id)
    const canExplainCurrent = (
      allocation.state === 'accepted'
      && allocation.reversalMinor === 0
    )
    if (canExplainCurrent && attribution && (
      attribution.transferMinor !== allocation.amountMinor
      || attribution.currency !== settlement.currency.toUpperCase()
    )) throw new FinancialHistoryError()

    return {
      settlement,
      allocation,
      facts,
      currentAppliedMinor: canExplainCurrent
        ? attribution?.appliedMinor ?? null
        : null,
      currentCreditMinor: canExplainCurrent
        ? attribution?.residualMinor ?? null
        : null,
    }
  }))
}
