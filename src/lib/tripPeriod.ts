export type TripPeriod = { startDate: string; endDate: string; datesLater: boolean }
export function validTripPeriod(period: TripPeriod): boolean {
  if (period.datesLater) return true
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && value >= '0001-01-01' && value <= '9999-12-31'
    && !Number.isNaN(Date.parse(`${value}T12:00:00Z`))
    && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value
  return validDate(period.startDate) && validDate(period.endDate) && period.endDate >= period.startDate
}
export function tripPeriodStatus(trip: { status: string; startDate: string | null; endDate: string | null }, today: string) {
  if (trip.status === 'archived') return 'archived'
  if (trip.status !== 'active' || (trip.endDate && trip.endDate < today)) return 'ended'
  if (trip.startDate && trip.startDate > today) return 'upcoming'
  if (!trip.startDate && !trip.endDate) return 'unplanned'
  return 'active'
}
export const tripPeriodStatusKeys = {
  archived: 'travel.archived', ended: 'travel.ended', upcoming: 'travel.upcoming',
  unplanned: 'travel.datesNotSet', active: 'travel.active',
} as const
