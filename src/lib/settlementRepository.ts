import { supabase } from './supabase'

export type SettlementScope = 'direct' | 'space'
export type SettlementAllocationState = 'pending' | 'accepted' | 'declined' | 'reversed'
export type SettlementStatus =
  | 'pending'
  | 'partially_confirmed'
  | 'confirmed'
  | 'declined'
  | 'reversed'

export type SettlementAllocation = {
  id: string
  settlementPaymentId: string
  creditorParticipantId: string
  amountMinor: number
  state: SettlementAllocationState
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
  ): Promise<SettlementStatus>
  reverseAllocation(allocationId: string): Promise<SettlementStatus>
}

type SettlementAllocationRow = {
  id: string
  settlement_payment_id: string
  creditor_participant_id: string
  amount_minor: number | string
  state: SettlementAllocationState
  responded_at: string | null
  created_at: string
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
  amount_minor, payment_date, status, note, reversed_at, reversed_by,
  created_at, updated_at,
  allocations:settlement_allocations(
    id, settlement_payment_id, creditor_participant_id, amount_minor,
    state, responded_at, created_at
  )
`

function isSettlementStatus(value: unknown): value is SettlementStatus {
  return value === 'pending'
    || value === 'partially_confirmed'
    || value === 'confirmed'
    || value === 'declined'
    || value === 'reversed'
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

  async respondToAllocation(allocationId, response) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('respond_to_settlement', {
      target_allocation_id: allocationId,
      response,
    })
    if (error || !isSettlementStatus(data)) {
      throw serverRejected(error?.message ?? 'settlement_response_failed')
    }
    return data
  },

  async reverseAllocation(allocationId) {
    if (!supabase) throw new SettlementRepositoryError('not_configured')
    const { data, error } = await supabase.rpc('reverse_settlement_allocation', {
      target_allocation_id: allocationId,
    })
    if (error || !isSettlementStatus(data)) {
      throw serverRejected(error?.message ?? 'settlement_reversal_failed')
    }
    return data
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
    if (existing) return existing.id

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
      note: input.note,
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
  ): Promise<SettlementStatus> {
    const match = this.findAllocation(allocationId)
    if (match.allocation.state !== 'pending') {
      throw new SettlementRepositoryError('server_rejected', 'allocation_not_pending')
    }
    match.allocation.state = response
    match.allocation.respondedAt = '2026-08-30T00:00:00.000Z'
    match.payment.status = recomputeStatus(match.payment.allocations)
    return match.payment.status
  }

  async reverseAllocation(allocationId: string): Promise<SettlementStatus> {
    const match = this.findAllocation(allocationId)
    if (match.allocation.state !== 'accepted') {
      throw new SettlementRepositoryError('server_rejected', 'allocation_not_accepted')
    }
    match.allocation.state = 'reversed'
    match.allocation.respondedAt = '2026-08-30T00:00:00.000Z'
    match.payment.status = recomputeStatus(match.payment.allocations)
    if (match.payment.status === 'reversed') {
      match.payment.reversedAt = match.allocation.respondedAt
      match.payment.reversedBy = match.allocation.creditorParticipantId
    }
    return match.payment.status
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
  const accepted = allocations.filter((allocation) => allocation.state === 'accepted').length
  const pending = allocations.filter((allocation) => allocation.state === 'pending').length
  const declined = allocations.filter((allocation) => allocation.state === 'declined').length
  const reversed = allocations.filter((allocation) => allocation.state === 'reversed').length

  if (accepted === allocations.length) return 'confirmed'
  if (accepted > 0) return 'partially_confirmed'
  if (pending > 0) return 'pending'
  if (declined > 0) return 'declined'
  if (reversed === allocations.length) return 'reversed'
  throw new SettlementRepositoryError('server_rejected', 'invalid_allocation_state')
}
