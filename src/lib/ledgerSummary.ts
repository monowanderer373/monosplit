import type { CanonicalExpense, ExpenseParticipation } from '../types'

export type PersonalLedgerRow = {
  expense: CanonicalExpense
  paidMinor: number
  personalSpendingMinor: number
  trackedReceivableMinor: number
  trackedPayableMinor: number
  pendingAdvanceMinor: number
  untrackedAdvanceMinor: number
}

function participationAmount(
  participation: ExpenseParticipation | undefined,
  source: CanonicalExpense['payerContributions'] | CanonicalExpense['shares'],
): number {
  if (!participation) return 0
  return source.find((item) => item.expenseParticipationId === participation.id)?.amountMinor ?? 0
}

export function derivePersonalLedgerRows(
  expenses: readonly CanonicalExpense[],
  participantId: string,
): PersonalLedgerRow[] {
  return expenses
    .filter((expense) =>
      expense.status === 'active'
      && expense.participations.some((participation) => participation.participantId === participantId),
    )
    .map((expense) => {
      const mine = expense.participations.find((participation) => participation.participantId === participantId)
      const paidMinor = participationAmount(mine, expense.payerContributions)
      const personalSpendingMinor = participationAmount(mine, expense.shares)
      let surplusMinor = Math.max(0, paidMinor - personalSpendingMinor)
      const myDeficitMinor = Math.max(0, personalSpendingMinor - paidMinor)
      let trackedReceivableMinor = 0
      let trackedPayableMinor = 0
      let pendingAdvanceMinor = 0
      let untrackedAdvanceMinor = 0

      for (const participation of expense.participations) {
        if (participation.participantId === participantId || surplusMinor === 0) continue
        const shareMinor = participationAmount(participation, expense.shares)
        const contributionMinor = participationAmount(participation, expense.payerContributions)
        const deficitMinor = Math.max(0, shareMinor - contributionMinor)
        const matchedMinor = Math.min(surplusMinor, deficitMinor)
        surplusMinor -= matchedMinor

        if (participation.state === 'accepted' && participation.trackingMode === 'tracked') {
          trackedReceivableMinor += matchedMinor
        } else if (participation.state === 'pending') {
          pendingAdvanceMinor += matchedMinor
        } else if (participation.state === 'untracked') {
          untrackedAdvanceMinor += matchedMinor
        }
      }

      let remainingDeficitMinor = myDeficitMinor
      for (const participation of expense.participations) {
        if (participation.participantId === participantId || remainingDeficitMinor === 0) continue
        const shareMinor = participationAmount(participation, expense.shares)
        const contributionMinor = participationAmount(participation, expense.payerContributions)
        const surplusForMeMinor = Math.max(0, contributionMinor - shareMinor)
        const matchedMinor = Math.min(remainingDeficitMinor, surplusForMeMinor)
        remainingDeficitMinor -= matchedMinor
        if (participation.state === 'accepted' && participation.trackingMode === 'tracked') {
          trackedPayableMinor += matchedMinor
        }
      }

      return {
        expense,
        paidMinor,
        personalSpendingMinor,
        trackedReceivableMinor,
        trackedPayableMinor:
          mine?.state === 'accepted' && mine.trackingMode === 'tracked' ? trackedPayableMinor : 0,
        pendingAdvanceMinor,
        untrackedAdvanceMinor,
      }
    })
    .sort((a, b) =>
      b.expense.occurredOn.localeCompare(a.expense.occurredOn)
      || b.expense.createdAt.localeCompare(a.expense.createdAt),
    )
}

export type PersonalLedgerTotals = {
  currency: string
  paidMinor: number
  personalSpendingMinor: number
  trackedReceivableMinor: number
  trackedPayableMinor: number
  pendingAdvanceMinor: number
  untrackedAdvanceMinor: number
}

export function totalPersonalLedgerRows(rows: readonly PersonalLedgerRow[]): PersonalLedgerTotals[] {
  const totals = new Map<string, PersonalLedgerTotals>()
  for (const row of rows) {
    const currency = row.expense.currency
    const total = totals.get(currency) ?? {
      currency,
      paidMinor: 0,
      personalSpendingMinor: 0,
      trackedReceivableMinor: 0,
      trackedPayableMinor: 0,
      pendingAdvanceMinor: 0,
      untrackedAdvanceMinor: 0,
    }
    total.paidMinor += row.paidMinor
    total.personalSpendingMinor += row.personalSpendingMinor
    total.trackedReceivableMinor += row.trackedReceivableMinor
    total.trackedPayableMinor += row.trackedPayableMinor
    total.pendingAdvanceMinor += row.pendingAdvanceMinor
    total.untrackedAdvanceMinor += row.untrackedAdvanceMinor
    totals.set(currency, total)
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency))
}
