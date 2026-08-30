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
  payerAmounts: Record<string, string>
  splitMode: 'equal' | 'exact'
  exactShareAmounts: Record<string, string>
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
    if (Object.values(payerAmounts).every((amountMinor) => amountMinor === 0)) {
      payerAmounts[draft.currentParticipantId] = totalMinor
    }
    try {
      reconcileMinorAmounts(payerAmounts, totalMinor)
    } catch {
      return { ok: false, error: 'invalid_payers' }
    }

    const shares = draft.splitMode === 'equal'
      ? Object.fromEntries(equalMinorShares(totalMinor, participantIds))
      : Object.fromEntries(
        participantIds.map((participantId) => [
          participantId,
          parseNonnegativeMajorAmount(draft.exactShareAmounts[participantId], draft.currency),
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
        description: draft.description.trim() || null,
        category: normalizeCategory(draft.category || 'Other'),
        occurredOn: draft.occurredOn,
        participantIds,
        contributionAmounts: participantIds.map((id) => payerAmounts[id]),
        shareAmounts: participantIds.map((id) => shares[id]),
      },
    }
  } catch {
    return { ok: false, error: 'invalid_amount' }
  }
}
