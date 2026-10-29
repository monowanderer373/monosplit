// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TripRangeCalendar from './TripRangeCalendar'
import type { TripPeriod } from '../../lib/tripPeriod'
import { useStore } from '../../store/useStore'
const initial = { startDate: '2026-11-05', endDate: '2026-11-10', datesLater: false }, changed = vi.fn()
function Harness({ period = initial }: { period?: TripPeriod }) { const [value, setValue] = useState(period); return <TripRangeCalendar value={value} today="2026-10-29" onChange={next => { changed(next); setValue(next) }} /> }
beforeEach(() => { changed.mockReset(); useStore.setState({ lang: 'en' }) }); afterEach(cleanup)
function day(iso: string) { return document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)! }
it('initializes the existing range without committing; browsing and keyboard focus are not selection', () => {
  render(<Harness />); expect(day('2026-11-07').parentElement?.getAttribute('aria-selected')).toBe('true')
  expect(day('2026-11-05').getAttribute('aria-label')).toMatch(/5.*November.*2026/)
  day('2026-11-05').focus(); fireEvent.keyDown(day('2026-11-05'), { key: 'ArrowRight' }); expect(document.activeElement).toBe(day('2026-11-06'))
  fireEvent.keyDown(day('2026-11-06'), { key: 'Home' }); expect(document.activeElement).toBe(day('2026-11-01'))
  fireEvent.click(screen.getByRole('button', { name: 'Next month' })); expect(changed).not.toHaveBeenCalled()
})
it('starts a new range and explicitly edits its endpoints without swapping reverse dates', () => {
  render(<Harness />); fireEvent.click(day('2026-11-12')); expect(changed).toHaveBeenLastCalledWith({ startDate: '2026-11-12', endDate: '', datesLater: false })
  fireEvent.click(day('2026-11-11')); expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls.at(-1)?.[0].endDate).toBe('')
  fireEvent.click(day('2026-11-15')); fireEvent.click(screen.getByRole('button', { name: /^Start/ })); fireEvent.click(day('2026-11-14'))
  expect(changed).toHaveBeenLastCalledWith({ startDate: '2026-11-14', endDate: '2026-11-15', datesLater: false })
  fireEvent.click(screen.getByRole('button', { name: /^End/ })); fireEvent.click(day('2026-11-14')); expect(changed.mock.calls.at(-1)?.[0].endDate).toBe('2026-11-14')
})
it('postpones dates locally and restores the original range on uncheck', () => {
  render(<Harness />); fireEvent.click(screen.getByRole('checkbox', { name: 'Dates not decided yet' })); expect(day('2026-11-05').disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Dates not decided yet' })); expect(day('2026-11-05').disabled).toBe(false)
  expect(changed).toHaveBeenLastCalledWith(initial)
})
it('jumps to arbitrary legal years/months and validates the year without changing dates', () => {
  render(<Harness />); fireEvent.click(screen.getByRole('button', { name: /^Choose month and year:/ })); fireEvent.change(screen.getByLabelText('Year'), { target: { value: '0' } }); expect(screen.getByRole('button', { name: 'Go to month' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Year'), { target: { value: '1' } }); fireEvent.change(screen.getByLabelText('Month'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Go to month' })); expect(day('0001-01-01')).toBeTruthy(); expect(screen.getByRole('button', { name: 'Previous month' }).hasAttribute('disabled')).toBe(true); expect(changed).not.toHaveBeenCalled()
})
