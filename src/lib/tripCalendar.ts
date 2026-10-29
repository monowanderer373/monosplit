import type { Lang } from './i18n'
import { localeForLang } from './locale'
import { validTripPeriod, type TripPeriod } from './tripPeriod'

export const MIN_TRIP_DAY = '0001-01-01', MAX_TRIP_DAY = '9999-12-31'
export function validCalendarDay(day: string) {
  return validTripPeriod({ startDate: day, endDate: day, datesLater: false })
}
export function calendarDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
export function daysInMonth(year: number, month: number) {
  return [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}
export function shiftCalendarMonth(month: string, delta: number) {
  const [year, number] = month.split('-').map(Number), index = (year - 1) * 12 + number - 1 + delta
  if (index < 0 || index >= 9999 * 12) return null
  return `${String(Math.floor(index / 12) + 1).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`
}
export function shiftCalendarDay(day: string, delta: number) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  const next = date.toISOString().slice(0, 10)
  return validCalendarDay(next) ? next : delta < 0 ? MIN_TRIP_DAY : MAX_TRIP_DAY
}
export function calendarWeekday(day: string) { return new Date(`${day}T12:00:00Z`).getUTCDay() }
export function formatTripDate(day: string, lang: Lang, full = false, year = true) {
  if (!validCalendarDay(day)) return day
  return new Intl.DateTimeFormat(localeForLang(lang), { timeZone: 'UTC', year: year ? 'numeric' : undefined, month: full ? 'long' : 'short', day: 'numeric', ...(full ? { weekday: 'long' as const } : {}) }).format(new Date(`${day}T12:00:00Z`))
}
export function formatTripRange(start: string | null, end: string | null, lang: Lang) {
  return [start ? formatTripDate(start, lang, false, lang === 'zh' || !end || start.slice(0, 4) !== end.slice(0, 4)) : '', end ? formatTripDate(end, lang) : ''].filter(Boolean).join(' – ')
}
export type CalendarMode = 'new' | 'start' | 'end' | 'complete'
export function initialCalendarMode(period: TripPeriod): CalendarMode {
  return period.startDate && period.endDate ? 'complete' : period.startDate ? 'end' : period.endDate ? 'start' : 'new'
}
export function chooseTripDay(period: TripPeriod, mode: CalendarMode, day: string): { period: TripPeriod; mode: CalendarMode } {
  if (period.datesLater || !validCalendarDay(day)) return { period, mode }
  if (mode === 'end') {
    if (!period.startDate) return { period, mode: 'start' }
    if (day < period.startDate) return { period, mode }
    return { period: { ...period, endDate: day }, mode: 'complete' }
  }
  const endDate = mode === 'start' && period.endDate >= day ? period.endDate : ''
  return { period: { ...period, startDate: day, endDate }, mode: 'end' }
}
export function periodFromDates(start: string | null, end: string | null): TripPeriod {
  return { startDate: start ?? '', endDate: end ?? '', datesLater: start === null && end === null }
}
export function persistedPeriod(period: TripPeriod) {
  return { startDate: period.datesLater ? null : period.startDate, endDate: period.datesLater ? null : period.endDate }
}
export function sameTripPeriod(a: TripPeriod, b: TripPeriod) {
  const left = persistedPeriod(a), right = persistedPeriod(b)
  return left.startDate === right.startDate && left.endDate === right.endDate
}
