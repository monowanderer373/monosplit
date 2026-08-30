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

export async function listFinancialActivity(limit = 100): Promise<FinancialActivity[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('financial_events')
    .select('id, actor_participant_id, expense_id, settlement_payment_id, space_id, event_type, safe_diff, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    actorParticipantId: row.actor_participant_id,
    expenseId: row.expense_id,
    settlementPaymentId: row.settlement_payment_id,
    spaceId: row.space_id,
    eventType: row.event_type,
    safeDiff: row.safe_diff as Record<string, unknown>,
    createdAt: row.created_at,
  }))
}
