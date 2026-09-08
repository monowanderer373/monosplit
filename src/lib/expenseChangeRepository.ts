import { supabase } from './supabase'

export type DirectExpenseChangeKind = 'correction' | 'cancellation'
export type DirectExpenseChangeState =
  | 'pending'
  | 'authoritative'
  | 'declined'
  | 'cancelled'

export type ExpenseFinancialPayload = {
  totalMinor: number
  currency: string
  description: string | null
  category: string
  occurredOn: string
  participantIds: string[]
  contributionAmounts: number[]
  shareAmounts: number[]
}

export type DirectExpenseChangeResult = {
  requestId: string
  requestVersion: number
  requestState: DirectExpenseChangeState
  replacementExpenseId: string | null
  effectiveExpenseId?: string | null
  requiredApproverIds?: string[]
}

export type DirectExpenseChangeApproval = {
  participantId: string
  state: 'pending' | 'accepted' | 'declined'
  respondedAt: string | null
  createdAt: string
}

export type DirectExpenseChangeRequest = {
  id: string
  clientRequestId: string
  kind: DirectExpenseChangeKind
  state: DirectExpenseChangeState
  proposedBy: string
  targetExpenseId: string
  replacementExpenseId: string | null
  targetVersion: number
  version: number
  reason: string | null
  createdAt: string
  updatedAt: string
  approvals: DirectExpenseChangeApproval[]
}

export type SpaceCorrectionResult = {
  replacementExpenseId: string
  replacementVersion: number
}

export class ExpenseChangeRepositoryError extends Error {
  readonly code = 'server_rejected'

  constructor(message: string) {
    super(message)
    this.name = 'ExpenseChangeRepositoryError'
  }
}

function rejected(message?: string): ExpenseChangeRepositoryError {
  return new ExpenseChangeRepositoryError(message ?? 'expense_change_failed')
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}

function parseDirectResult(value: unknown): DirectExpenseChangeResult | null {
  const record = recordOf(value)
  if (!record
      || typeof record.request_id !== 'string'
      || typeof record.request_version !== 'number'
      || (
        record.request_state !== 'pending'
        && record.request_state !== 'authoritative'
        && record.request_state !== 'declined'
        && record.request_state !== 'cancelled'
      )) return null

  const replacementExpenseId = record.replacement_expense_id
  const effectiveExpenseId = record.effective_expense_id
  const requiredApproverIds = record.required_approver_ids
  if (replacementExpenseId !== null
      && replacementExpenseId !== undefined
      && typeof replacementExpenseId !== 'string') return null
  if (effectiveExpenseId !== null
      && effectiveExpenseId !== undefined
      && typeof effectiveExpenseId !== 'string') return null
  if (requiredApproverIds !== undefined
      && (
        !Array.isArray(requiredApproverIds)
        || requiredApproverIds.some((id) => typeof id !== 'string')
      )) return null

  return {
    requestId: record.request_id,
    requestVersion: record.request_version,
    requestState: record.request_state,
    replacementExpenseId: replacementExpenseId as string | null | undefined ?? null,
    effectiveExpenseId: effectiveExpenseId as string | null | undefined,
    requiredApproverIds: requiredApproverIds as string[] | undefined,
  }
}

function parseSpaceResult(value: unknown): SpaceCorrectionResult | null {
  const record = recordOf(value)
  if (!record
      || typeof record.replacement_expense_id !== 'string'
      || typeof record.replacement_version !== 'number') return null
  return {
    replacementExpenseId: record.replacement_expense_id,
    replacementVersion: record.replacement_version,
  }
}

type DirectExpenseChangeRequestRow = {
  id: string
  client_request_id: string
  kind: DirectExpenseChangeKind
  state: DirectExpenseChangeState
  proposed_by: string
  target_expense_id: string
  replacement_expense_id: string | null
  target_version: number
  version: number
  reason: string | null
  created_at: string
  updated_at: string
  approvals?: Array<{
    participant_id: string
    state: DirectExpenseChangeApproval['state']
    responded_at: string | null
    created_at: string
  }>
}

const directChangeSelect = `
  id, client_request_id, kind, state, proposed_by, target_expense_id,
  replacement_expense_id, target_version, version, reason, created_at, updated_at,
  approvals:direct_expense_change_approvals(
    participant_id, state, responded_at, created_at
  )
`

function mapDirectChange(row: DirectExpenseChangeRequestRow): DirectExpenseChangeRequest {
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    kind: row.kind,
    state: row.state,
    proposedBy: row.proposed_by,
    targetExpenseId: row.target_expense_id,
    replacementExpenseId: row.replacement_expense_id,
    targetVersion: row.target_version,
    version: row.version,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvals: (row.approvals ?? []).map((approval) => ({
      participantId: approval.participant_id,
      state: approval.state,
      respondedAt: approval.responded_at,
      createdAt: approval.created_at,
    })),
  }
}

export const expenseChangeRepository = {
  async listDirectChanges(): Promise<DirectExpenseChangeRequest[]> {
    if (!supabase) throw rejected('not_configured')
    const { data, error } = await supabase
      .from('direct_expense_change_requests')
      .select(directChangeSelect)
      .order('updated_at', { ascending: false })
    if (error) throw rejected(error.message)
    return ((data ?? []) as unknown as DirectExpenseChangeRequestRow[]).map(mapDirectChange)
  },

  async proposeDirectChange(input: {
    requestId: string
    targetExpenseId: string
    expectedTargetVersion: number
    kind: DirectExpenseChangeKind
    reason?: string | null
    replacement?: ExpenseFinancialPayload
  }): Promise<DirectExpenseChangeResult> {
    if (!supabase) throw rejected('not_configured')
    const replacement = input.replacement
    const { data, error } = await supabase.rpc('propose_direct_expense_change', {
      request_id: input.requestId,
      target_expense_id: input.targetExpenseId,
      expected_target_version: input.expectedTargetVersion,
      change_kind: input.kind,
      change_reason: input.reason ?? null,
      replacement_total_minor: replacement?.totalMinor ?? null,
      replacement_currency: replacement?.currency ?? null,
      replacement_description: replacement?.description ?? null,
      replacement_category: replacement?.category ?? null,
      replacement_occurred_on: replacement?.occurredOn ?? null,
      participant_ids: replacement?.participantIds ?? null,
      contribution_amounts: replacement?.contributionAmounts ?? null,
      share_amounts: replacement?.shareAmounts ?? null,
    })
    const result = parseDirectResult(data)
    if (error || !result) throw rejected(error?.message)
    return result
  },

  async respondToDirectChange(input: {
    requestId: string
    response: 'accepted' | 'declined'
    expectedRequestVersion: number
  }): Promise<DirectExpenseChangeResult> {
    if (!supabase) throw rejected('not_configured')
    const { data, error } = await supabase.rpc('respond_to_direct_expense_change', {
      target_request_id: input.requestId,
      response: input.response,
      expected_request_version: input.expectedRequestVersion,
    })
    const result = parseDirectResult(data)
    if (error || !result) throw rejected(error?.message)
    return result
  },

  async cancelDirectChange(
    requestId: string,
    expectedRequestVersion: number,
  ): Promise<DirectExpenseChangeResult> {
    if (!supabase) throw rejected('not_configured')
    const { data, error } = await supabase.rpc('cancel_direct_expense_change', {
      target_request_id: requestId,
      expected_request_version: expectedRequestVersion,
    })
    const result = parseDirectResult(data)
    if (error || !result) throw rejected(error?.message)
    return result
  },

  async correctSpaceExpense(input: {
    requestId: string
    targetExpenseId: string
    expectedVersion: number
    replacement: ExpenseFinancialPayload
  }): Promise<SpaceCorrectionResult> {
    if (!supabase) throw rejected('not_configured')
    const { replacement } = input
    const { data, error } = await supabase.rpc('correct_space_expense', {
      request_id: input.requestId,
      target_expense_id: input.targetExpenseId,
      expected_version: input.expectedVersion,
      next_total_minor: replacement.totalMinor,
      next_currency: replacement.currency,
      next_description: replacement.description,
      next_category: replacement.category,
      next_occurred_on: replacement.occurredOn,
      participant_ids: replacement.participantIds,
      contribution_amounts: replacement.contributionAmounts,
      share_amounts: replacement.shareAmounts,
    })
    const result = parseSpaceResult(data)
    if (error || !result) throw rejected(error?.message)
    return result
  },
}
