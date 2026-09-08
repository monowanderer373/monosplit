import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from '../lib/expenseChangeRepository'
import ExpenseChangeRequestCard from './ExpenseChangeRequestCard'

type Props = {
  requests: DirectExpenseChangeRequest[]
  expenses: CanonicalExpense[]
  currentParticipantId: string
  onRefresh: () => Promise<unknown>
  include?: (request: DirectExpenseChangeRequest) => boolean
}

export default function ExpenseChangeRequestList({
  requests,
  expenses,
  currentParticipantId,
  onRefresh,
  include = () => true,
}: Props) {
  const cards = requests
    .filter(include)
    .flatMap((request) => {
      const targetExpense = expenses.find((expense) => (
        expense.id === request.targetExpenseId
      ))
      if (!targetExpense) return []
      const replacementExpense = request.replacementExpenseId
        ? expenses.find((expense) => expense.id === request.replacementExpenseId) ?? null
        : null
      return [{
        request,
        targetExpense,
        replacementExpense,
      }]
    })

  if (cards.length === 0) return null

  return (
    <div className="grid gap-3">
      {cards.map(({ request, targetExpense, replacementExpense }) => (
        <ExpenseChangeRequestCard
          key={request.id}
          request={request}
          targetExpense={targetExpense}
          replacementExpense={replacementExpense}
          currentParticipantId={currentParticipantId}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}
