import { monthLabel } from '../../lib/spendingView'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../lib/i18n'
import { localCalendarDate } from '../../lib/homeView'
import { localeForLang } from '../../lib/locale'
import type { SpendingFilter } from '../../lib/spendingView'
import { InsightIcon } from './SpendingUI'
import { useContentFit } from './useContentFit'

type Kind = 'month' | 'scope'
type Open = { kind: Kind; anchor: HTMLButtonElement }

/** Nonmodal anchored surface: no scrim, no background inertness, no second picker window. */
function PaperPopover({ open, label, close, onEscape, children }: { open: Open; label: string; close: (focus?: boolean) => void; onEscape?: () => boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' })
  const closeRef = useRef(close)
  const escapeRef = useRef(onEscape)
  useLayoutEffect(() => { closeRef.current = close; escapeRef.current = onEscape })
  useLayoutEffect(() => {
    const place = () => {
      const popup = ref.current
      if (!popup) return
      const anchor = open.anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const leftEdge = (viewport?.offsetLeft ?? 0) + 16
      const topEdge = (viewport?.offsetTop ?? 0) + 16
      const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth) - 32
      const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight) - 32
      const width = Math.min(Math.max(326, 20.375 * parseFloat(getComputedStyle(document.documentElement).fontSize)), rightEdge - leftEdge)
      const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - width))
      const desiredHeight = (popup.querySelector<HTMLElement>('.i-popover-content')?.scrollHeight ?? popup.scrollHeight) + 34
      const below = bottomEdge - anchor.bottom - 8
      const above = anchor.top - topEdge - 8
      const flip = below < Math.min(desiredHeight, 180) && above > below
      const height = Math.max(60, Math.min(bottomEdge - topEdge, flip ? above : below))
      const top = flip ? Math.max(topEdge, anchor.top - Math.min(desiredHeight, height) - 8) : Math.max(topEdge, Math.min(anchor.bottom + 8, bottomEdge - Math.min(desiredHeight, height)))
      setPosition({ position: 'fixed', left, top, width, maxHeight: height, visibility: 'visible', '--i-arrow-left': `${Math.max(14, Math.min(width - 26, anchor.left + anchor.width / 2 - left))}px`, '--i-arrow-top': flip ? 'auto' : '-5px', '--i-arrow-bottom': flip ? '-5px' : 'auto', '--i-arrow-rotation': flip ? '225deg' : '45deg' } as CSSProperties)
    }
    place()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    if (ref.current) observer?.observe(ref.current); if (ref.current?.firstElementChild) observer?.observe(ref.current.querySelector('.i-popover-content')!)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.visualViewport?.removeEventListener('resize', place) }
  }, [open])
  useEffect(() => {
    const popup = ref.current
    const frame = requestAnimationFrame(() => (popup?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? popup?.querySelector<HTMLElement>('button'))?.focus())
    const outside = (event: PointerEvent) => { if (!popup?.contains(event.target as Node) && !open.anchor.contains(event.target as Node)) closeRef.current(true) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); if (!escapeRef.current?.()) closeRef.current(true) } }
    const focus = (event: FocusEvent) => { if (!popup?.contains(event.target as Node) && !open.anchor.contains(event.target as Node)) closeRef.current(false) }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', focus)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); document.removeEventListener('focusin', focus) }
  }, [open])
  return createPortal(<div ref={ref} id={`insights-${open.kind}-popover`} className={`tt-insights i-popover i-${open.kind}-popover`} style={position} role="dialog" aria-label={label}
    onKeyDown={event => {
      const target = event.target as HTMLElement
      const group = target.closest('[data-choice-group]')
      if (!group || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      const choices = [...group.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
      const index = choices.indexOf(target as HTMLButtonElement)
      if (index < 0) return
      const columns = Number(group.getAttribute('data-columns') ?? 1)
      const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (index + step + choices.length) % choices.length
      event.preventDefault(); choices[next]?.focus()
    }}>
    <span className="i-popover-arrow" aria-hidden="true" /><img className="i-popover-corner" src="/assets/insights/denim-corner.svg" alt="" />
    <div className="i-popover-content">{children}</div>
  </div>, document.body)
}

export default function InsightsFilters({ filter, timezone, lang, update, initialMonthOpen = false }: { filter: SpendingFilter; timezone: string; lang: 'en' | 'zh'; update: (patch: Partial<SpendingFilter>) => void; initialMonthOpen?: boolean }) {
  const t = useT()
  const filterRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const yearRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const [browseYear, setBrowseYear] = useState(Number(filter.month.slice(0, 4)))
  const [years, setYears] = useState(false)
  const close = (focus = true) => { if (focus) open?.anchor.focus(); setOpen(null) }
  const commit = (patch: Partial<SpendingFilter>) => { update(patch); close() }
  const toggle = (kind: Kind, anchor: HTMLButtonElement) => {
    if (open?.kind === kind) { close(); return }
    if (kind === 'month') { setBrowseYear(Number(filter.month.slice(0, 4))); setYears(false) }
    setOpen({ kind, anchor })
  }
  const label = (kind: Kind) => t(`spending.${kind}`)
  const value = (kind: Kind) => kind === 'month' ? monthLabel(filter.month, lang) : t(`spending.${filter.scope}`)
  const scopes = ['all', 'personal', 'shared'] as const
  const firstYear = Math.min(9988, Math.max(1, browseYear - 5))
  useContentFit(filterRef, [filter.month, filter.scope, lang].join(':'))
  useContentFit(gridRef, [open?.kind, years, browseYear, lang].join(':'), true)
  useEffect(() => {
    if (!initialMonthOpen) return
    const frame = requestAnimationFrame(() => filterRef.current?.querySelector<HTMLButtonElement>('.i-filter-button--month')?.click())
    return () => cancelAnimationFrame(frame)
  }, [initialMonthOpen])
  const returnMonths = () => { setYears(false); requestAnimationFrame(() => yearRef.current?.focus()) }
  return <>
    <div ref={filterRef} className="i-filter-row" data-layout="row">{(['month', 'scope'] as const).map(kind => <div key={kind} className={"i-field-" + kind}>
      <button type="button" className={`i-filter-button i-filter-button--${kind}`} aria-label={`${label(kind)}: ${value(kind)}`} aria-haspopup="dialog" aria-expanded={open?.kind === kind} aria-controls={open?.kind === kind ? `insights-${kind}-popover` : undefined} onClick={event => toggle(kind, event.currentTarget)}>
        <InsightIcon name={kind === 'month' ? 'calendar' : 'layers'} /><span className="i-filter-value">{value(kind)}</span><InsightIcon className="i-filter-chevron" name={`chevron-${open?.kind === kind ? 'up' : 'down'}`} />
      </button>
    </div>)}</div>
    {open ? <PaperPopover open={open} label={label(open.kind)} close={close} onEscape={() => { if (open.kind === 'month' && years) { returnMonths(); return true } return false }}>
      {open.kind === 'month' ? <>
        <div className="i-year-row">
          <button className="i-icon-button" disabled={browseYear <= 1} aria-label={t(years ? 'spending.previousYears' : 'spending.previousYear')} onClick={() => setBrowseYear(year => Math.max(1, year - (years ? 12 : 1)))}><InsightIcon name="chevron-left" /></button>
          {years ? <span className="i-year-range">{firstYear}–{firstYear + 11}</span> : <button ref={yearRef} className="i-year-button" aria-label={`${t('spending.chooseYear')}: ${browseYear}`} aria-expanded={false} onClick={() => setYears(true)}>{browseYear}<InsightIcon name="chevron-down" /></button>}
          <button className="i-icon-button" disabled={browseYear >= 9999} aria-label={t(years ? 'spending.nextYears' : 'spending.nextYear')} onClick={() => setBrowseYear(year => Math.min(9999, year + (years ? 12 : 1)))}><InsightIcon name="chevron-right" /></button>
        </div>
        <div ref={gridRef} className="i-month-grid" data-choice-group data-columns="4">
          {years ? Array.from({ length: 12 }, (_, index) => firstYear + index).map(year => <button key={year} className="i-month-option" aria-pressed={year === browseYear} onClick={() => { setBrowseYear(year); returnMonths() }}><span className="i-month-face">{String(year).padStart(4, '0')}</span></button>) : Array.from({ length: 12 }, (_, index) => {
            const month = `${String(browseYear).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
            const date = new Date(`${month}-01T00:00:00Z`)
            return <button key={month} className="i-month-option" aria-label={monthLabel(month, lang, 'long')} aria-pressed={filter.month === month} onClick={() => commit({ month })}><span className="i-month-face">{new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : localeForLang(lang), { month: 'short', timeZone: 'UTC' }).format(date)}</span></button>
          })}
        </div>
        <div className="i-popover-footer">{years ? <button className="i-link" onClick={returnMonths}><InsightIcon name="chevron-left" />{t('spending.months')}</button> : <button className="i-link" onClick={() => commit({ month: localCalendarDate(new Date(), timezone).slice(0, 7) })}><InsightIcon name="calendar" />{t('spending.thisMonth')}</button>}</div>
      </> : <div data-choice-group>{scopes.map((scope, index) => <button key={scope} className="i-scope-option" aria-label={t(`spending.${scope}`)} aria-describedby={`scope-${scope}-description`} aria-pressed={filter.scope === scope} onClick={() => commit({ scope })}>
        <span className="i-record-icon"><InsightIcon name={['layers', 'user', 'users'][index]} /></span><span><span className="i-option-title">{t(`spending.${scope}`)}</span><span className="i-option-meta" id={`scope-${scope}-description`}>{t(`spending.${scope}Help`)}</span></span>{filter.scope === scope ? <span className="i-check"><InsightIcon name="check" /></span> : <span />}
      </button>)}</div>}
    </PaperPopover> : null}
  </>
}
