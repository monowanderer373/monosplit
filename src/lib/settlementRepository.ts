import { supabase } from './supabase'

export type SettlementScope = 'direct' | 'space'
export type SettlementAllocationState =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'reversed'
  | 'cancelled'
export type SettlementStatus =
  | 'pending'
  | 'partially_confirmed'
  | 'confirmed'
  | 'declined'
  | 'reversed'
  | 'cancelled'
  | 'mixed_closed'

export type SettlementAllocation = {
  id: string
  settlementPaymentId: string
  creditorParticipantId: string
  amountMinor: number
  state: SettlementAllocationState
  reversalMinor: number
  respondedAt: string | null
  createdAt: string
}

export type SettlementPayment = {
  id: string
  clientRequestId: string
  scope: SettlementScope
  spaceId: string | null
  debtorParticipantId: string
  currency: string
  amountMinor: number
  paymentDate: string
  status: SettlementStatus
  version: number
  note: string | null
  reversedAt: string | null
  reversedBy: string | null
  createdAt: string
  updatedAt: string
  allocations: SettlementAllocation[]
}

export type ProposeSettlementInput = {
  requestId: string
  scope: SettlementScope
  spaceId: string | null
  currency: string
  amountMinor: number
  paymentDate: string
  allocations: Array<{
    creditorParticipantId: string
    amountMinor: number
  }>
  note: string | null
}

export type SettlementRepositoryErrorCode =
  | 'not_configured'
  | 'not_found'
  | 'server_rejected'

export class SettlementRepositoryError extends Error {
  readonly code: SettlementRepositoryErrorCode

  constructor(code: SettlementRepositoryErrorCode, message: string = code) {
    super(message)
    this.name = 'SettlementRepositoryError'
    this.code = code
  }
}

export interface SettlementRepository {
  proposeSettlement(input: ProposeSettlementInput): Promise<string>
  listSettlements(): Promise<SettlementPayment[]>
  respondToAllocation(
    allocationId: string,
    response: Extract<SettlementAllocationState, 'accepted' | 'declined'>,
    expectedPaymentVersion: number,
  ): Promise<SettlementMutationResult>
  cancelPendingAllocation(
    allocationId: string,
    expectedPaymentVersion: number,
  ): Promise<SettlementMutationResult>
  reverseAllocation(
    requestId: string,
    allocationId: string,
    expectedPaymentVersion: number,
    reason?: string | null,
  ): Promise<SettlementMutationResult>
}

export type SettlementMutationResult = {
  paymentStatus: SettlementStatus
  paymentVersion: number
  allocationState?: SettlementAllocationState
  reversalId?: string
}

type SettlementAllocationRow = {
  id: string
  settlement_payment_id: string
  creditor_participant_id: string
  amount_minor: number | string
  state: SettlementAllocationState
  responded_at: string | null
  created_at: string
  reversals?: SettlementReversalRow | SettlementReversalRow[]
}

type SettlementReversalRow = {
  id: string
  amount_minor: number | string
}

type SettlementPaymentRow = {
  id: string
  client_request_id: string
  scope: SettlementScope
  space_id: string | null
  debtor_participant_id: string
  currency: string
  amount_minor: number | string
  payment_date: string
  status: SettlementStatus
  version: number
  note: string | null
  reversed_at: string | null
  reversed_by: string | null
  created_at: string
  updated_at: string
  allocations?: SettlementAllocationRow[]
}

function toSafeMinor(value: number | string): number {
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(amount)) {
    throw new SettlementRepositoryError('server_rejected', 'unsafe_minor_amount')
  }
  return amount
}

export function sumSettlementReversalMinor(
  reversals: SettlementReversalRow | SettlementReversalRow[] | null | undefined,
): number {
  const rows = Array.isArray(reversals) ? reversals : reversals ? [reversals] : []
  return rows.reduce(
    (total, reversal) => total + toSafeMinor(reversal.amount_minor),
    0,
  )
}

function mapSettlement(row: SettlementPaymentRow): SettlementPayment {
  return {
    id: row.id,
    clientRequestId: row.client_request_id,
    scope: row.scope,
    spaceId: row.space_id,
    debtorParticipantId: row.debtor_participant_id,
    currency: row.currency,
    amountMinor: toSafeMinor(row.amount_minor),
    paymentDate: row.payment_date,
    status: row.status,
    version: row.version,
    note: row.note,
    reversedAt: row.reversed_at,
    reversedBy: row.reversed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    allocations: (row.allocations ?? []).map((allocation) => ({
      id: allocation.id,
      settlementPaymentId: allocation.settlement_payment_id,
      creditorParticipantId: allocation.creditor_participant_id,
      amountMinor: toSafeMinor(allocation.amount_minor),
      state: allocation.state,
      reversalMinor: sumSettlementReversalMinor(allocation.reversals),
      respondedAt: allocation.responded_at,
      createdAt: allocation.created_at,
    })),
  }
}

function serverRejected(message?: string): SettlementRepositoryError {
  return new SettlementRepositoryError('server_rejected', message)
}

const settlementSelect = `
  id, client_request_id, scope, space_id, debtor_participant_id, currency,
  amount_minor, payment_date, status, version, note, reversed_at, reversed_by,
  created_at, updated_at,
  allocations:settlement_allocations(
    id, settlement_payment_id, creditor_participant_id, amount_minor,
    state, responded_at, created_at,
    reversals:settlement_allocation_reversals(id, amount_minor)
  )
`

function isSettlementStatus(value: unknown): value is SettlementStatus {
  return value === 'pending'
    || value === 'partially_confirmed'
    || value === 'confirmed'
    || value === 'declined'
    || value === 'reversed'
    || value === 'cancelled'
    || value === 'mixed_closed'
}

function parseMutationResult(value: unknown): SettlementMutationResult | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!isSettlementStatus(record.payment_status)
      || typeof record.payment_version !== 'number') return null
  const allocationState = record.allocation_state
  if (allocationState !== undefined
      && allocationState !== 'pending'
      && allocationState !== 'accepted'
      && allocationState !== 'declined'
      && allocationState !== 'reversed'
      && allocationState !== 'cancelled') return null
  if (record.reversal_id !== undefined && typeof record.reversal_id !== 'string') return null
  return {
    paymentStatus: record.payment_status,
    paymentVersion: record.payment_version,
    allocationState,
    reversalId: record.reversal_id as string | undefined,
  }
}

export const settlementRepository: SettlementRepository = {
  async proposeSettlement(input) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('propose_settlement', {
      request_id: input.requestId,
      settlement_scope: input.scope,
      target_space_id: input.spaceId,
      currency_code: input.currency,
      total_amount_minor: input.amountMinor,
      payment_date: input.paymentDate,
      creditor_ids: input.allocations.map((allocation) => allocation.creditorParticipantId),
      allocation_amounts: input.allocations.map((allocation) => allocation.amountMinor),
      settlement_note: input.note,
    })
    if (error || typeof data !== 'string') {
      throw serverRejected(error?.message ?? 'settlement_proposal_failed')
    }
    return data
  },

  async listSettlements() {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase
      .from('settlement_payments')
      .select(settlementSelect)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw serverRejected(error.message)
    return ((data ?? []) as unknown as SettlementPaymentRow[]).map(mapSettlement)
  },

  async respondToAllocation(allocationId, response, expectedPaymentVersion) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('respond_to_settlement', {
      target_allocation_id: allocationId,
      response,
      expected_payment_version: expectedPaymentVersion,
    })
    const result = parseMutationResult(data)
    if (error || !result) {
      throw serverRejected(error?.message ?? 'settlement_response_failed')
    }
    return result
  },

  async cancelPendingAllocation(allocationId, expectedPaymentVersion) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('cancel_pending_settlement_allocation', {
      target_allocation_id: allocationId,
      expected_payment_version: expectedPaymentVersion,
    })
    const result = parseMutationResult(data)
    if (error || !result) {
      throw serverRejected(error?.message ?? 'settlement_cancellation_failed')
    }
    return result
  },

  async reverseAllocation(requestId, allocationId, expectedPaymentVersion, reason = null) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('reverse_settlement_allocation', {
      reversal_request_id: requestId,
      target_allocation_id: allocationId,
      expected_payment_version: expectedPaymentVersion,
      reversal_reason: reason,
    })
    const result = parseMutationResult(data)
    if (error || !result) {
      throw serverRejected(error?.message ?? 'settlement_reversal_failed')
    }
    return result
  },
}

export class InMemorySettlementRepository implements SettlementRepository {
  private readonly paymentsByRequest = new Map<string, SettlementPayment>()
  private readonly manualCreditorIds: ReadonlySet<string>
  private readonly debtorParticipantId: string

  constructor(options: {
    debtorParticipantId?: string
    manualCreditorIds?: Iterable<string>
  } = {}) {
    this.debtorParticipantId = options.debtorParticipantId ?? 'debtor'
    this.manualCreditorIds = new Set(options.manualCreditorIds)
  }

  async proposeSettlement(input: ProposeSettlementInput): Promise<string> {
    const existing = this.paymentsByRequest.get(input.requestId)
    const normalizedNote = input.note?.trim() || null
    if (existing) {
      const sameAllocations = existing.allocations.length === input.allocations.length
        && input.allocations.every((allocation) => existing.allocations.some(
          (current) => (
            current.creditorParticipantId === allocation.creditorParticipantId
            && current.amountMinor === allocation.amountMinor
          ),
        ))
      if (
        existing.scope !== input.scope
        || existing.spaceId !== input.spaceId
        || existing.currency !== input.currency.toUpperCase()
        || existing.amountMinor !== input.amountMinor
        || existing.paymentDate !== input.paymentDate
        || existing.note !== normalizedNote
        || !sameAllocations
      ) {
        throw new SettlementRepositoryError('server_rejected', 'idempotency_conflict')
      }
      return existing.id
    }

    const allocationTotal = input.allocations.reduce(
      (total, allocation) => total + allocation.amountMinor,
      0,
    )
    if (input.allocations.length === 0 || allocationTotal !== input.amountMinor) {
      throw new SettlementRepositoryError('server_rejected', 'settlement_does_not_reconcile')
    }
    if (new Set(input.allocations.map((allocation) => allocation.creditorParticipantId)).size
      !== input.allocations.length) {
      throw new SettlementRepositoryError('server_rejected', 'duplicate_creditor')
    }

    const id = `settlement-${this.paymentsByRequest.size + 1}`
    const now = '2026-08-30T00:00:00.000Z'
    const allocations = input.allocations.map((allocation, index): SettlementAllocation => {
      const manual = this.manualCreditorIds.has(allocation.creditorParticipantId)
      return {
        id: `${id}-allocation-${index + 1}`,
        settlementPaymentId: id,
        creditorParticipantId: allocation.creditorParticipantId,
        amountMinor: allocation.amountMinor,
        state: manual ? 'accepted' : 'pending',
        reversalMinor: 0,
        respondedAt: manual ? now : null,
        createdAt: now,
      }
    })
    const payment: SettlementPayment = {
      id,
      clientRequestId: input.requestId,
      scope: input.scope,
      spaceId: input.spaceId,
      debtorParticipantId: this.debtorParticipantId,
      currency: input.currency.toUpperCase(),
      amountMinor: input.amountMinor,
      paymentDate: input.paymentDate,
      status: recomputeStatus(allocations),
      version: 1,
      note: normalizedNote,
      reversedAt: null,
      reversedBy: null,
      createdAt: now,
      updatedAt: now,
      allocations,
    }
    this.paymentsByRequest.set(input.requestId, payment)
    return id
  }

  async listSettlements(): Promise<SettlementPayment[]> {
    return [...this.paymentsByRequest.values()].map((payment) => ({
      ...payment,
      allocations: payment.allocations.map((allocation) => ({ ...allocation })),
    }))
  }

  async respondToAllocation(
    allocationId: string,
    response: Extract<SettlementAllocationState, 'accepted' | 'declined'>,
    expectedPaymentVersion: number,
  ): Promise<SettlementMutationResult> {
    const match = this.findAllocation(allocationId)
    if (match.allocation.state === response) {
      return {
        allocationState: response,
        paymentStatus: match.payment.status,
        paymentVersion: match.payment.version,
      }
    }
    if (match.allocation.state !== 'pending') {
      throw new SettlementRepositoryError('server_rejected', 'settlement_response_conflict')
    }
    if (match.payment.version !== expectedPaymentVersion) {
      throw new SettlementRepositoryError('server_rejected', 'version_conflict')
    }
    match.allocation.state = response
    match.allocation.respondedAt = '2026-08-30T00:00:00.000Z'
    match.payment.status = recomputeStatus(match.payment.allocations)
    match.payment.version += 1
    return {
      allocationState: response,
      paymentStatus: match.payment.status,
      paymentVersion: match.payment.version,
    }
  }

  async cancelPendingAllocation(
    allocationId: string,
    expectedPaymentVersion: number,
  ): Promise<SettlementMutationResult> {
    const match = this.findAllocation(allocationId)
    if (match.allocation.state === 'cancelled') {
      return {
        allocationState: 'cancelled',
        paymentStatus: match.payment.status,
        paymentVersion: match.payment.version,
      }
    }
    if (match.allocation.state !== 'pending') {
      throw new SettlementRepositoryError('server_rejected', 'allocation_not_pending')
    }
    if (match.payment.version !== expectedPaymentVersion) {
      throw new SettlementRepositoryError('server_rejected', 'version_conflict')
    }
    match.allocation.state = 'cancelled'
    match.allocation.respondedAt = '2026-08-30T00:00:00.000Z'
    match.payment.status = recomputeStatus(match.payment.allocations)
    match.payment.version += 1
    return {
      allocationState: 'cancelled',
      paymentStatus: match.payment.status,
      paymentVersion: match.payment.version,
    }
  }

  async reverseAllocation(
    _requestId: string,
    allocationId: string,
    expectedPaymentVersion: number,
  ): Promise<SettlementMutationResult> {
    const match = this.findAllocation(allocationId)
    if (match.allocation.state !== 'accepted') {
      throw new SettlementRepositoryError('server_rejected', 'allocation_not_accepted')
    }
    if (match.allocation.reversalMinor > 0) {
      throw new SettlementRepositoryError('server_rejected', 'allocation_already_reversed')
    }
    if (match.payment.version !== expectedPaymentVersion) {
      throw new SettlementRepositoryError('server_rejected', 'version_conflict')
    }
    match.allocation.reversalMinor = match.allocation.amountMinor
    match.payment.status = recomputeStatus(match.payment.allocations)
    match.payment.version += 1
    if (match.payment.status === 'reversed') {
      match.payment.reversedAt = '2026-08-30T00:00:00.000Z'
      match.payment.reversedBy = match.allocation.creditorParticipantId
    }
    return {
      paymentStatus: match.payment.status,
      paymentVersion: match.payment.version,
      reversalId: `reversal:${allocationId}`,
    }
  }

  private findAllocation(allocationId: string): {
    payment: SettlementPayment
    allocation: SettlementAllocation
  } {
    for (const payment of this.paymentsByRequest.values()) {
      const allocation = payment.allocations.find((candidate) => candidate.id === allocationId)
      if (allocation) return { payment, allocation }
    }
    throw new SettlementRepositoryError('not_found')
  }
}

function recomputeStatus(allocations: SettlementAllocation[]): SettlementStatus {
  const accepted = allocations.filter(
    (allocation) => allocation.state === 'accepted' && allocation.reversalMinor === 0,
  ).length
  const pending = allocations.filter((allocation) => allocation.state === 'pending').length
  const declined = allocations.filter((allocation) => allocation.state === 'declined').length
  const cancelled = allocations.filter((allocation) => allocation.state === 'cancelled').length
  const historicallyAccepted = allocations.filter(
    (allocation) => allocation.state === 'accepted' || allocation.state === 'reversed',
  ).length
  const reversed = allocations.filter(
    (allocation) => allocation.state === 'reversed' || allocation.reversalMinor > 0,
  ).length

  if (pending > 0 && accepted === 0) return 'pending'
  if (pending > 0 && accepted > 0) return 'partially_confirmed'
  if (accepted === allocations.length) return 'confirmed'
  if (cancelled === allocations.length) return 'cancelled'
  if (declined === allocations.length) return 'declined'
  if (historicallyAccepted === allocations.length && reversed === allocations.length) {
    return 'reversed'
  }
  return 'mixed_closed'
}
