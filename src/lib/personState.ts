import type {
  PersonRelationship,
  PersonState,
} from '../types'
import type { LedgerDraftParticipant } from './compileExpense'

export function derivePersonState(input: {
  linkedParticipantId: string | null
  hasPendingLinkRequest: boolean
}): PersonState {
  if (input.linkedParticipantId) return 'linked'
  return input.hasPendingLinkRequest ? 'link-pending' : 'manual'
}

export function isPersonDirectEligible(
  person: PersonRelationship,
): boolean {
  if (!person.linkedParticipantId) {
    return Boolean(person.primaryManualParticipantId)
  }
  return person.friendshipStatus === 'accepted'
}

export function resolvePersonFinancialParticipant(
  person: PersonRelationship,
): LedgerDraftParticipant | null {
  if (person.linkedParticipantId) {
    return {
      id: person.linkedParticipantId,
      kind: 'account',
      displayName: person.displayName,
    }
  }
  if (!person.primaryManualParticipantId) return null
  return {
    id: person.primaryManualParticipantId,
    kind: 'manual',
    displayName: person.displayName,
  }
}
