import type { FundingPlan } from './multicurrency'
import { capitalizeDescription } from './description'
import type { ExpenseScope, ParticipantKind } from '../types'
import { normalizeCategory } from './categories'
import { equalMinorShares, parseMajorAmount, reconcileMinorAmounts } from './money'

export type LedgerDraftParticipant = {
  id: string
  displayName: string
  kind: ParticipantKind
}

export type LedgerExpenseDraft = {
  captureSource?: 'manual' | 'template' | 'recurring' | 'natural_language' | 'voice' | 'ocr'
  clientRequestId: string
  scope: ExpenseScope
  spaceId: string | null
  currentParticipantId: string
  amount: string
  currency: string
  description: string
  category: string
  occurredOn: string
  participants: LedgerDraftParticipant[]
  /** Optional for legacy drafts; Trip capture supplies consumption separately. */
  consumerParticipantIds?: string[]
  payerAmounts: Record<string, string>
  splitMode: 'equal' | 'exact'
  exactShareAmounts: Record<string, string>
  fundingAccountId?: string | null
  fundingPlan?: FundingPlan
}

export type CreateExpenseCommand = {
  requestId: string
  scope: ExpenseScope
  spaceId: string | null
  totalMinor: number
  currency: string
  description: string | null
  category: string
  occurredOn: string
  participantIds: string[]
  contributionAmounts: number[]
  shareAmounts: number[]
  fundingAccountId?: string | null
  fundingPlan?: FundingPlan
}

export type LedgerCompileErrorCode =
  | 'invalid_identity'
  | 'invalid_scope'
  | 'invalid_participants'
  | 'invalid_payers'
  | 'invalid_shares'
  | 'invalid_date'
  | 'invalid_amount'

export type LedgerCompileResult =
  | { ok: true; command: CreateExpenseCommand }
  | { ok: false; error: LedgerCompileErrorCode }

function parseNonnegativeMajorAmount(raw: string | undefined, currency: string): number {
  const normalized = (raw ?? '').trim()
  if (normalized === '' || /^0+(?:\.0*)?$/.test(normalized)) return 0
  return parseMajorAmount(normalized, currency)
}

export function compileLedgerExpense(draft: LedgerExpenseDraft): LedgerCompileResult {
  try {
    if (!draft.currentParticipantId || !draft.clientRequestId) {
      return { ok: false, error: 'invalid_identity' }
    }
    if (
      (draft.scope === 'space' && !draft.spaceId)
      || (draft.scope !== 'space' && draft.spaceId != null)
    ) {
      return { ok: false, error: 'invalid_scope' }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.occurredOn)) {
      return { ok: false, error: 'invalid_date' }
    }

    const totalMinor = parseMajorAmount(draft.amount, draft.currency)
    const uniqueParticipants = new Map(draft.participants.map((participant) => [participant.id, participant]))
    if (
      uniqueParticipants.size !== draft.participants.length
      || !uniqueParticipants.has(draft.currentParticipantId)
      || draft.participants.length === 0
      || (draft.scope === 'personal' && (
        draft.participants.length !== 1
        || draft.participants[0]?.id !== draft.currentParticipantId
      ))
    ) {
      return { ok: false, error: 'invalid_participants' }
    }

    const orderedParticipants = [
      uniqueParticipants.get(draft.currentParticipantId)!,
      ...draft.participants.filter((participant) => participant.id !== draft.currentParticipantId),
    ]
    const participantIds = orderedParticipants.map((participant) => participant.id)

    const payerAmounts = Object.fromEntries(
      participantIds.map((participantId) => [
        participantId,
        parseNonnegativeMajorAmount(draft.payerAmounts[participantId], draft.currency),
      ]),
    )
    if (Object.values(payerAmounts).every((amountMinor) => amountMinor === 0) && (!draft.consumerParticipantIds || !Object.values(draft.payerAmounts).some(raw=>raw.trim()))) {
      payerAmounts[draft.currentParticipantId] = totalMinor
    }
    try {
      reconcileMinorAmounts(payerAmounts, totalMinor)
    } catch {
      return { ok: false, error: 'invalid_payers' }
    }

    const consumers = draft.consumerParticipantIds ?? participantIds
    if (!consumers.length || new Set(consumers).size !== consumers.length
      || consumers.some(id => !uniqueParticipants.has(id))
      || (draft.consumerParticipantIds && draft.scope !== 'space')) {
      return { ok: false, error: 'invalid_participants' }
    }
    const equal = draft.splitMode === 'equal' ? equalMinorShares(totalMinor, participantIds.filter(id=>consumers.includes(id))) : null
    const shares = equal
      ? Object.fromEntries(participantIds.map(id => [id, equal.get(id) ?? 0]))
      : Object.fromEntries(
        participantIds.map((participantId) => [
          participantId,
          consumers.includes(participantId) ? parseNonnegativeMajorAmount(draft.exactShareAmounts[participantId], draft.currency) : 0,
        ]),
      )
    try {
      reconcileMinorAmounts(shares, totalMinor)
    } catch {
      return { ok: false, error: 'invalid_shares' }
    }

    return {
      ok: true,
      command: {
        requestId: draft.clientRequestId,
        scope: draft.scope,
        spaceId: draft.spaceId,
        totalMinor,
        currency: draft.currency.toUpperCase(),
        description: capitalizeDescription(draft.description.trim()) || null,
        category: normalizeCategory(draft.category) !== 'Other' ? normalizeCategory(draft.category) : draft.category.trim().slice(0, 100) || 'Other',
        occurredOn: draft.occurredOn,
        participantIds,
        contributionAmounts: participantIds.map((id) => payerAmounts[id]),
        shareAmounts: participantIds.map((id) => shares[id]),
        ...(draft.fundingPlan && payerAmounts[draft.currentParticipantId] > 0 ? {fundingPlan:draft.fundingPlan} : {}),
        ...(draft.fundingAccountId && !draft.fundingPlan && payerAmounts[draft.currentParticipantId] > 0
          ? { fundingAccountId: draft.fundingAccountId } : {}),
      },
    }
  } catch {
    return { ok: false, error: 'invalid_amount' }
  }
}
