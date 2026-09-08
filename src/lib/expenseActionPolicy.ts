import type { CanonicalExpense, GroupRole } from '../types'
import type { DirectExpenseChangeRequest } from './expenseChangeRepository'

export type ExpenseAction =
  | 'edit_metadata'
  | 'edit_financials'
  | 'propose_correction'
  | 'cancel'
  | 'request_cancellation'
  | 'view_request'

export type ExpenseActionClassification =
  | 'personal'
  | 'manual_direct'
  | 'linked_direct_pending'
  | 'linked_direct_confirmed'
  | 'space'
  | 'correction_pending'
  | 'superseded'
  | 'cancelled'
  | 'terminal'

export type ExpenseActionPolicy = {
  classification: ExpenseActionClassification
  actions: ExpenseAction[]
  financialEditRequiresReconfirmation: boolean
  mutationBlocked: boolean
}

export type FinancialFailureDisposition =
  | 'refetch'
  | 'fail_closed'
  | 'show_error'

export function financialFailureDisposition(code: string): FinancialFailureDisposition {
  if (code === 'financial_invariant_violation') return 'fail_closed'
  if (
    code === 'version_conflict'
    || code === 'change_request_exists'
    || code === 'request_not_pending'
    || code === 'change_request_not_pending'
    || code === 'change_request_not_found'
    || code === 'change_request_terminal_conflict'
    || code === 'target_changed'
    || code === 'replacement_changed'
  ) return 'refetch'
  return 'show_error'
}

export function isOwnerLocalExpense(
  expense: CanonicalExpense,
  currentParticipantId: string,
): boolean {
  if (expense.createdBy !== currentParticipantId) return false
  if (expense.scope === 'personal') return true
  return expense.scope === 'direct' && expense.participations.every((participation) => (
    participation.participantId === expense.createdBy
    || (
      participation.state === 'untracked'
      && participation.trackingMode === 'untracked'
    )
  ))
}

export function deriveExpenseActionPolicy(input: {
  expense: CanonicalExpense
  currentParticipantId: string
  spaceRole?: GroupRole | null
  pendingRequest?: DirectExpenseChangeRequest | null
}): ExpenseActionPolicy {
  const {
    expense,
    currentParticipantId,
    spaceRole = null,
    pendingRequest = null,
  } = input

  if (expense.status === 'correction_pending') {
    return policy('correction_pending', pendingRequest ? ['view_request'] : [], false, true)
  }
  if (expense.status === 'voided') {
    const classification = expense.terminationKind === 'corrected'
      ? 'superseded'
      : expense.terminationKind === 'cancelled'
        ? 'cancelled'
        : 'terminal'
    return policy(classification, pendingRequest ? ['view_request'] : [], false, true)
  }

  if (expense.scope === 'personal') {
    const owner = expense.createdBy === currentParticipantId
    return policy(
      'personal',
      owner ? ['edit_metadata', 'edit_financials', 'cancel'] : [],
      false,
      !owner,
    )
  }

  if (expense.scope === 'space') {
    const authorized = expense.createdBy === currentParticipantId || spaceRole === 'owner'
    return policy(
      'space',
      authorized ? ['edit_metadata', 'propose_correction', 'cancel'] : [],
      false,
      !authorized,
    )
  }

  const creator = expense.createdBy === currentParticipantId
  const nonCreatorTracked = expense.participations.filter((participation) => (
    participation.participantId !== expense.createdBy
    && participation.trackingMode === 'tracked'
  ))
  const linked = nonCreatorTracked.length > 0
  const confirmed = nonCreatorTracked.some((participation) => (
    participation.state === 'accepted'
  ))
  const classification = !linked
    ? 'manual_direct'
    : confirmed
      ? 'linked_direct_confirmed'
      : 'linked_direct_pending'

  if (pendingRequest) {
    return policy(classification, ['view_request'], false, true)
  }
  if (!creator) return policy(classification, [], false, true)
  if (confirmed) {
    return policy(
      classification,
      ['edit_metadata', 'propose_correction', 'request_cancellation'],
      false,
      false,
    )
  }
  return policy(
    classification,
    ['edit_metadata', 'edit_financials', 'cancel'],
    linked,
    false,
  )
}

function policy(
  classification: ExpenseActionClassification,
  actions: ExpenseAction[],
  financialEditRequiresReconfirmation: boolean,
  mutationBlocked: boolean,
): ExpenseActionPolicy {
  return {
    classification,
    actions,
    financialEditRequiresReconfirmation,
    mutationBlocked,
  }
}
