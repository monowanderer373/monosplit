import { supabase } from './supabase'

export type FinancialActivity = {
  id: string
  actorParticipantId: string
  expenseId: string | null
  settlementPaymentId: string | null
  spaceId: string | null
  eventType: string
  safeDiff: Record<string, unknown>
  createdAt: string
}

export type FinancialActivityFilter = {
  spaceId?: string
  expenseIds?: readonly string[]
  settlementIds?: readonly string[]
  limit?: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function listFinancialActivity(
  filter: FinancialActivityFilter = {},
): Promise<FinancialActivity[]> {
  if (!supabase) return []
  const clauses: string[] = []
  if (filter.spaceId && UUID_PATTERN.test(filter.spaceId)) {
    clauses.push(`space_id.eq.${filter.spaceId}`)
  }
  const expenseIds = [...new Set(filter.expenseIds ?? [])].filter((id) => UUID_PATTERN.test(id))
  const settlementIds = [...new Set(filter.settlementIds ?? [])]
    .filter((id) => UUID_PATTERN.test(id))
  if (expenseIds.length > 0) clauses.push(`expense_id.in.(${expenseIds.join(',')})`)
  if (settlementIds.length > 0) {
    clauses.push(`settlement_payment_id.in.(${settlementIds.join(',')})`)
  }
  if (clauses.length === 0) return []

  const { data, error } = await supabase
    .from('financial_events')
    .select('id, actor_participant_id, expense_id, settlement_payment_id, space_id, event_type, safe_diff, created_at')
    .or(clauses.join(','))
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100)
  if (error) throw error
  return coalesceFinancialActivity((data ?? []).map((row) => ({
    id: row.id,
    actorParticipantId: row.actor_participant_id,
    expenseId: row.expense_id,
    settlementPaymentId: row.settlement_payment_id,
    spaceId: row.space_id,
    eventType: row.event_type,
    safeDiff: row.safe_diff as Record<string, unknown>,
    createdAt: row.created_at,
  })))
}

export function coalesceFinancialActivity(
  events: readonly FinancialActivity[],
): FinancialActivity[] {
  const terminalByExpenseAndTime = new Set(events.flatMap((event) => (
    event.expenseId && (
      event.eventType === 'expense.corrected'
      || event.eventType === 'expense.cancelled'
    )
      ? [`${event.expenseId}\u0000${event.createdAt}\u0000${event.eventType}`]
      : []
  )))

  return events.filter((event) => {
    if (!event.expenseId) return true
    if (event.eventType === 'expense.correction_approval_accepted') {
      return !terminalByExpenseAndTime.has(
        `${event.expenseId}\u0000${event.createdAt}\u0000expense.corrected`,
      )
    }
    if (event.eventType === 'expense.cancellation_approval_accepted') {
      return !terminalByExpenseAndTime.has(
        `${event.expenseId}\u0000${event.createdAt}\u0000expense.cancelled`,
      )
    }
    return true
  })
}
