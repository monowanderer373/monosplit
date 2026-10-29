import { expect, it } from 'vitest'
import { calendarDate, calendarWeekday, chooseTripDay, daysInMonth, formatTripRange, initialCalendarMode, periodFromDates, sameTripPeriod, shiftCalendarDay, shiftCalendarMonth, validCalendarDay } from './tripCalendar'
const range = { startDate: '2026-11-05', endDate: '2026-11-10', datesLater: false }
it('starts a new range without changing its currency, ledger or a guessed end', () => {
  const first = chooseTripDay(range, 'complete', '2026-12-29')
  expect(first).toEqual({ period: { startDate: '2026-12-29', endDate: '', datesLater: false }, mode: 'end' })
  expect(chooseTripDay(first.period, first.mode, '2027-01-03')).toEqual({ period: { startDate: '2026-12-29', endDate: '2027-01-03', datesLater: false }, mode: 'complete' })
})
it('keeps or clears only the original end when explicitly reselecting Start', () => {
  expect(chooseTripDay(range, 'start', '2026-11-07').period).toEqual({ ...range, startDate: '2026-11-07' })
  expect(chooseTripDay(range, 'start', '2026-11-12').period).toEqual({ ...range, startDate: '2026-11-12', endDate: '' })
})
it('permits one-day trips, refuses reverse selection and never guesses a missing start', () => {
  expect(chooseTripDay(range, 'end', range.startDate).period.endDate).toBe(range.startDate)
  expect(chooseTripDay(range, 'end', '2026-11-03')).toEqual({ period: range, mode: 'end' })
  expect(chooseTripDay({ ...range, startDate: '' }, 'end', '2026-11-09').period.startDate).toBe('')
})
it('preserves a local range while postponed and compares persisted semantics only', () => {
  const postponed = { ...range, datesLater: true }
  expect(chooseTripDay(postponed, 'complete', '2027-01-01').period).toEqual(postponed)
  expect(sameTripPeriod(postponed, periodFromDates(null, null))).toBe(true)
  expect(sameTripPeriod({ ...postponed, datesLater: false }, periodFromDates(null, null))).toBe(false)
  expect(periodFromDates(null, range.endDate)).toEqual({ startDate: '', endDate: range.endDate, datesLater: false })
  expect(initialCalendarMode(periodFromDates(null, range.endDate))).toBe('start')
})
it.each([['0001-01-01', true], ['9999-12-31', true], ['0000-01-01', false], ['10000-01-01', false], ['2028-02-29', true], ['2026-02-29', false], ['1900-02-29', false], ['2000-02-29', true], ['2026-04-31', false]])('validates date-only boundary %s', (day, valid) => expect(validCalendarDay(day as string)).toBe(valid))
it('moves months/days through leap and year boundaries without local-time conversion', () => {
  expect(daysInMonth(2028, 2)).toBe(29); expect(daysInMonth(1900, 2)).toBe(28)
  expect(shiftCalendarMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftCalendarMonth('0001-01', -1)).toBeNull(); expect(shiftCalendarMonth('9999-12', 1)).toBeNull()
  expect(shiftCalendarDay('2028-02-28', 1)).toBe('2028-02-29'); expect(shiftCalendarDay('2026-02-28', 1)).toBe('2026-03-01')
  expect(shiftCalendarDay('0001-01-01', -7)).toBe('0001-01-01'); expect(shiftCalendarDay('9999-12-31', 7)).toBe('9999-12-31')
  expect(calendarDate(1, 1, 1)).toBe('0001-01-01'); expect(calendarWeekday('2026-11-01')).toBe(0)
})
it('shows both years across December/January and localized complete date text', () => {
  expect(formatTripRange('2026-12-29', '2027-01-03', 'en')).toContain('2026')
  expect(formatTripRange('2026-12-29', '2027-01-03', 'en')).toContain('2027')
  expect(formatTripRange(range.startDate, range.endDate, 'zh')).toContain('2026')
})
