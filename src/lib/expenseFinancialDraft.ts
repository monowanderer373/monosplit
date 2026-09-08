import type { CanonicalExpense } from '../types'

export function orderedExpenseParticipantIds(expense: CanonicalExpense): string[] {
  return [...expense.participations]
    .sort((a, b) => a.order - b.order)
    .map((participation) => participation.participantId)
}

export function correctionPrincipalSnapshot(expense: CanonicalExpense): {
  currency: string
  participantIds: string[]
} {
  return {
    currency: expense.currency,
    participantIds: orderedExpenseParticipantIds(expense),
  }
}

export function rescaleMinorAmounts(
  amounts: readonly number[],
  currentTotalMinor: number,
  nextTotalMinor: number,
): number[] {
  if (amounts.length === 0 || currentTotalMinor <= 0 || nextTotalMinor <= 0) {
    throw new Error('invalid_amount')
  }
  let allocated = 0
  return amounts.map((amount, index) => {
    if (index === amounts.length - 1) return nextTotalMinor - allocated
    const scaled = Math.floor((amount * nextTotalMinor) / currentTotalMinor)
    allocated += scaled
    return scaled
  })
}
