import type {
  CanonicalExpense,
  ExpenseParticipation,
  ExpenseShare,
  PayerContribution,
} from '../types'
import type { CreateExpenseCommand } from './compileExpense'
import { supabase } from './supabase'

export type LedgerRepositoryErrorCode =
  | 'not_configured'
  | 'not_found'
  | 'server_rejected'

export class LedgerRepositoryError extends Error {
  readonly code: LedgerRepositoryErrorCode
  readonly outcome: 'definitive' | 'ambiguous'

  constructor(
    code: LedgerRepositoryErrorCode,
    message: string = code,
    outcome: 'definitive' | 'ambiguous' = 'definitive',
  ) {
    super(message)
    this.name = 'LedgerRepositoryError'
    this.code = code
    this.outcome = outcome
  }
}

export interface LedgerRepository {
  createExpense(command: CreateExpenseCommand): Promise<string>
  listExpenses(): Promise<CanonicalExpense[]>
  findExpenseByRequestId(requestId: string): Promise<CanonicalExpense | null>
  voidExpense(expenseId: string, expectedVersion: number): Promise<number>
  restoreOwnerLocalExpense(expenseId: string, expectedVersion: number): Promise<number>
  respondToDirectExpense(
    expenseId: string,
    response: 'accepted' | 'declined',
    expectedVersion: number,
  ): Promise<number>
  updateExpenseMetadata(input: {
    expenseId: string
    expectedVersion: number
    description: string | null
    category: string
    occurredOn: string
  }): Promise<number>
  replaceExpenseFinancials(input: {
    expenseId: string
    expectedVersion: number
    totalMinor: number
    currency: string
    participantIds: string[]
    contributionAmounts: number[]
    shareAmounts: number[]
  }): Promise<number>
}

type ExpenseRow = {
  id: string
  client_request_id: string
  scope: CanonicalExpense['scope']
  space_id: string | null
  created_by: string
  total_minor: number
  participant_count: number
  currency: string
  description: string | null
  category: string
  occurred_on: string
  status: CanonicalExpense['status']
  version: number
  corrects_expense_id: string | null
  termination_kind: CanonicalExpense['terminationKind']
  voided_at: string | null
  created_at: string
  updated_at: string
  participations?: Array<{
    id: string
    expense_id: string
    participant_id: string
    name_snapshot: string
    participant_order: number
    state: ExpenseParticipation['state']
    tracking_mode: ExpenseParticipation['trackingMode']
  }>
  payer_contributions?: Array<{
    expense_participation_id: string
    expense_id: string
    amount_minor: number
  }>
  expense_shares?: Array<{
    expense_participation_id: string
    expense_id: string
    amount_minor: number
  }>
}

function mapExpenseRow(row: ExpenseRow): CanonicalExpense {
  const participations: ExpenseParticipation[] = (row.participations ?? [])
    .map((participation) => ({
      id: participation.id,
      expenseId: participation.expense_id,
      participantId: participation.participant_id,
      nameSnapshot: participation.name_snapshot,
      order: participation.participant_order,
      state: participation.state,
      trackingMode: participation.tracking_mode,
    }))
    .sort((a, b) => a.order - b.order)

  const payerContributions: PayerContribution[] = (row.payer_contributions ?? []).map((contribution) => ({
    expenseParticipationId: contribution.expense_participation_id,
    expenseId: contribution.expense_id,
    amountMinor: contribution.amount_minor,
  }))

  const shares: ExpenseShare[] = (row.expense_shares ?? []).map((share) => ({
    expenseParticipationId: share.expense_participation_id,
    expenseId: share.expense_id,
    amountMinor: share.amount_minor,
  }))

  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    scope: row.scope,
    spaceId: row.space_id,
    createdBy: row.created_by,
    totalMinor: row.total_minor,
    participantCount: row.participant_count,
    currency: row.currency,
    description: row.description,
    category: row.category,
    occurredOn: row.occurred_on,
    status: row.status,
    version: row.version,
    correctsExpenseId: row.corrects_expense_id,
    terminationKind: row.termination_kind,
    voidedAt: row.voided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participations,
    payerContributions,
    shares,
  }
}

function createFailureOutcome(error: { code?: string } | null): 'definitive' | 'ambiguous' {
  return error?.code ? 'definitive' : 'ambiguous'
}

const expenseSelect = `
  id, client_request_id, scope, space_id, created_by, total_minor, participant_count, currency,
  description, category, occurred_on, status, version, corrects_expense_id, termination_kind,
  voided_at, created_at, updated_at,
  participations:expense_participations(*),
  payer_contributions(*),
  expense_shares(*)
`

export const ledgerRepository: LedgerRepository = {
  async createExpense(command) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('create_expense', {
      request_id: command.requestId,
      expense_scope: command.scope,
      target_space_id: command.spaceId,
      total_minor: command.totalMinor,
      currency_code: command.currency,
      description: command.description,
      category: command.category,
      occurred_on: command.occurredOn,
      participant_ids: command.participantIds,
      contribution_amounts: command.contributionAmounts,
      share_amounts: command.shareAmounts,
    })
    if (error || typeof data !== 'string') {
      throw new LedgerRepositoryError(
        'server_rejected',
        error?.message,
        createFailureOutcome(error),
      )
    }
    return data
  },

  async listExpenses() {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase
      .from('expenses')
      .select(expenseSelect)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new LedgerRepositoryError('server_rejected', error.message)
    return ((data ?? []) as unknown as ExpenseRow[]).map(mapExpenseRow)
  },

  async findExpenseByRequestId(requestId) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase
      .from('expenses')
      .select(expenseSelect)
      .eq('client_request_id', requestId)
      .maybeSingle()
    if (error) throw new LedgerRepositoryError('server_rejected', error.message)
    return data ? mapExpenseRow(data as unknown as ExpenseRow) : null
  },

  async voidExpense(expenseId, expectedVersion) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('cancel_expense', {
      target_expense_id: expenseId,
      expected_version: expectedVersion,
      cancellation_reason: null,
    })
    if (error || typeof data !== 'number') {
      throw new LedgerRepositoryError('server_rejected', error?.message)
    }
    return data
  },

  async restoreOwnerLocalExpense(expenseId, expectedVersion) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('restore_owner_local_expense', {
      target_expense_id: expenseId,
      expected_version: expectedVersion,
    })
    if (error || typeof data !== 'number') {
      throw new LedgerRepositoryError('server_rejected', error?.message)
    }
    return data
  },

  async respondToDirectExpense(expenseId, response, expectedVersion) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('respond_to_direct_expense', {
      target_expense_id: expenseId,
      response,
      expected_expense_version: expectedVersion,
    })
    const version = (
      data && typeof data === 'object' && 'expense_version' in data
        ? data.expense_version
        : null
    )
    if (error || typeof version !== 'number') {
      throw new LedgerRepositoryError('server_rejected', error?.message)
    }
    return version
  },

  async updateExpenseMetadata(input) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('update_expense_metadata', {
      target_expense_id: input.expenseId,
      next_description: input.description,
      next_category: input.category,
      next_occurred_on: input.occurredOn,
      expected_version: input.expectedVersion,
    })
    if (error || typeof data !== 'number') {
      throw new LedgerRepositoryError('server_rejected', error?.message)
    }
    return data
  },

  async replaceExpenseFinancials(input) {
    if (!supabase) throw new LedgerRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('replace_expense_financials', {
      target_expense_id: input.expenseId,
      expected_version: input.expectedVersion,
      next_total_minor: input.totalMinor,
      next_currency: input.currency,
      participant_ids: input.participantIds,
      contribution_amounts: input.contributionAmounts,
      share_amounts: input.shareAmounts,
    })
    if (error || typeof data !== 'number') {
      throw new LedgerRepositoryError('server_rejected', error?.message)
    }
    return data
  },
}

export class InMemoryLedgerRepository implements LedgerRepository {
  private readonly expensesByRequest = new Map<string, CanonicalExpense>()

  async createExpense(command: CreateExpenseCommand): Promise<string> {
    const existing = this.expensesByRequest.get(command.requestId)
    if (existing) return existing.id

    const id = `expense-${this.expensesByRequest.size + 1}`
    const now = '2026-08-30T00:00:00.000Z'
    const participations = command.participantIds.map((participantId, index): ExpenseParticipation => ({
      id: `${id}-participation-${index}`,
      expenseId: id,
      participantId,
      nameSnapshot: participantId,
      order: index,
      state: command.scope === 'direct' && index > 0 ? 'pending' : 'accepted',
      trackingMode: 'tracked',
    }))
    const expense: CanonicalExpense = {
      id,
      clientRequestId: command.requestId,
      scope: command.scope,
      spaceId: command.spaceId,
      createdBy: command.participantIds[0],
      totalMinor: command.totalMinor,
      participantCount: command.participantIds.length,
      currency: command.currency,
      description: command.description,
      category: command.category,
      occurredOn: command.occurredOn,
      status: 'active',
      version: 1,
      correctsExpenseId: null,
      terminationKind: null,
      voidedAt: null,
      createdAt: now,
      updatedAt: now,
      participations,
      payerContributions: participations.flatMap((participation, index) =>
        command.contributionAmounts[index] > 0
          ? [{
            expenseParticipationId: participation.id,
            expenseId: id,
            amountMinor: command.contributionAmounts[index],
          }]
          : [],
      ),
      shares: participations.map((participation, index) => ({
        expenseParticipationId: participation.id,
        expenseId: id,
        amountMinor: command.shareAmounts[index],
      })),
    }
    this.expensesByRequest.set(command.requestId, expense)
    return id
  }

  async listExpenses(): Promise<CanonicalExpense[]> {
    return [...this.expensesByRequest.values()]
  }

  async findExpenseByRequestId(requestId: string): Promise<CanonicalExpense | null> {
    return this.expensesByRequest.get(requestId) ?? null
  }

  async voidExpense(expenseId: string, expectedVersion: number): Promise<number> {
    const entry = [...this.expensesByRequest.entries()].find(([, expense]) => expense.id === expenseId)
    if (!entry) throw new LedgerRepositoryError('not_found')
    if (entry[1].version !== expectedVersion) {
      throw new LedgerRepositoryError('server_rejected', 'version_conflict')
    }
    entry[1].status = 'voided'
    entry[1].terminationKind = 'cancelled'
    entry[1].voidedAt = '2026-08-30T00:00:00.000Z'
    entry[1].version += 1
    return entry[1].version
  }

  async restoreOwnerLocalExpense(expenseId: string, expectedVersion: number): Promise<number> {
    const entry = [...this.expensesByRequest.entries()].find(([, expense]) => expense.id === expenseId)
    if (!entry) throw new LedgerRepositoryError('not_found')
    const expense = entry[1]
    if (expense.version !== expectedVersion) {
      throw new LedgerRepositoryError('server_rejected', 'version_conflict')
    }
    const ownerLocal = expense.scope === 'personal' || (
      expense.scope === 'direct'
      && expense.participations.every((participation) => (
        participation.participantId === expense.createdBy
        || participation.trackingMode === 'untracked'
      ))
    )
    if (
      !ownerLocal
      || expense.status !== 'voided'
      || expense.terminationKind !== 'cancelled'
    ) {
      throw new LedgerRepositoryError('server_rejected', 'expense_not_restorable')
    }
    expense.status = 'active'
    expense.terminationKind = null
    expense.voidedAt = null
    expense.version += 1
    return expense.version
  }

  async respondToDirectExpense(
    expenseId: string,
    response: 'accepted' | 'declined',
    expectedVersion: number,
  ): Promise<number> {
    const expense = [...this.expensesByRequest.values()].find((candidate) => candidate.id === expenseId)
    if (!expense) throw new LedgerRepositoryError('not_found')
    const pending = expense.participations.find((participation) => participation.state === 'pending')
    if (!pending) throw new LedgerRepositoryError('not_found')
    if (expense.version !== expectedVersion) {
      throw new LedgerRepositoryError('server_rejected', 'version_conflict')
    }
    pending.state = response
    expense.version += 1
    return expense.version
  }

  async updateExpenseMetadata(input: {
    expenseId: string
    expectedVersion: number
    description: string | null
    category: string
    occurredOn: string
  }): Promise<number> {
    const expense = [...this.expensesByRequest.values()].find((candidate) => candidate.id === input.expenseId)
    if (!expense) throw new LedgerRepositoryError('not_found')
    if (expense.version !== input.expectedVersion) throw new LedgerRepositoryError('server_rejected', 'version_conflict')
    expense.description = input.description
    expense.category = input.category
    expense.occurredOn = input.occurredOn
    expense.version += 1
    return expense.version
  }

  async replaceExpenseFinancials(input: {
    expenseId: string
    expectedVersion: number
    totalMinor: number
    currency: string
    participantIds: string[]
    contributionAmounts: number[]
    shareAmounts: number[]
  }): Promise<number> {
    const expense = [...this.expensesByRequest.values()].find((candidate) => candidate.id === input.expenseId)
    if (!expense) throw new LedgerRepositoryError('not_found')
    if (expense.version !== input.expectedVersion) throw new LedgerRepositoryError('server_rejected', 'version_conflict')
    expense.totalMinor = input.totalMinor
    expense.currency = input.currency
    expense.version += 1
    expense.participations.forEach((participation) => {
      if (expense.scope === 'direct' && participation.participantId !== expense.createdBy) {
        participation.state = participation.trackingMode === 'untracked' ? 'untracked' : 'pending'
      }
    })
    return expense.version
  }
}
