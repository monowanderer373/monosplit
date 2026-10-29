export const TRIP_DATES_CHANGED = 'tt:trip-dates-changed'
export function notifyTripDatesChanged(identity: string, participantId: string, spaceId: string) {
  window.dispatchEvent(new CustomEvent(TRIP_DATES_CHANGED, { detail: { identity, participantId, spaceId } }))
}
