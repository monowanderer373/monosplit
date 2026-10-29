import { useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { localeForLang } from '../../lib/locale'
import type { TripPeriod } from '../../lib/tripPeriod'
import { calendarDate, calendarWeekday, chooseTripDay, daysInMonth, formatTripDate, initialCalendarMode, shiftCalendarDay, shiftCalendarMonth, validCalendarDay, type CalendarMode } from '../../lib/tripCalendar'

export default function TripRangeCalendar({ value, onChange, today, disabled = false }: { value: TripPeriod; onChange: (value: TripPeriod) => void; today: string; disabled?: boolean }) {
  const t = useT(), lang = useStore(s => s.lang)
  const initial = validCalendarDay(value.startDate) ? value.startDate : validCalendarDay(value.endDate) ? value.endDate : today
  const [month, setMonth] = useState(initial.slice(0, 7)), [focus, setFocus] = useState(initial)
  const [mode, setMode] = useState<CalendarMode>(() => initialCalendarMode(value))
  const [jump, setJump] = useState(false), [yearText, setYearText] = useState(month.slice(0, 4)), [jumpMonth, setJumpMonth] = useState(Number(month.slice(5)))
  const calendar = useRef<HTMLDivElement>(null), heading = useRef<HTMLButtonElement>(null), focusRequested = useRef(false)
  const [year, number] = month.split('-').map(Number), count = daysInMonth(year, number), firstWeekday = calendarWeekday(month + '-01')
  const monthName = new Intl.DateTimeFormat(localeForLang(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'))
  const locked = disabled || value.datesLater
  useLayoutEffect(() => {
    if (focusRequested.current) { focusRequested.current = false; calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus() }
  }, [focus, month])
  const changeMonth = (next: string) => { setMonth(next); const [y, m] = next.split('-').map(Number); setFocus(calendarDate(y, m, Math.min(Number(focus.slice(8)), daysInMonth(y, m)))) }
  const pick = (day: string) => { if (locked) return; const next = chooseTripDay(value, mode, day); setMode(next.mode); if (next.period !== value) onChange(next.period) }
  const endpoint = (which: 'start' | 'end') => {
    setMode(which === 'end' && !value.startDate ? 'start' : which)
    const day = which === 'start' ? value.startDate : value.endDate || value.startDate
    if (validCalendarDay(day)) { setMonth(day.slice(0, 7)); setFocus(day) }
  }
  const keyDay = (event: React.KeyboardEvent<HTMLButtonElement>, day: string) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    let next: string | null = null
    if (event.key === 'ArrowLeft') next = shiftCalendarDay(day, -1)
    else if (event.key === 'ArrowRight') next = shiftCalendarDay(day, 1)
    else if (event.key === 'ArrowUp') next = shiftCalendarDay(day, -7)
    else if (event.key === 'ArrowDown') next = shiftCalendarDay(day, 7)
    else if (event.key === 'Home') next = shiftCalendarDay(day, -calendarWeekday(day))
    else if (event.key === 'End') next = shiftCalendarDay(day, 6 - calendarWeekday(day))
    else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const target = shiftCalendarMonth(day.slice(0, 7), (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1))
      if (target) { const [y, m] = target.split('-').map(Number); next = calendarDate(y, m, Math.min(Number(day.slice(8)), daysInMonth(y, m))) }
    } else return
    event.preventDefault(); if (next) { focusRequested.current = true; setFocus(next); setMonth(next.slice(0, 7)) }
  }
  const rows = Array.from({ length: Math.ceil((firstWeekday + count) / 7) }, (_, row) => Array.from({ length: 7 }, (_, column) => row * 7 + column - firstWeekday + 1))
  return <div className="td-selection">
    <div className="td-endpoints">
      {(['start', 'end'] as const).map(which => <button type="button" key={which} disabled={locked} className="td-endpoint" aria-pressed={mode === which} onClick={() => endpoint(which)}>
        <span>{t(which === 'start' ? 'tripDates.start' : 'tripDates.end')}</span><strong>{value[which === 'start' ? 'startDate' : 'endDate'] ? formatTripDate(value[which === 'start' ? 'startDate' : 'endDate'], lang) : t('tripDates.choose')}</strong>
      </button>)}
    </div>
    <div className="td-calendar" ref={calendar} aria-disabled={locked}>
      <div className="td-month-bar">
        <button type="button" className="td-month-arrow" aria-label={t('tripDates.previous')} disabled={locked || !shiftCalendarMonth(month, -1)} onClick={() => { const next = shiftCalendarMonth(month, -1); if (next) changeMonth(next) }}>‹</button>
        <button ref={heading} type="button" className="td-month-title" disabled={locked} aria-label={t('tripDates.jump') + ': ' + monthName} aria-expanded={jump} onClick={() => { setYearText(month.slice(0, 4)); setJumpMonth(number); setJump(v => !v) }}>{monthName}<span aria-hidden="true">⌄</span></button>
        <button type="button" className="td-month-arrow" aria-label={t('tripDates.next')} disabled={locked || !shiftCalendarMonth(month, 1)} onClick={() => { const next = shiftCalendarMonth(month, 1); if (next) changeMonth(next) }}>›</button>
      </div>
      {jump && !locked ? <div className="td-jump" role="group" aria-label={t('tripDates.jump')} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setJump(false); heading.current?.focus() } }}>
        <label>{t('tripDates.year')}<input type="text" inputMode="numeric" autoComplete="off" maxLength={4} value={yearText} onChange={event => setYearText(event.target.value)} /></label>
        <label>{t('tripDates.month')}<select value={jumpMonth} onChange={event => setJumpMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, i) => <option value={i + 1} key={i}>{new Intl.DateTimeFormat(localeForLang(lang), { month: 'long', timeZone: 'UTC' }).format(new Date(calendarDate(2026, i + 1, 1) + 'T12:00:00Z'))}</option>)}</select></label>
        <p>{t('tripDates.yearHelp')}</p><button type="button" className="td-link" disabled={!/^\d{1,4}$/.test(yearText) || Number(yearText) < 1 || Number(yearText) > 9999} onClick={() => { changeMonth(calendarDate(Number(yearText), jumpMonth, 1).slice(0, 7)); setJump(false); heading.current?.focus() }}>{t('tripDates.go')}</button>
      </div> : null}
      <div role="grid" aria-label={t('tripDates.calendar')} aria-multiselectable="true">
        <div className="td-week td-weekdays" role="row">{Array.from({ length: 7 }, (_, weekday) => <span role="columnheader" key={weekday} aria-label={new Intl.DateTimeFormat(localeForLang(lang), { weekday: 'long', timeZone: 'UTC' }).format(new Date(`2026-11-${String(weekday + 1).padStart(2, '0')}T12:00:00Z`))}>{new Intl.DateTimeFormat(localeForLang(lang), { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`2026-11-${String(weekday + 1).padStart(2, '0')}T12:00:00Z`))}</span>)}</div>
        {rows.map((row, index) => <div className="td-week" role="row" key={index}>{row.map((day, column) => {
          if (day < 1 || day > count) return <div role="gridcell" className="td-blank" key={column} />
          const iso = calendarDate(year, number, day), selected = !!value.startDate && !!value.endDate && iso >= value.startDate && iso <= value.endDate
          const start = iso === value.startDate, end = iso === value.endDate, invalid = mode === 'end' && !!value.startDate && iso < value.startDate
          return <div role="gridcell" aria-selected={selected || start || end} key={column} className="td-day-cell" data-range={selected} data-start={start} data-end={end}>
            <button type="button" data-date={iso} disabled={locked} aria-disabled={locked || invalid} aria-current={iso === today ? 'date' : undefined} aria-label={formatTripDate(iso, lang, true)} aria-describedby="trip-date-instructions" tabIndex={focus === iso ? 0 : -1} onFocus={() => setFocus(iso)} onKeyDown={event => keyDay(event, iso)} onClick={() => pick(iso)}>{day}</button>
          </div>
        })}</div>)}
      </div>
      {(value.startDate || value.endDate) && (value.startDate || value.endDate).slice(0,7)!==month ? <button type="button" className="td-link td-show-selected" disabled={locked || !value.startDate && !value.endDate} onClick={() => { const selected = value.startDate || value.endDate; if (validCalendarDay(selected)) { changeMonth(selected.slice(0, 7)); setFocus(selected) } }}>{t('tripDates.selected')}</button> : null}
    </div>
    <p id="trip-date-instructions" role="status" aria-live="polite" className="td-help">{t(value.datesLater ? 'tripDates.laterHelp' : mode === 'complete' ? 'tripDates.complete' : mode === 'end' ? 'tripDates.endHelp' : mode === 'start' ? 'tripDates.startHelp' : 'tripDates.new')}</p>
    <label className="td-later"><input type="checkbox" checked={value.datesLater} disabled={disabled} onChange={event => { setJump(false); onChange({ ...value, datesLater: event.target.checked }) }} />{t('travel.datesLater')}</label>
  </div>
}
