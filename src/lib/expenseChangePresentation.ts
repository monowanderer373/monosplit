import type { CanonicalExpense } from '../types'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'

export type DirectChangePresentation = {
  currentExpense: CanonicalExpense | null
  historicalExpense: CanonicalExpense | null
  proposedExpense: CanonicalExpense | null
  candidateAffectsCurrentAmount: false
  approvedCount: number
  visibleApprovalCount: number
  hasCompleteApprovalProgress: boolean
  canRespond: boolean
  canWithdraw: boolean
}

export type DirectChangeHistoryState =
  | 'correction_proposed'
  | 'correction_approved'
  | 'correction_declined'
  | 'correction_withdrawn'
  | 'cancellation_requested'
  | 'expense_cancelled'
  | 'cancellation_declined'
  | 'cancellation_withdrawn'

export function deriveDirectChangeHistoryState(
  request: Pick<DirectExpenseChangeRequest, 'kind' | 'state'>,
): DirectChangeHistoryState {
  if (request.kind === 'correction') {
    if (request.state === 'pending') return 'correction_proposed'
    if (request.state === 'authoritative') return 'correction_approved'
    if (request.state === 'declined') return 'correction_declined'
    return 'correction_withdrawn'
  }
  if (request.state === 'pending') return 'cancellation_requested'
  if (request.state === 'authoritative') return 'expense_cancelled'
  if (request.state === 'declined') return 'cancellation_declined'
  return 'cancellation_withdrawn'
}

export function deriveDirectChangePresentation(input: {
  request: DirectExpenseChangeRequest
  targetExpense: CanonicalExpense
  replacementExpense: CanonicalExpense | null
  currentParticipantId: string
}): DirectChangePresentation {
  const {
    request,
    targetExpense,
    replacementExpense,
    currentParticipantId,
  } = input
  const authoritativeCorrection = (
    request.state === 'authoritative'
    && request.kind === 'correction'
  )
  const authoritativeCancellation = (
    request.state === 'authoritative'
    && request.kind === 'cancellation'
  )
  const ownApproval = request.approvals.find((approval) => (
    approval.participantId === currentParticipantId
  ))

  return {
    currentExpense: authoritativeCancellation
      ? null
      : authoritativeCorrection
        ? replacementExpense
        : targetExpense,
    historicalExpense: authoritativeCorrection || authoritativeCancellation
      ? targetExpense
      : null,
    proposedExpense: request.state === 'pending' && request.kind === 'correction'
      ? replacementExpense
      : null,
    candidateAffectsCurrentAmount: false,
    approvedCount: request.approvals.filter((approval) => (
      approval.state === 'accepted'
    )).length,
    visibleApprovalCount: request.approvals.length,
    hasCompleteApprovalProgress: request.proposedBy === currentParticipantId,
    canRespond: request.state === 'pending' && ownApproval?.state === 'pending',
    canWithdraw: request.state === 'pending'
      && request.proposedBy === currentParticipantId,
  }
}
