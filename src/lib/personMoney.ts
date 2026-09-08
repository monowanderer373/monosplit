import type { CanonicalExpense, PersonRelationship } from '../types'
import {
  deriveRelationalDebtLines,
  type ConfirmedSettlement,
  type RelationalDebtLine,
} from './relationalBalance'

export function personPrincipalIds(person: PersonRelationship): string[] {
  const ids = [
    person.linkedParticipantId,
    ...person.manualParticipantIds,
  ].filter((id): id is string => Boolean(id))
  return [...new Set(ids)]
}

export function isPersonDirectExpense(
  expense: CanonicalExpense,
  ownerParticipantId: string,
  personIds: readonly string[],
): boolean {
  if (expense.scope !== 'direct' || expense.status !== 'active') return false
  const ids = new Set(
    expense.participations.map((participation) => participation.participantId),
  )
  return ids.has(ownerParticipantId)
    && personIds.some((id) => ids.has(id))
}

export function personExpenses(
  expenses: readonly CanonicalExpense[],
  ownerParticipantId: string,
  person: PersonRelationship,
): CanonicalExpense[] {
  const personIds = personPrincipalIds(person)
  return expenses
    .filter((expense) => isPersonDirectExpense(expense, ownerParticipantId, personIds))
    .sort((left, right) =>
      right.occurredOn.localeCompare(left.occurredOn)
      || right.createdAt.localeCompare(left.createdAt),
    )
}

export function isUntrackedPersonExpense(
  expense: CanonicalExpense,
  person: PersonRelationship,
): boolean {
  const manualIds = new Set(person.manualParticipantIds)
  return expense.participations.some((participation) =>
    manualIds.has(participation.participantId)
    && participation.trackingMode === 'untracked',
  )
}

export function trackedPersonExpenses(
  expenses: readonly CanonicalExpense[],
  ownerParticipantId: string,
  person: PersonRelationship,
): CanonicalExpense[] {
  return personExpenses(expenses, ownerParticipantId, person)
    .filter((expense) => !isUntrackedPersonExpense(expense, person))
}

export function untrackedPersonExpenses(
  expenses: readonly CanonicalExpense[],
  ownerParticipantId: string,
  person: PersonRelationship,
): CanonicalExpense[] {
  return personExpenses(expenses, ownerParticipantId, person)
    .filter((expense) => isUntrackedPersonExpense(expense, person))
}

export function untrackedRecordTotals(
  expenses: readonly CanonicalExpense[],
  person: PersonRelationship,
): Array<{ currency: string; totalMinor: number }> {
  const totals = new Map<string, number>()
  const manualIds = new Set(person.manualParticipantIds)
  for (const expense of expenses) {
    for (const participation of expense.participations) {
      if (
        !manualIds.has(participation.participantId)
        || participation.trackingMode !== 'untracked'
      ) continue
      const share = expense.shares.find(
        (item) => item.expenseParticipationId === participation.id,
      )
      if (!share) continue
      totals.set(
        expense.currency,
        (totals.get(expense.currency) ?? 0) + share.amountMinor,
      )
    }
  }
  return [...totals.entries()]
    .map(([currency, totalMinor]) => ({ currency, totalMinor }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export function canSettleTrackedPerson(person: PersonRelationship): boolean {
  return Boolean(person.linkedParticipantId)
}

export function trackedDirectContext(
  ownerParticipantId: string,
  person: PersonRelationship,
): { scope: 'direct'; participantIds: readonly [string, string] } | null {
  if (!person.linkedParticipantId) return null
  return {
    scope: 'direct',
    participantIds: [ownerParticipantId, person.linkedParticipantId],
  }
}

export function trackedPersonDebtLines(
  expenses: readonly CanonicalExpense[],
  settlements: readonly ConfirmedSettlement[],
  ownerParticipantId: string,
  person: PersonRelationship,
): RelationalDebtLine[] {
  const context = trackedDirectContext(ownerParticipantId, person)
  if (!context) return []
  return deriveRelationalDebtLines(expenses, settlements, context)
}
