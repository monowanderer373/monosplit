import type { CanonicalExpense } from '../types'
import type { ExpenseFinancialPayload } from './expenseChangeRepository'
import type { LedgerRepository } from './ledgerRepository'
import { reconcileMinorAmounts } from './money'

export type ExpenseEditSnapshot = {
  expenseId: string
  version: number
  payload: ExpenseFinancialPayload
}

export function expenseEditSnapshot(expense: CanonicalExpense): ExpenseEditSnapshot {
  const participants = [...expense.participations].sort((a, b) => a.order - b.order)
  const amounts = (kind: 'paid' | 'share') => participants.map(participant => (
    (kind === 'paid' ? expense.payerContributions : expense.shares)
      .find(item => item.expenseParticipationId === participant.id)?.amountMinor ?? 0
  ))
  return {
    expenseId: expense.id,
    version: expense.version,
    payload: {
      totalMinor: expense.totalMinor,
      currency: expense.currency,
      description: expense.description,
      category: expense.category,
      occurredOn: expense.occurredOn,
      participantIds: participants.map(participant => participant.participantId),
      contributionAmounts: amounts('paid'),
      shareAmounts: amounts('share'),
    },
  }
}

export function financialEditsChanged(before: ExpenseFinancialPayload, after: ExpenseFinancialPayload): boolean {
  return before.totalMinor !== after.totalMinor || before.currency !== after.currency
    || ['participantIds', 'contributionAmounts', 'shareAmounts'].some(key => (
      JSON.stringify(before[key as keyof ExpenseFinancialPayload]) !== JSON.stringify(after[key as keyof ExpenseFinancialPayload])
    ))
}

export function metadataEditsChanged(before: ExpenseFinancialPayload, after: ExpenseFinancialPayload): boolean {
  return before.description !== after.description || before.category !== after.category || before.occurredOn !== after.occurredOn
}

/* These existing RPCs are versioned, separate transactions. Record each ACK
   immediately so a failed second step can be retried without replaying money
   edits or using the stale version. Never claim this sequence is atomic. */
export async function saveExpenseEdits(
  snapshot: ExpenseEditSnapshot,
  next: ExpenseFinancialPayload,
  repository: Pick<LedgerRepository, 'replaceExpenseFinancials' | 'updateExpenseMetadata'>,
  onApplied: (snapshot: ExpenseEditSnapshot) => void,
): Promise<void> {
  const financialChanged = financialEditsChanged(snapshot.payload, next)
  if (financialChanged) {
    for (const amounts of [next.contributionAmounts, next.shareAmounts]) {
      if (amounts.length !== next.participantIds.length) throw new Error('financial_invariant_violation')
      reconcileMinorAmounts(Object.fromEntries(next.participantIds.map((id, index) => [id, amounts[index]])), next.totalMinor)
    }
  }
  let current = snapshot
  if (financialChanged) {
    const version = await repository.replaceExpenseFinancials({
      expenseId: current.expenseId,
      expectedVersion: current.version,
      totalMinor: next.totalMinor,
      currency: next.currency,
      participantIds: next.participantIds,
      contributionAmounts: next.contributionAmounts,
      shareAmounts: next.shareAmounts,
    })
    current = { ...current, version, payload: {
      ...next,
      description: current.payload.description,
      category: current.payload.category,
      occurredOn: current.payload.occurredOn,
    } }
    onApplied(current)
  }
  if (metadataEditsChanged(current.payload, next)) {
    const version = await repository.updateExpenseMetadata({
      expenseId: current.expenseId,
      expectedVersion: current.version,
      description: next.description,
      category: next.category,
      occurredOn: next.occurredOn,
    })
    onApplied({ ...current, version, payload: next })
  }
}
