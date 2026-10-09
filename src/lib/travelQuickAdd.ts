import type { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import type { HomeSpaceRef } from './homeView'
import { readQuickDraft } from './quickDraft'

type OpenRequest = Parameters<ReturnType<typeof useUniversalQuickAdd>['open']>[0]
/** Revalidate the target through the original composer, restoring only its own draft. */
export function travelQuickAddRequest(trip: HomeSpaceRef, identityId: string): OpenRequest {
  const draft = readQuickDraft(identityId, { kind: 'space', spaceId: trip.id })
  if (draft?.context?.ref.kind === 'space' && draft.context.ref.spaceId === trip.id) {
    return { entryPoint: 'space', context: draft.context.ref, initialValues: draft.values, clientRequestId: draft.clientRequestId }
  }
  return { entryPoint: 'space', spaceCandidateId: trip.id }
}
