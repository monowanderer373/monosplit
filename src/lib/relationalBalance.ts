import type { CanonicalExpense } from '../types'

export type ConfirmedSettlement = {
  id: string
  scope: 'direct' | 'space'
  spaceId: string | null
  debtorParticipantId: string
  currency: string
  status: 'pending' | 'partially_confirmed' | 'confirmed' | 'declined' | 'reversed'
  paymentDate: string
  createdAt: string
  allocations: Array<{
    creditorParticipantId: string
    amountMinor: number
    state: 'pending' | 'accepted' | 'declined' | 'reversed'
  }>
}

export type BalanceContext =
  | { scope: 'space'; spaceId: string }
  | { scope: 'direct'; participantIds: readonly [string, string] }

export type RelationalDebtLine = {
  expenseId: string
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  originalMinor: number
  settledMinor: number
  remainingMinor: number
}

function appliesToContext(expense: CanonicalExpense, context: BalanceContext): boolean {
  if (context.scope === 'space') {
    return expense.scope === 'space' && expense.spaceId === context.spaceId
  }
  if (expense.scope !== 'direct') return false
  const participants = new Set(expense.participations
    .filter((participation) => participation.state === 'accepted' && participation.trackingMode === 'tracked')
    .map((participation) => participation.participantId))
  return context.participantIds.every((participantId) => participants.has(participantId))
}

function settlementAppliesToContext(
  settlement: ConfirmedSettlement,
  context: BalanceContext,
  creditorParticipantId: string,
): boolean {
  if (context.scope === 'space') {
    return settlement.scope === 'space' && settlement.spaceId === context.spaceId
  }
  if (settlement.scope !== 'direct' || settlement.spaceId != null) return false
  return context.participantIds.includes(settlement.debtorParticipantId)
    && context.participantIds.includes(creditorParticipantId)
}

export function deriveRelationalDebtLines(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext,
): RelationalDebtLine[] {
  const debtLines: RelationalDebtLine[] = []

  for (const expense of expenses) {
    if (expense.status !== 'active' || !appliesToContext(expense, context)) continue
    const accepted = expense.participations
      .filter((participation) => (
        expense.scope === 'space'
        || (participation.state === 'accepted' && participation.trackingMode === 'tracked')
      ))
      .sort((a, b) => a.order - b.order)
    const positions = accepted.map((participation) => {
      const contribution = expense.payerContributions.find(
        (item) => item.expenseParticipationId === participation.id,
      )?.amountMinor ?? 0
      const share = expense.shares.find(
        (item) => item.expenseParticipationId === participation.id,
      )?.amountMinor ?? 0
      return {
        participantId: participation.participantId,
        remainingMinor: contribution - share,
      }
    })
    const creditors = positions.filter((position) => position.remainingMinor > 0)
    const debtors = positions.filter((position) => position.remainingMinor < 0)

    for (const debtor of debtors) {
      let deficitMinor = -debtor.remainingMinor
      for (const creditor of creditors) {
        if (deficitMinor === 0) break
        if (creditor.remainingMinor <= 0) continue
        const amountMinor = Math.min(deficitMinor, creditor.remainingMinor)
        if (amountMinor <= 0) continue
        const belongsToDirectPair = context.scope !== 'direct'
          || (
            context.participantIds.includes(debtor.participantId)
            && context.participantIds.includes(creditor.participantId)
          )
        if (belongsToDirectPair) {
          debtLines.push({
            expenseId: expense.id,
            debtorParticipantId: debtor.participantId,
            creditorParticipantId: creditor.participantId,
            currency: expense.currency,
            originalMinor: amountMinor,
            settledMinor: 0,
            remainingMinor: amountMinor,
          })
        }
        deficitMinor -= amountMinor
        creditor.remainingMinor -= amountMinor
      }
    }
  }

  debtLines.sort((a, b) => {
    const firstExpense = expenses.find((expense) => expense.id === a.expenseId)
    const secondExpense = expenses.find((expense) => expense.id === b.expenseId)
    return (firstExpense?.occurredOn ?? '').localeCompare(secondExpense?.occurredOn ?? '')
      || (firstExpense?.createdAt ?? '').localeCompare(secondExpense?.createdAt ?? '')
      || a.expenseId.localeCompare(b.expenseId)
  })

  const acceptedAllocations = settlements
    .flatMap((settlement) => settlement.allocations
      .filter((allocation) => allocation.state === 'accepted')
      .filter((allocation) => settlementAppliesToContext(
        settlement,
        context,
        allocation.creditorParticipantId,
      ))
      .map((allocation) => ({
        settlement,
        allocation,
        remainingMinor: allocation.amountMinor,
      })))
    .sort((a, b) => (
      a.settlement.paymentDate.localeCompare(b.settlement.paymentDate)
      || a.settlement.createdAt.localeCompare(b.settlement.createdAt)
      || a.settlement.id.localeCompare(b.settlement.id)
    ))

  for (const item of acceptedAllocations) {
    for (const line of debtLines) {
      if (item.remainingMinor === 0) break
      if (
        line.debtorParticipantId !== item.settlement.debtorParticipantId
        || line.creditorParticipantId !== item.allocation.creditorParticipantId
        || line.currency !== item.settlement.currency
        || line.remainingMinor === 0
      ) continue
      const appliedMinor = Math.min(item.remainingMinor, line.remainingMinor)
      line.settledMinor += appliedMinor
      line.remainingMinor -= appliedMinor
      item.remainingMinor -= appliedMinor
    }
  }

  return debtLines
}

export function summarizeRelationalBalances(lines: readonly RelationalDebtLine[]): Array<{
  participantId: string
  currency: string
  netMinor: number
}> {
  const totals = new Map<string, { participantId: string; currency: string; netMinor: number }>()
  for (const line of lines) {
    if (line.remainingMinor <= 0) continue
    for (const [participantId, delta] of [
      [line.creditorParticipantId, line.remainingMinor],
      [line.debtorParticipantId, -line.remainingMinor],
    ] as const) {
      const key = `${participantId}:${line.currency}`
      const current = totals.get(key) ?? { participantId, currency: line.currency, netMinor: 0 }
      current.netMinor += delta
      totals.set(key, current)
    }
  }
  return [...totals.values()].sort((a, b) => (
    a.currency.localeCompare(b.currency) || a.participantId.localeCompare(b.participantId)
  ))
}
