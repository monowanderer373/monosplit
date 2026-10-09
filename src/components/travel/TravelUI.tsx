import { useEffectEvent, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { HomeScreenProps } from '../home/HomeScreen'
import type { CurrencyAmount, HomeSpaceRef, HomeTripSelection } from '../../lib/homeView'
import { useT } from '../../lib/i18n'
import { formatDate, localeForLang } from '../../lib/locale'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'
import MoneyText from '../MoneyText'
import './travel-tokens.css'
import './travel-components.css'
import './travel-integration.css'

export function TravelIcon({ name }: { name: string }) {
  return <svg className="tt-icon" aria-hidden="true"><use href={`/travel/icons.svg#${name}`} /></svg>
}

export function TravelStatus({ trip }: { trip: HomeTripSelection }) {
  const t = useT()
  const key = trip.trip.status === 'archived' ? 'travel.archived' : trip.phase === 'ended' ? 'travel.completed' : 'travel.active'
  return <span className="tt-status"><span className="tt-status-dot" aria-hidden="true" />{t(key)}</span>
}

export function TripDateLine({ trip }: { trip: HomeSpaceRef }) {
  const lang = useStore(s => s.lang)
  return <>{[trip.startDate ? formatDate(trip.startDate, lang) : null,
    trip.endDate ? formatDate(trip.endDate, lang) : null].filter(Boolean).join(' – ')}
    {(trip.startDate || trip.endDate) && trip.defaultCurrency ? ' · ' : ''}{trip.defaultCurrency ?? ''}</>
}

export function TravelAmount({ lines, currency, hidden, status }: {
  lines: readonly CurrencyAmount[]; currency?: string; hidden: boolean; status: 'loading' | 'error' | 'ready'
}) {
  const t = useT()
  const lang = useStore(s => s.lang)
  if (status !== 'ready') return <span className="tt-amount-state" role="status">{t(status === 'loading' ? 'home.loading' : 'home.amountUnavailable')}</span>
  if (hidden) return <span aria-label={t('travel.concealed')}>••••</span>
  const display = lines.length ? lines : currency ? [{ currency, amountMinor: 0 }] : []
  return <>{display.length ? display.map(line => <span className="tt-amount-line" key={line.currency}>
    <MoneyText value={formatMinorAmount(line.amountMinor, line.currency, localeForLang(lang))} />
  </span>) : '—'}</>
}

export function AnchoredPaperPopover({ anchor, onClose, children, label, initialFocus }: {
  anchor: RefObject<HTMLButtonElement | null>; onClose: () => void; children: ReactNode; label: string; initialFocus?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useEffectEvent(onClose)
  const [position, setPosition] = useState({ left: 16, top: 0, height: 360, arrow: 30, flip: false })
  useLayoutEffect(() => {
    const place = () => {
      const target = anchor.current, surface = panel.current
      if (!target || !surface) return
      const rect = target.getBoundingClientRect()
      const viewport = window.visualViewport
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      const offsetLeft = viewport?.offsetLeft ?? 0, offsetTop = viewport?.offsetTop ?? 0
      const panelWidth = Math.min(280, width - 32)
      const below = height + offsetTop - rect.bottom - 24, above = rect.top - offsetTop - 24
      const flip = below < Math.min(surface.scrollHeight, 250) && above > below
      const available = Math.min(360, Math.max(160, flip ? above : below), height - 32)
      const actualHeight = Math.min(surface.scrollHeight, available)
      const left = Math.max(offsetLeft + 16, Math.min(rect.left, offsetLeft + width - panelWidth - 16))
      setPosition({ left, top: Math.max(offsetTop + 16, Math.min(flip ? rect.top - actualHeight - 8 : rect.bottom + 8, offsetTop + height - actualHeight - 16)),
        height: available, arrow: Math.max(12, Math.min(panelWidth - 20, rect.left + rect.width / 2 - left)), flip })
    }
    place()
    const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null
    if (anchor.current) resize?.observe(anchor.current)
    if (panel.current) resize?.observe(panel.current)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !anchor.current?.contains(event.target)) close()
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    panel.current?.querySelector<HTMLElement>(initialFocus ?? 'button')?.focus({ preventScroll: true })
    return () => {
      resize?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place)
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape)
    }
  }, [anchor, initialFocus])
  return createPortal(<div ref={panel} className="tt-travel tt-popover" role="dialog" aria-label={label} data-state="open" data-flipped={position.flip}
    style={{ position: 'fixed', left: position.left, top: position.top, maxHeight: position.height, width: Math.min(280, (window.visualViewport?.width ?? window.innerWidth) - 32) }}>
    <span className="tt-popover-arrow" aria-hidden="true" style={{ left: position.arrow }} />
    <img className="tt-paper-fold" src="/travel/denim-corner.svg" alt="" />{children}
  </div>, document.body)
}

function TripSelector({ props }: { props: HomeScreenProps }) {
  const t = useT(), id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(0)
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  const choose = (id: string) => { props.onSelectTrip(id); close() }
  return <>
    <button ref={trigger} className="tt-trip-label" type="button" data-testid="home-trip-selector" title={props.trip?.trip.name}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => { if (open) close(); else { setFocusIndex(Math.max(0, props.trips.findIndex(x => x.id === props.trip?.trip.id))); setOpen(true) } }}>
      <span className="tt-trip-label-text">{props.trip?.trip.name}</span><TravelIcon name={open ? 'chevron-up' : 'chevron-down'} />
    </button>
    {open ? <AnchoredPaperPopover anchor={trigger} onClose={close} label={t('travel.switchTrip')} initialFocus="[aria-selected='true']">
      <p className="tt-popover-heading">{t('travel.switchTrip')}</p>
      <div id={id} className="tt-trip-options" role="listbox" aria-label={t('travel.switchTrip')}
        onKeyDown={event => {
          const options = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="option"]'))
          const current = options.indexOf(document.activeElement as HTMLElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : event.key === 'ArrowDown'
            ? (current + 1) % options.length : event.key === 'ArrowUp' ? (current - 1 + options.length) % options.length : null
          if (next != null && options[next]) { event.preventDefault(); setFocusIndex(next); options[next].focus() }
        }}>
        {props.trips.map((trip, index) => <button type="button" role="option" className="tt-trip-option" key={trip.id}
          aria-selected={trip.id === props.trip?.trip.id} tabIndex={focusIndex === index ? 0 : -1} onClick={() => choose(trip.id)}>
          <span className="tt-option-icon"><TravelIcon name={trip.id === props.trip?.trip.id ? 'map' : 'pin'} /></span>
          <span><span className="tt-option-title">{trip.name}</span><span className="tt-option-meta"><TripDateLine trip={trip} />{trip.status === 'archived' ? ` · ${t('travel.archived')}` : ''}</span></span>
          {trip.id === props.trip?.trip.id ? <span className="tt-option-check"><TravelIcon name="check" /></span> : <span className="tt-option-unselected" aria-hidden="true" />}
        </button>)}
      </div>
      <div className="tt-popover-footer">
        <button className="tt-popover-footer-control" type="button" onClick={() => { close(); props.onCreateTrip() }}><TravelIcon name="plus" />{t('travel.create')}</button>
        <button className="tt-popover-footer-control" type="button" onClick={() => { close(); props.onManageTrips?.() }}><TravelIcon name="settings" />{t('travel.manage')}<TravelIcon name="arrow-right" /></button>
      </div>
    </AnchoredPaperPopover> : null}
  </>
}

export function TravelSummary({ props }: { props: HomeScreenProps }) {
  const t = useT()
  if (!props.trip && props.travelStatus !== 'ready') return <section className="tt-summary tt-paper-card" aria-busy={props.travelStatus === 'loading'}>
    <p role={props.travelStatus === 'error' ? 'alert' : 'status'}>{t(props.travelStatus === 'error' ? 'travel.unavailable' : 'home.loading')}</p>
    {props.travelStatus === 'error' ? <button type="button" className="tt-link" onClick={props.onRetryTravel}>{t('common.retry')}</button> : <div className="tt-skeleton" aria-hidden="true" />}
  </section>
  return <section className="tt-summary tt-paper-card" data-testid={props.trip ? 'travel-summary' : 'home-trip-empty'}>
    <img className="tt-paper-fold" src="/travel/paper-fold.svg" alt="" />
    {props.trip ? <>
      <img className="tt-map-wash" src="/travel/map-wash.svg" alt="" /><img className="tt-route" src="/travel/route-dashes.svg" alt="" />
      <div className="tt-summary-top"><TripSelector props={props} /><TravelStatus trip={props.trip} /></div>
      <p className="tt-summary-date"><TripDateLine trip={props.trip.trip} /></p>
      <p className="tt-amount-label">{t('home.mySpending')}</p>
      <p className="tt-amount" data-testid="travel-spending"><TravelAmount lines={props.tripSpending} currency={props.trip.trip.defaultCurrency}
        status={props.tripSpendingStatus ?? props.recordsStatus ?? 'ready'} hidden={props.balanceHidden} /></p>
      <div className="tt-summary-link"><button type="button" className="tt-link" onClick={() => props.onViewTrip?.(props.trip!.trip.id)}>{t('travel.viewTrip')}<TravelIcon name="arrow-right" /></button></div>
    </> : <>
      <div className="tt-empty-copy"><h2 className="tt-empty-title">{t('travel.emptyTitle')}</h2><p className="tt-empty-subtitle">{t('travel.emptySubtitle')}</p>
        <button type="button" className="tt-primary" onClick={props.onCreateTrip}><TravelIcon name="plus" />{t('travel.create')}</button></div>
      <span className="tt-empty-map" aria-hidden="true"><img src="/travel/travel-map-ticket.png" alt="" /></span>
      <span className="tt-pocket" aria-hidden="true"><img src="/travel/pocket-travel.png" alt="" /></span>
    </>}
  </section>
}

export function FirstTripGuide() {
  const t = useT()
  return <section className="tt-guide tt-paper-card" data-testid="travel-first-guide">
    <div className="tt-guide-intro"><TravelIcon name="receipt" /><h3 className="tt-guide-title">{t('travel.guideTitle')}</h3><p className="tt-guide-description">{t('travel.guideHelp')}</p></div>
    <hr className="tt-divider" />
    {(['One', 'Two'] as const).map((step, i) => <div className="tt-guide-step" key={step}><span className="tt-step-number">0{i + 1}</span><div>
      <p>{t(`travel.step${step}`)}</p><p className="tt-guide-step-meta">{t(`travel.step${step}Help`)}</p></div></div>)}
    <div className="tt-ticket"><TravelIcon name="pin" />{t('travel.ticket')}</div>
  </section>
}

export function TravelViewSwitch({ density, onChange }: { density: 'detailed' | 'compact'; onChange: (value: 'detailed' | 'compact') => void }) {
  const t = useT()
  return <div className="tt-view-switch" role="group" aria-label={t('home.densityLabel')}>
    {(['detailed', 'compact'] as const).map(value => <button key={value} type="button" aria-label={t(value === 'detailed' ? 'home.overall' : 'home.compact')}
      aria-pressed={density === value} onClick={() => onChange(value)}><TravelIcon name={value === 'detailed' ? 'grid' : 'list'} /></button>)}
  </div>
}

export function TravelRecordsSection({ props, children, detail = false, onAdd }: {
  props: Pick<HomeScreenProps, 'trip' | 'recordGroups' | 'recordsStatus' | 'travelStatus' | 'affiliationsStatus' | 'onRetryTravel' | 'density' | 'onDensityChange'>;
  children: ReactNode; detail?: boolean; onAdd?: () => void
}) {
  const t = useT()
  const loading = props.travelStatus === 'loading' || props.recordsStatus === 'loading' || props.affiliationsStatus === 'loading'
  const error = props.travelStatus === 'error' || props.recordsStatus === 'error' || props.affiliationsStatus === 'error'
  return <section aria-labelledby={detail ? 'trip-records-title' : 'home-records-title'}>
    <div className="tt-section-head"><h2 className="tt-section-title" id={detail ? 'trip-records-title' : 'home-records-title'}>{t(detail ? 'travel.tripRecords' : 'home.travelRecords')}</h2>
      {props.trip && props.recordGroups.length > 0 ? <TravelViewSwitch density={props.density} onChange={props.onDensityChange} /> : null}</div>
    {error ? <p className="tt-state-message" role="alert">{t(props.recordGroups.length ? 'travel.refreshFailed' : 'travel.unavailable')} <button className="tt-link" type="button" onClick={props.onRetryTravel}>{t('common.retry')}</button></p> : null}
    {props.trip && props.recordGroups.length > 0 ? children : loading ? <p role="status">{t('home.loading')}</p> : error ? null : !props.trip ? <FirstTripGuide />
      : <section className="tt-guide tt-paper-card" data-testid="travel-empty-records"><div className="tt-guide-intro"><TravelIcon name="receipt" /><h3 className="tt-guide-title">{t('travel.noExpenses')}</h3><p className="tt-guide-description">{t('travel.firstExpense')}</p></div>
        {onAdd ? <button className="tt-primary tt-empty-add" type="button" onClick={onAdd}><TravelIcon name="plus" />{t('tab.addExpense')}</button> : null}</section>}
    {props.trip && !props.trip.trip.id.startsWith('affiliation:') && props.recordGroups.some(group => group.records.some(record => record.chip.kind === 'space')) ? <p className="tt-shared-strip"><TravelIcon name="users" />{t('travel.sharedHelp')}</p> : null}
  </section>
}

export function TravelHome({ props, records, notice, modeSwitch }: { props: HomeScreenProps; records: ReactNode; notice: ReactNode; modeSwitch: ReactNode }) {
  const t = useT(), lang = useStore(s => s.lang)
  return <div className="tt-travel home-frame tt-travel-home" data-density={props.density}>
    <header className="tt-home-header" data-testid="home-header"><div><div className="tt-title-bell"><h1 className="tt-home-title">{t('home.modeTravel')}</h1>{notice}</div>
      <p className="tt-date">{formatDate(props.localToday!, lang)}</p></div>{modeSwitch}</header>
    <TravelSummary props={props} />
    <TravelRecordsSection props={props} onAdd={props.onAddTripExpense}>{records}</TravelRecordsSection>
  </div>
}
