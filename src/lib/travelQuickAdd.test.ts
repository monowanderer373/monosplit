/** @vitest-environment jsdom */
import { afterEach, expect, it } from 'vitest'
import { createUniversalQuickAddSession, updateUniversalQuickAddValues } from './universalQuickAdd'
import { writeQuickDraft } from './quickDraft'
import { travelQuickAddRequest } from './travelQuickAdd'
const trip = { id: 'trip-a', type: 'trip' as const, name: 'Weekend', status: 'active' as const, startDate: null, endDate: null, updatedAt: '' }
afterEach(() => localStorage.clear())
it('restores matching same-day values and request identity while revalidating the trip', () => {
  const draft = updateUniversalQuickAddValues(createUniversalQuickAddSession({ identityKey: 'user-a', sessionId: 'session', clientRequestId: 'request', startedAtMs: Date.now(), entryPoint: 'space',
    context: { ref: { kind: 'space', spaceId: trip.id, spaceType: 'trip', displayName: trip.name }, currentParticipantId: 'owner', availableParticipants: [{ id: 'owner', displayName: 'Me', kind: 'account' }], defaultCurrency: 'MYR' } }), { amount: '12.34', description: 'Saved draft' })
  writeQuickDraft('user-a', draft)
  const request = travelQuickAddRequest(trip, 'user-a')
  expect(request.context).toEqual(draft.context!.ref)
  expect(request.initialValues?.amount).toBe('12.34')
  expect(request.clientRequestId).toBe('request')
  expect(travelQuickAddRequest({ ...trip, id: 'trip-b' }, 'user-a').initialValues).toBeUndefined()
  expect(travelQuickAddRequest(trip, 'user-b').initialValues).toBeUndefined()
})
