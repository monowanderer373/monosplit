import type { CanonicalExpense } from '../types'

export type ConfirmedSettlement = {
  id: string
  scope: 'direct' | 'space'
  spaceId: string | null
  debtorParticipantId: string
  currency: string
  status:
    | 'pending'
    | 'partially_confirmed'
    | 'confirmed'
    | 'declined'
    | 'reversed'
    | 'cancelled'
    | 'mixed_closed'
  paymentDate: string
  createdAt: string
  allocations: Array<{
    id?: string
    creditorParticipantId: string
    amountMinor: number
    state: 'pending' | 'accepted' | 'declined' | 'reversed' | 'cancelled'
    reversalMinor?: number
  }>
}

export type BalanceContext =
  | { scope: 'space'; spaceId: string }
  | { scope: 'direct'; participantIds: readonly [string, string] }

export type RelationalDebtLine = {
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  remainingMinor: number
}

export type SignedRelationalPosition = {
  lowerParticipantId: string
  higherParticipantId: string
  currency: string
  expenseSignedMinor: number
  settlementSignedMinor: number
  reversalSignedMinor: number
  finalSignedMinor: number
}

export type SettlementAttribution = {
  settlementId: string
  allocationId: string
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  transferMinor: number
  reversalMinor: number
  appliedMinor: number
  residualMinor: number
  applications: Array<{
    expenseId: string
    amountMinor: number
  }>
}

type ExpenseObligation = {
  expenseId: string
  occurredOn: string
  createdAt: string
  debtorParticipantId: string
  creditorParticipantId: string
  currency: string
  amountMinor: number
}

type SignedAccumulator = Omit<SignedRelationalPosition, 'finalSignedMinor'>

function safeAdd(left: number, right: number): number {
  const result = left + right
  if (!Number.isSafeInteger(result)) throw new Error('relational_balance_overflow')
  return result
}

export function isRelationallyEffectiveExpense(expense: CanonicalExpense): boolean {
  return expense.status === 'active'
}

function expenseAppliesToContext(expense: CanonicalExpense, context: BalanceContext): boolean {
  if (context.scope === 'space') {
    return expense.scope === 'space' && expense.spaceId === context.spaceId
  }
  if (expense.scope !== 'direct') return false
  const participants = new Set(expense.participations
    .filter((participation) => (
      participation.state === 'accepted' && participation.trackingMode === 'tracked'
    ))
    .map((participation) => participation.participantId))
  return context.participantIds.every((participantId) => participants.has(participantId))
}

function allocationAppliesToContext(
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

function canonicalPair(
  firstParticipantId: string,
  secondParticipantId: string,
): readonly [string, string] {
  return firstParticipantId.localeCompare(secondParticipantId) <= 0
    ? [firstParticipantId, secondParticipantId]
    : [secondParticipantId, firstParticipantId]
}

function pairKey(
  firstParticipantId: string,
  secondParticipantId: string,
  currency: string,
): string {
  const [lowerParticipantId, higherParticipantId] = canonicalPair(
    firstParticipantId,
    secondParticipantId,
  )
  return `${lowerParticipantId}\u0000${higherParticipantId}\u0000${currency.toUpperCase()}`
}

function signedDirection(
  debtorParticipantId: string,
  creditorParticipantId: string,
  amountMinor: number,
): number {
  const [lowerParticipantId] = canonicalPair(debtorParticipantId, creditorParticipantId)
  return debtorParticipantId === lowerParticipantId ? amountMinor : -amountMinor
}

function deriveExpenseObligations(
  expenses: readonly CanonicalExpense[],
  context: BalanceContext,
): ExpenseObligation[] {
  const obligations: ExpenseObligation[] = []

  for (const expense of expenses) {
    if (!isRelationallyEffectiveExpense(expense) || !expenseAppliesToContext(expense, context)) {
      continue
    }
    const accepted = expense.participations
      .filter((participation) => (
        expense.scope === 'space'
        || (participation.state === 'accepted' && participation.trackingMode === 'tracked')
      ))
      .sort((a, b) => a.order - b.order || a.participantId.localeCompare(b.participantId))
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
          obligations.push({
            expenseId: expense.id,
            occurredOn: expense.occurredOn,
            createdAt: expense.createdAt,
            debtorParticipantId: debtor.participantId,
            creditorParticipantId: creditor.participantId,
            currency: expense.currency.toUpperCase(),
            amountMinor,
          })
        }
        deficitMinor -= amountMinor
        creditor.remainingMinor -= amountMinor
      }
    }
  }

  return obligations.sort((a, b) =>
    a.occurredOn.localeCompare(b.occurredOn)
    || a.createdAt.localeCompare(b.createdAt)
    || a.expenseId.localeCompare(b.expenseId)
    || a.debtorParticipantId.localeCompare(b.debtorParticipantId)
    || a.creditorParticipantId.localeCompare(b.creditorParticipantId),
  )
}

function relevantTransferFacts(
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext,
) {
  return settlements
    .flatMap((settlement) => settlement.allocations
      .map((allocation, allocationIndex) => ({ settlement, allocation, allocationIndex }))
      .filter(({ settlement, allocation }) => (
        (allocation.state === 'accepted' || allocation.state === 'reversed')
        && allocationAppliesToContext(
          settlement,
          context,
          allocation.creditorParticipantId,
        )
      )))
    .sort((a, b) => (
      a.settlement.paymentDate.localeCompare(b.settlement.paymentDate)
      || a.settlement.createdAt.localeCompare(b.settlement.createdAt)
      || a.settlement.id.localeCompare(b.settlement.id)
      || a.allocationIndex - b.allocationIndex
    ))
}

export function deriveSignedRelationalPositions(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext,
): SignedRelationalPosition[] {
  const totals = new Map<string, SignedAccumulator>()
  const accumulatorFor = (
    firstParticipantId: string,
    secondParticipantId: string,
    currency: string,
  ): SignedAccumulator => {
    const normalizedCurrency = currency.toUpperCase()
    const key = pairKey(firstParticipantId, secondParticipantId, normalizedCurrency)
    const [lowerParticipantId, higherParticipantId] = canonicalPair(
      firstParticipantId,
      secondParticipantId,
    )
    const current = totals.get(key) ?? {
      lowerParticipantId,
      higherParticipantId,
      currency: normalizedCurrency,
      expenseSignedMinor: 0,
      settlementSignedMinor: 0,
      reversalSignedMinor: 0,
    }
    totals.set(key, current)
    return current
  }

  for (const obligation of deriveExpenseObligations(expenses, context)) {
    const total = accumulatorFor(
      obligation.debtorParticipantId,
      obligation.creditorParticipantId,
      obligation.currency,
    )
    total.expenseSignedMinor = safeAdd(
      total.expenseSignedMinor,
      signedDirection(
        obligation.debtorParticipantId,
        obligation.creditorParticipantId,
        obligation.amountMinor,
      ),
    )
  }

  for (const { settlement, allocation } of relevantTransferFacts(settlements, context)) {
    const total = accumulatorFor(
      settlement.debtorParticipantId,
      allocation.creditorParticipantId,
      settlement.currency,
    )
    const signedMinor = signedDirection(
      settlement.debtorParticipantId,
      allocation.creditorParticipantId,
      allocation.amountMinor,
    )
    total.settlementSignedMinor = safeAdd(total.settlementSignedMinor, signedMinor)
    const reversalMinor = allocation.state === 'reversed'
      ? allocation.amountMinor
      : allocation.reversalMinor ?? 0
    if (reversalMinor > 0) {
      total.reversalSignedMinor = safeAdd(
        total.reversalSignedMinor,
        signedDirection(
          settlement.debtorParticipantId,
          allocation.creditorParticipantId,
          reversalMinor,
        ),
      )
    }
  }

  return [...totals.values()]
    .map((total): SignedRelationalPosition => ({
      ...total,
      finalSignedMinor: safeAdd(
        safeAdd(total.expenseSignedMinor, -total.settlementSignedMinor),
        total.reversalSignedMinor,
      ),
    }))
    .sort((a, b) =>
      a.currency.localeCompare(b.currency)
      || a.lowerParticipantId.localeCompare(b.lowerParticipantId)
      || a.higherParticipantId.localeCompare(b.higherParticipantId),
    )
}

export function deriveRelationalDebtLines(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext,
): RelationalDebtLine[] {
  return deriveSignedRelationalPositions(expenses, settlements, context)
    .filter((position) => position.finalSignedMinor !== 0)
    .map((position): RelationalDebtLine => {
      const lowerOwesHigher = position.finalSignedMinor > 0
      return {
        debtorParticipantId: lowerOwesHigher
          ? position.lowerParticipantId
          : position.higherParticipantId,
        creditorParticipantId: lowerOwesHigher
          ? position.higherParticipantId
          : position.lowerParticipantId,
        currency: position.currency,
        remainingMinor: Math.abs(position.finalSignedMinor),
      }
    })
}

export function deriveSettlementAttributions(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  context: BalanceContext,
): SettlementAttribution[] {
  const obligations = deriveExpenseObligations(expenses, context).map((obligation) => ({
    ...obligation,
    availableMinor: obligation.amountMinor,
  }))

  return relevantTransferFacts(settlements, context)
    .map(({ settlement, allocation, allocationIndex }): SettlementAttribution => {
      let remainingMinor = allocation.amountMinor
      const applications: SettlementAttribution['applications'] = []
      for (const obligation of obligations) {
        if (
          remainingMinor === 0
          || obligation.availableMinor === 0
          || obligation.debtorParticipantId !== settlement.debtorParticipantId
          || obligation.creditorParticipantId !== allocation.creditorParticipantId
          || obligation.currency !== settlement.currency.toUpperCase()
        ) continue
        const amountMinor = Math.min(remainingMinor, obligation.availableMinor)
        remainingMinor -= amountMinor
        applications.push({ expenseId: obligation.expenseId, amountMinor })
        if (
          allocation.state === 'accepted'
          && (allocation.reversalMinor ?? 0) === 0
        ) {
          obligation.availableMinor -= amountMinor
        }
      }
      return {
        settlementId: settlement.id,
        allocationId: allocation.id ?? `${settlement.id}:${allocationIndex}`,
        debtorParticipantId: settlement.debtorParticipantId,
        creditorParticipantId: allocation.creditorParticipantId,
        currency: settlement.currency.toUpperCase(),
        transferMinor: allocation.amountMinor,
        reversalMinor: allocation.state === 'reversed'
          ? allocation.amountMinor
          : allocation.reversalMinor ?? 0,
        appliedMinor: safeAdd(allocation.amountMinor, -remainingMinor),
        residualMinor: remainingMinor,
        applications,
      }
    })
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
      current.netMinor = safeAdd(current.netMinor, delta)
      totals.set(key, current)
    }
  }
  return [...totals.values()].sort((a, b) => (
    a.currency.localeCompare(b.currency) || a.participantId.localeCompare(b.participantId)
  ))
}
