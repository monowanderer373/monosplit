import { afterEach, expect, it } from 'vitest'
import { migratePersistedState, useStore } from './useStore'
afterEach(() => useStore.setState({ travelTripByIdentity: {} }))
it('keeps each identity selection independent and clears the signing-out identity', () => {
  useStore.getState().setTravelTrip('a', 'trip-one')
  useStore.getState().setTravelTrip('b', 'trip-two')
  expect(useStore.getState().travelTripByIdentity).toEqual({ a: 'trip-one', b: 'trip-two' })
  useStore.getState().clearLedgerIdentity('a')
  expect(useStore.getState().travelTripByIdentity).toEqual({ b: 'trip-two' })
})
it('migrates older stores without assigning a global trip to a different identity', () => {
  expect(migratePersistedState({ homeUi: { selectedTripId: 'old' } }).travelTripByIdentity).toEqual({})
})
