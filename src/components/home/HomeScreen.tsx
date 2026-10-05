import { capitalizeDescription } from '../../lib/description'
import MoneyText from '../MoneyText'
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'
import { getCategoryIcon } from '../../lib/categories'
import type {
  AccountAttentionSource,
  AvailableMoneyTotal,
  CurrencyAmount,
  HomeAccount,
  HomeDateGroup,
  HomeRecordPresentation,
  HomeSpaceRef,
  HomeTripSelection,
  SharedContext,
  SharedPreviewContext,
  SummaryTileLayout,
} from '../../lib/homeView'
import { addMinor, homeRecordAmountState, isAvailableMoneyAccount, localCalendarDate, payableTotals } from '../../lib/homeView'
import { parseMajorAmount } from '../../lib/money'
import type { CashAccountType } from '../../lib/personalAccountRepository'
import { useT, type TranslationKey } from '../../lib/i18n'
import { formatDate, localeForLang } from '../../lib/locale'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'

type DisplayRecord = HomeRecordPresentation & {
  statusLabel?: string | null
  action?: ReactNode
}

export type HomeScreenProps = {
  mode: 'daily' | 'travel'
  onModeChange: (mode: 'daily' | 'travel') => void
  density: 'detailed' | 'compact'
  onDensityChange: (density: 'detailed' | 'compact') => void
  balanceHidden: boolean
  onToggleBalanceHidden: () => void
  selectedAccountId: 'all' | string
  onSelectAccount: (accountId: 'all' | string) => void
  accounts: readonly HomeAccount[]
  accountsStatus: 'loading' | 'error' | 'ready'
  accountsRefreshing?: boolean
  defaultCurrency?: string
  onCreateAccount: (input: {
    name: string
    accountType: CashAccountType
    currency: string
    openingBalanceMinor: number | null
    balanceAsOf: string | null
  }) => Promise<void>
  balances: readonly AvailableMoneyTotal[]
  monthlySpending: readonly CurrencyAmount[]
  receivables: readonly CurrencyAmount[]
  tileLayout: SummaryTileLayout
  accountTasks: readonly AccountAttentionSource[]
  sharedContexts: readonly SharedContext[]
  sharedPreviews?: readonly SharedPreviewContext[]
  sharedStatus: 'loading' | 'error' | 'ready'
  recordGroups: readonly HomeDateGroup[]
  recordsStatus?: 'loading' | 'ready' | 'error'
  onRetryRecords?: () => void
  affiliationsStatus?: 'loading' | 'ready' | 'error'
  recordActions?: Record<string, ReactNode>
  recordStatuses?: Record<string, string>
  recordsViewKey?: string
  trip: HomeTripSelection | null
  trips: readonly HomeSpaceRef[]
  travelStatus: 'loading' | 'error' | 'ready'
  tripSpending: readonly CurrencyAmount[]
  onSelectTrip: (tripId: string) => void
  onCreateTrip: () => void
  onOpenSharedContext: (context: SharedContext) => void
  emptyRecordsLabel?: TranslationKey
}

export default function HomeScreen(props: HomeScreenProps) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const [sheet, setSheet] = useState<null | 'accounts' | 'manage' | 'receivable' | 'payable' | 'trips' | 'create'>(null)
  const assetAccounts = props.accounts.filter(isAvailableMoneyAccount)
  const selected = props.selectedAccountId === 'all'
    ? null
    : assetAccounts.find((account) => account.id === props.selectedAccountId) ?? null
  const today = localCalendarDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const swipeIds = ['all', ...assetAccounts.map((account) => account.id)]
  const swipeStart = useRef<number | null>(null)
  const onSwipeDown = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    swipeStart.current = event.clientX
  }
  const onSwipeUp = (event: PointerEvent<HTMLElement>) => {
    if (swipeStart.current == null) return
    const delta = event.clientX - swipeStart.current
    swipeStart.current = null
    if (Math.abs(delta) < 48) return
    const index = Math.max(0, swipeIds.indexOf(props.selectedAccountId))
    const next = swipeIds[delta < 0 ? index + 1 : index - 1]
    if (next) props.onSelectAccount(next)
  }

  return (
    <div className="home-frame" data-density={props.density}>
      <header className="home-header" data-testid="home-header">
        <div>
          <h1 className="home-title">{props.mode === 'daily' ? t('home.modeDaily') : t('home.modeTravel')}</h1>
          <p className="home-today">{formatDate(today, lang)}</p>
        </div>
        <ModeBookmark mode={props.mode} onChange={props.onModeChange} />
      </header>

      {props.mode === 'daily' ? (
        <>
        <section
          className="home-card home-balance-card"
          aria-labelledby="home-balance-title"
          onPointerDown={onSwipeDown}
          onPointerUp={onSwipeUp}
        >
          <div className="home-card-top">
            <button
              type="button"
              className="home-account-button"
              data-testid="home-account-selector"
              aria-haspopup="dialog"
              aria-expanded={sheet === 'accounts'}
              onClick={() => setSheet('accounts')}
            >
              <span id="home-balance-title">{selected?.name ?? t('home.allAccounts')}</span>
              <Chevron />
            </button>
            <div className="home-wallet-actions">
              {props.accountTasks.length > 0 ? <AccountNotice tasks={props.accountTasks} /> : null}
            <button
              type="button"
              className="home-wallet-manage"
              data-testid="home-manage"
              aria-haspopup="dialog"
              aria-expanded={sheet === 'manage'}
              aria-label={t('home.manage')}
              title={t('home.manage')}
              onClick={() => setSheet('manage')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h7m4 0h7M3 12h12m4 0h2M3 18h3m4 0h11" />
                <circle cx="12" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>
              </svg>
            </button>
            </div>
          </div>
          <div className="home-balance-line">
            <BalanceValues
              status={props.accountsStatus}
              balances={props.balances}
              hidden={props.balanceHidden}
              emptyLabel={t('home.noAccounts')}
              refreshing={props.accountsRefreshing}
              onAddAccount={assetAccounts.length === 0 && props.accountsStatus === 'ready'
                ? () => setSheet('create')
                : undefined}
            />
            <button
              type="button"
              className="home-icon-button"
              data-testid="home-balance-eye"
              aria-pressed={props.balanceHidden}
              aria-label={props.balanceHidden ? t('home.showBalance') : t('home.hideBalance')}
              onClick={props.onToggleBalanceHidden}
            >
              {props.balanceHidden ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </section>
        <div className="home-stat-row">
          {(['receivable', 'payable'] as const).map(direction => (
            <button key={direction} type="button" className={`home-stat home-debt-stat is-${direction}`} data-testid={`home-${direction}`} aria-haspopup="dialog" aria-expanded={sheet === direction} data-state={props.sharedStatus} data-empty={props.sharedStatus === 'ready' && (direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)).every(line => line.amountMinor === 0)} onClick={() => setSheet(direction)}>
              <span className="home-meta">{t(direction === 'receivable' ? 'home.toCollect' : 'home.payable')}<Chevron /></span>
              <span className="home-debt-value">
                {props.sharedStatus === 'error' ? t('home.unavailable')
                  : props.sharedStatus === 'loading' ? <><span className="home-sr">{t('home.loading')}</span><span className="home-debt-skeleton" aria-hidden="true" /></>
                  : <MoneyLines lines={(direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)).length > 0 ? (direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)) : [{currency:props.defaultCurrency ?? 'MYR',amountMinor:0}]} lang={lang} t={t} />}
              </span>
              {props.sharedStatus === 'ready' && (props.sharedPreviews ?? []).some(context => context.lines.some(line => line.direction === direction)) ? <small className="home-split-preview-hint" title={lang === 'zh' ? '另有待确认／手动记录' : 'Pending / manual records'}><span className="home-sr">{lang === 'zh' ? '另有待确认／手动记录' : 'Pending / manual records'}</span></small> : null}
            </button>
          ))}
        </div>
        </>
      ) : (
        <TripCard
          trip={props.trip}
          status={props.travelStatus}
          spending={props.tripSpending}
          onOpen={() => setSheet('trips')}
          onCreate={props.onCreateTrip}
        />
      )}

      <section className="home-section" aria-labelledby="home-records-title">
        <div className="home-section-head">
          <h2 id="home-records-title">
            {props.mode === 'travel' ? t('home.travelRecords') : t('home.recent')}
          </h2>
          <div className="home-section-actions">
            <button
              type="button"
              className="home-density-toggle"
              role="switch"
              aria-label={t('home.densityLabel')}
              aria-checked={props.density === 'compact'}
              title={t(props.density === 'detailed' ? 'home.compact' : 'home.detailed')}
              onClick={() => props.onDensityChange(props.density === 'detailed' ? 'compact' : 'detailed')}
            >
              <span className="home-density-track" aria-hidden="true">
                <span className="home-density-thumb">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                    {props.density === 'detailed'
                      ? <path d="M4 4h8M4 8h8M4 12h8" />
                      : <path d="M4 5h8M4 11h8" />}
                  </svg>
                </span>
              </span>
            </button>
          </div>
        </div>
        {props.accountsRefreshing ? (
          <p className="home-status" role="status" data-testid="home-updating">{t('home.updating')}</p>
        ) : null}
        {props.recordsStatus === 'error' ? (
          <p className="home-status" role="alert">
            {t('home.recordsUnavailable')}
            {' '}
            <button type="button" className="home-text-button" onClick={props.onRetryRecords}>
              {t('home.retry')}
            </button>
          </p>
        ) : null}
        {props.mode === 'travel' && props.affiliationsStatus === 'error' && props.travelStatus !== 'error' ? (
          <p className="home-status" role="status">{t('home.affiliationsUnavailable')}</p>
        ) : null}
        {props.mode === 'travel' && props.travelStatus === 'error' ? (
          <p className="home-status" role="alert">{t('home.unavailable')}</p>
        ) : props.mode === 'travel' && props.travelStatus === 'loading' ? (
          <p className="home-status">{t('home.loading')}</p>
        ) : props.recordsStatus === 'loading' && props.recordGroups.length === 0 ? (
          <p className="home-status">{t('home.loading')}</p>
        ) : props.recordsStatus === 'error' && props.recordGroups.length === 0 ? null
        : props.recordGroups.length === 0 ? (
          <p className="home-status">{t(props.emptyRecordsLabel ?? 'home.noRecords')}</p>
        ) : <RecentRecordList key={props.recordsViewKey ?? `${props.mode}:${props.selectedAccountId}:${props.trip?.trip?.id ?? ''}`} props={props} />}

      </section>

      {sheet === 'accounts' ? (
        <HomeSheet title={t('home.accountSheet')} onClose={() => setSheet(null)} testId="home-account-sheet">
          <button
            type="button"
            className="home-sheet-option"
            aria-current={props.selectedAccountId === 'all'}
            onClick={() => {
              props.onSelectAccount('all')
              setSheet(null)
            }}
          >
            <span>{t('home.allAccounts')}</span>
          </button>
          {assetAccounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className="home-sheet-option"
              aria-current={account.id === props.selectedAccountId}
              onClick={() => {
                props.onSelectAccount(account.id)
                setSheet(null)
              }}
            >
              <span>{account.name}</span>
              <span className="home-meta">{accountBalanceLabel(account, lang, t)}</span>
            </button>
          ))}
          <button type="button" className="home-sheet-option" data-testid="home-manage-accounts" onClick={() => setSheet('manage')}>
            <span>{t('home.manageAccounts')}</span>
          </button>
        </HomeSheet>
      ) : null}

      {sheet === 'manage' ? (
        <HomeSheet title={t('home.manageSheet')} onClose={() => setSheet(null)} testId="home-manage-sheet">
          {props.accounts.filter((account) => !account.archived).map((account) => (
            <div key={account.id} className="home-sheet-option">
              <span>{account.name}</span>
              <span className="home-meta">
                {account.accountClass === 'liability'
                  ? t('home.liabilityNotCash')
                  : accountBalanceLabel(account, lang, t)}
              </span>
            </div>
          ))}
          <button type="button" className="home-sheet-option" data-testid="home-add-account" onClick={() => setSheet('create')}>
            <span>{t('home.addAccount')}</span>
          </button>
        </HomeSheet>
      ) : null}

      {sheet === 'create' ? (
        <CreateAccountSheet
          defaultCurrency={props.defaultCurrency ?? 'MYR'}
          onClose={() => setSheet(null)}
          onCreate={props.onCreateAccount}
        />
      ) : null}

      {sheet === 'receivable' || sheet === 'payable' ? (
        <HomeSheet title={t(sheet === 'receivable' ? 'home.toCollect' : 'home.payable')} onClose={() => setSheet(null)} testId="home-shared-sheet">
          {props.sharedStatus !== 'ready' ? <p className="home-status" role="status">{t(props.sharedStatus === 'loading' ? 'home.loading' : 'home.unavailable')}</p> : <><SharedSide
            title={lang === 'zh' ? '未结金额' : 'Outstanding'}
            tone={sheet}
            contexts={props.sharedContexts}
            direction={sheet}
            hasPreviews={(props.sharedPreviews ?? []).some(context => context.lines.some(line => line.direction === sheet))}
            onOpen={(context) => {
              setSheet(null)
              props.onOpenSharedContext(context)
            }}
          />
          {(['pending', 'manual'] as const).map(status => {
            const contexts = (props.sharedPreviews ?? []).filter(context => context.status === status && context.lines.some(line => line.direction === sheet))
            if (!contexts.length) return null
            return <section className="home-split-preview-section" key={status}>
              <h3>{status === 'pending' ? (lang === 'zh' ? '待确认' : 'Pending confirmation') : (lang === 'zh' ? '手动记录' : 'Manual records')}</h3>
              <p className="home-meta">{status === 'pending' ? (lang === 'zh' ? '预计分账金额；对方确认后才计入上方金额。' : 'Expected split amounts. Included above only after acceptance.') : (lang === 'zh' ? '你记录的分账；未获对方确认，不计入已确认金额。' : 'Your recorded splits. Unconfirmed and excluded from the confirmed total.')}</p>
              {contexts.map(context => <button key={context.id} type="button" className="home-sheet-option home-debt-option" onClick={() => { setSheet(null); props.onOpenSharedContext(context) }}>
                <span className="home-debt-person"><span>{context.label}</span><small>{capitalizeDescription(context.description)}</small></span>
                <span className="home-debt-row-money"><MoneyLines lines={context.lines.filter(line => line.direction === sheet)} lang={lang} t={t} /><Chevron /></span>
              </button>)}
            </section>
          })}</>}
        </HomeSheet>
      ) : null}

      {sheet === 'trips' ? (
        <HomeSheet title={t('home.tripSheet')} onClose={() => setSheet(null)} testId="home-trip-sheet">
          {props.trips.map((trip) => (
            <button
              key={trip.id}
              type="button"
              className="home-sheet-option"
              aria-current={trip.id === props.trip?.trip.id}
              onClick={() => {
                props.onSelectTrip(trip.id)
                setSheet(null)
              }}
            >
              <span>{trip.name}</span>
            </button>
          ))}
          <button type="button" className="home-sheet-option" onClick={props.onCreateTrip}>
            <span>{t('home.openTrips')}</span>
          </button>
        </HomeSheet>
      ) : null}
    </div>
  )
}

function ModeBookmark({ mode, onChange }: {
  mode: 'daily' | 'travel'
  onChange: (mode: 'daily' | 'travel') => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<Array<HTMLButtonElement | null>>([])
  const modes = ['daily', 'travel'] as const
  useEffect(() => {
    if (!open) return
    options.current[mode === 'daily' ? 0 : 1]?.focus()
    const outside = (event: globalThis.PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open, mode])
  const close = () => { setOpen(false); trigger.current?.focus() }
  return <div ref={root} className="home-mode-bookmark" data-mode={mode} data-testid="home-mode-switch">
    <button ref={trigger} type="button" className="home-mode-trigger"
      aria-label={t(mode === 'daily' ? 'home.modeDaily' : 'home.modeTravel')}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
      onClick={() => setOpen(value => !value)}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true) }
      }}>
      <ModeIcon mode={mode} /><span>{t(mode === 'daily' ? 'home.modeDaily' : 'home.modeTravel')}</span><Chevron />
    </button>
    {open ? <div id={menuId} className="home-mode-menu" role="menu" aria-label={t('home.modeLabel')}
      onKeyDown={event => {
        const current = options.current.indexOf(document.activeElement as HTMLButtonElement)
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
        else if (event.key === 'Tab') setOpen(false)
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + 2) % 2
          options.current[next]?.focus()
        }
      }}>
      {modes.map((choice, index) => <button key={choice} ref={element => { options.current[index] = element }}
        type="button" role="menuitemradio" aria-checked={choice === mode} tabIndex={-1}
        onClick={() => { if (choice !== mode) onChange(choice); close() }}>
        <ModeIcon mode={choice} /><span>{t(choice === 'daily' ? 'home.modeDaily' : 'home.modeTravel')}</span>
        <span className="home-mode-check" aria-hidden="true">{choice === mode ? '✓' : ''}</span>
      </button>)}
    </div> : null}
  </div>
}

function ModeIcon({ mode }: { mode: 'daily' | 'travel' }) {
  return <svg className="home-mode-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {mode === 'daily' ? <><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-12 4h1m6 0h1m-8 3h1"/></> : <><rect x="5" y="6" width="14" height="15" rx="3"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M9 6v15m6-15v15"/></>}
  </svg>
}

function BalanceValues({
  status,
  balances,
  hidden,
  emptyLabel,
  refreshing,
  onAddAccount,
}: {
  status: 'loading' | 'error' | 'ready'
  balances: readonly AvailableMoneyTotal[]
  hidden: boolean
  emptyLabel: string
  refreshing?: boolean
  onAddAccount?: () => void
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  if (status === 'loading') return <p className="home-status">{t('home.loading')}</p>
  if (status === 'error') return <p className="home-status" role="alert">{t('home.unavailable')}</p>
  if (balances.length === 0) {
    return (
      <div>
        <p className="home-status">{emptyLabel}</p>
        {onAddAccount ? (
          <button type="button" className="home-text-button" data-testid="home-add-first-account" onClick={onAddAccount}>
            {t('home.addAccount')}
          </button>
        ) : null}
        {refreshing ? <p className="home-note" role="status">{t('home.updating')}</p> : null}
      </div>
    )
  }
  const unknownCount = balances.reduce((sum, balance) => sum + balance.unknownOpeningCount, 0)
  return (
    <div data-testid="home-balance-values" aria-label={hidden ? t('home.balanceHidden') : undefined}>
      <div className="home-balance-values">
        {balances.map((balance) => (
          <p key={balance.currency} className="home-balance-figure">
            {hidden
              ? '••••'
              : balance.amountMinor == null
                ? t('home.balanceIncomplete')
                : <MoneyText value={formatMoney(balance.amountMinor, balance.currency, lang, t)} />}
            {!hidden && balance.knownOnly ? <span className="home-note"> {t('home.knownBalance')}</span> : null}
          </p>
        ))}
      </div>
      {!hidden && unknownCount > 0 ? (
        <p className="home-note">{t('home.balanceIncompleteCount', { count: unknownCount })}</p>
      ) : null}
      {refreshing ? <p className="home-note" role="status">{t('home.updating')}</p> : null}
    </div>
  )
}

function TripCard({
  trip,
  status,
  spending,
  onOpen,
  onCreate,
}: {
  trip: HomeTripSelection | null
  status: 'loading' | 'error' | 'ready'
  spending: readonly CurrencyAmount[]
  onOpen: () => void
  onCreate: () => void
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  if (status === 'loading') {
    return <section className="home-trip-card"><p className="home-status">{t('home.loading')}</p></section>
  }
  if (status === 'error') {
    return <section className="home-trip-card" role="alert"><p className="home-status">{t('home.unavailable')}</p></section>
  }
  if (!trip) {
    return (
      <section className="home-trip-card" data-testid="home-trip-empty">
        <h2 className="home-trip-name">{t('home.noTripTitle')}</h2>
        <p className="home-note">{t('home.noTripHelp')}</p>
        <button type="button" className="home-text-button" onClick={onCreate}>{t('home.openTrips')}</button>
      </section>
    )
  }
  const range = [trip.trip.startDate, trip.trip.endDate].filter(Boolean).join(' – ')
  return (
    <section className="home-trip-card">
      <button type="button" className="home-account-button" data-testid="home-trip-selector" onClick={onOpen}>
        <span className="home-trip-name">{trip.trip.name}</span>
        <span className="home-trip-status">{trip.phase === 'active' ? t('home.tripActive') : t('home.tripEnded')}</span>
        <Chevron className="home-trip-chevron" />
      </button>
      <p className="home-meta">{t('home.mySpending')}</p>
      <p className="home-balance-figure"><MoneyLines lines={spending} lang={lang} t={t} /></p>
      {range ? <p className="home-note">{range}</p> : null}
    </section>
  )
}

/** Total of the outgoing records displayed in this date group; currencies stay separate. */
function DayTotal({ records }: { records: readonly HomeRecordPresentation[] }) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const outgoing = records.filter((record) => record.direction === 'out')
  const totals = new Map<string, number>()
  const incomplete = outgoing.some((record) => !record.amountKnown)
  if (!incomplete) for (const record of outgoing) {
    totals.set(record.currency, addMinor(totals.get(record.currency) ?? 0, record.amountMinor))
  }
  return <span className="home-day-total" data-testid="home-day-total">
    <span>{lang === 'zh' ? '合计' : 'Total'}</span>
    {incomplete ? <span>{t('home.amountUnavailable')}</span> : <MoneyLines
      lines={Array.from(totals, ([currency, amountMinor]) => ({ currency, amountMinor }))}
      lang={lang} t={t}
    />}
  </span>
}

function RecentRecordList({ props }: { props: HomeScreenProps }) {
  const t = useT()
  const lang = useStore(state => state.lang)
  const [visibleDays, setVisibleDays] = useState(1)
  const sentinel = useRef<HTMLButtonElement>(null)
  const hasMore = visibleDays < props.recordGroups.length
  useEffect(() => {
    const target = sentinel.current
    if (!hasMore || !target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        setVisibleDays(count => count + 1)
      }
    }, { rootMargin: '0px 0px 100px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasMore, visibleDays, props.recordGroups.length])
  const incomplete = props.recordsStatus === 'error' || props.accountsStatus === 'error'
    || (props.mode === 'travel' && (props.travelStatus === 'error' || props.affiliationsStatus === 'error'))
  const loading = props.recordsStatus === 'loading' || props.accountsStatus === 'loading' || props.accountsRefreshing
    || (props.mode === 'travel' && (props.travelStatus === 'loading' || props.affiliationsStatus === 'loading'))
  return <>
    {props.recordGroups.slice(0, visibleDays).map(group => <div className="home-day" key={group.date}>
      <div className="home-date">
        <strong>{group.kind === 'today'
          ? `${t('home.today')} · ${formatDate(group.date, lang)}`
          : group.kind === 'yesterday'
            ? `${t('home.yesterday')} · ${formatDate(group.date, lang)}`
            : formatDate(group.date, lang)}</strong>
        {props.density === 'compact' ? <DayTotal records={group.records} /> : null}
      </div>
      {group.records.map(record => <RecordRow key={record.id} accountsStatus={props.accountsStatus}
        record={{ ...record, statusLabel: props.recordStatuses?.[record.id] ?? null, action: props.recordActions?.[record.id] }} />)}
    </div>)}
    <div className="home-records-end" data-testid="home-records-end">
      {hasMore ? <button ref={sentinel} type="button" className="home-text-button" onClick={() => setVisibleDays(count => count + 1)}>
        {lang === 'zh' ? '查看更早记录' : 'Show earlier records'}
      </button> : <p role="status">{incomplete ? (lang === 'zh' ? '部分记录暂时无法加载' : 'Some records could not load')
        : loading ? t('home.loading') : (lang === 'zh' ? '已显示所有记录' : 'All records shown')}</p>}
    </div>
  </>
}

function RecordRow({
  record,
  accountsStatus,
}: {
  record: DisplayRecord
  accountsStatus: 'loading' | 'error' | 'ready'
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const cue = record.direction === 'in'
    ? { sign: '+', tone: 'incoming', label: t('home.incoming') }
    : { sign: '−', tone: 'outgoing', label: t('home.outgoing') }
  const amountContent = (<>
              {homeRecordAmountState(record.amountKnown, accountsStatus) === 'unavailable'
                ? t('home.amountUnavailable')
                : homeRecordAmountState(record.amountKnown, accountsStatus) === 'pending'
                  ? t('home.loading')
                  : (
                    <>
                      <span className="home-sr">{cue.label}</span>
                      {cue.sign}{<MoneyText value={formatMoney(record.amountMinor, record.currency, lang, t)} />}
                    </>
                  )}
  </>)
  return (
    <article className={record.compact ? 'home-record is-compact' : 'home-record'} data-testid="home-record">
      <div className="home-record-main">
        {record.showIcon ? (
          <span className="home-record-icon" aria-hidden="true">{getCategoryIcon(record.category)}</span>
        ) : null}
        <div className="home-record-copy">
          <p className="home-record-title">{capitalizeDescription(record.description)}</p>
          {record.showChip ? <span className="home-chip">{chipText(record, t)}</span> : null}
          {record.statusLabel ? <p className="home-note">{record.statusLabel}</p> : null}
        </div>
        <i className="home-dots" aria-hidden="true" />
        <div className="home-record-money">
          <div className="home-record-figures">
            <p className={`home-amount ${homeRecordAmountState(record.amountKnown, accountsStatus) === 'amount' ? cue.tone : ''}`}>
              {amountContent}
            </p>
            <p className="home-wallet">
              {accountsStatus === 'loading'
                ? t('home.loading')
                : accountsStatus === 'error'
                  ? t('home.unavailable')
                  : record.fundingPending
                    ? t('home.fundingPending')
                    : record.walletName ?? t('home.walletUnlinked')}
            </p>
          </div>
        </div>
      </div>
      {isValidElement<{ trigger?: ReactNode; triggerClassName?: string; contextLabel?: string }>(record.action)
        ? cloneElement(record.action, {
          trigger: null,
          triggerClassName: 'home-record-trigger',
          contextLabel: `${chipText(record, t)}${record.walletName ? ` · ${record.walletName}` : ''}`,
        })
        : record.action}
    </article>
  )
}

function SharedSide({
  title,
  tone,
  contexts,
  direction,
  hasPreviews = false,
  onOpen,
}: {
  title: string
  tone: 'receivable' | 'payable'
  contexts: readonly SharedContext[]
  direction: 'receivable' | 'payable'
  hasPreviews?: boolean
  onOpen: (context: SharedContext) => void
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const visible = contexts.flatMap((context) => {
    const lines = context.lines.filter((line) => line.direction === direction)
    return lines.length === 0 ? [] : [{ context, lines }]
  })
  const totals = new Map<string, number>()
  for (const { lines } of visible) for (const line of lines) {
    totals.set(line.currency, addMinor(totals.get(line.currency) ?? 0, line.amountMinor))
  }
  return (
    <div className={`home-shared-side is-${tone}`}>
      {visible.length === 0 ? <div className="home-debt-empty">
        <span className="home-empty-check" aria-hidden="true">{hasPreviews ? '…' : '✓'}</span>
        <h3>{hasPreviews ? (lang === 'zh' ? '暂无已确认金额' : 'No confirmed balance') : (lang === 'zh' ? '全部已结清' : 'All settled')}</h3>
        <p>{hasPreviews ? (lang === 'zh' ? '分账记录在下方。' : 'Your split records are below.') : t('home.noSharedSide')}</p>
      </div> : <>
        <div className="home-shared-total">
          <p className="home-meta">{title}</p>
          <MoneyLines lines={Array.from(totals, ([currency, amountMinor]) => ({ currency, amountMinor }))} lang={lang} t={t} />
        </div>
        {visible.map(({ context, lines }) => (
          <button key={`${direction}:${context.id}`} type="button" className="home-sheet-option home-debt-option" onClick={() => onOpen(context)}>
            <span className="home-debt-person"><span>{context.label || t('home.sharedSpace')}</span><small>{context.source === 'friend' ? (lang === 'zh' ? '朋友' : 'Friend') : context.source === 'trip' ? (lang === 'zh' ? '旅行' : 'Trip') : (lang === 'zh' ? '群组' : 'Group')}</small></span>
            <span className="home-debt-row-money"><MoneyLines lines={lines.map((line) => ({ currency: line.currency, amountMinor: line.amountMinor }))} lang={lang} t={t} /><Chevron /></span>
          </button>
        ))}
      </>}
    </div>
  )
}

function HomeSheet({
  title,
  onClose,
  testId,
  children,
  dismissible = true,
}: {
  title: string
  onClose: () => void
  testId: string
  children: ReactNode
  dismissible?: boolean
}) {
  const t = useT()
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestClose = () => {
    if (!dismissible || closeTimer.current) return
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 180)
  }
  const ref = useAccessibleDialog<HTMLElement>(requestClose)
  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])
  return createPortal(
    <div className={`home-sheet-backdrop${closing ? ' is-closing' : ''}`} data-testid={`${testId}-backdrop`}>
      <div className="home-sheet-scrim" aria-hidden="true" data-testid={`${testId}-scrim`} onClick={requestClose} />
      <section
        ref={ref}
        className="home-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        tabIndex={-1}
        data-testid={testId}
      >
        <header>
          <h2 id={`${testId}-title`}>{title}</h2>
          <button type="button" className="home-icon-button" aria-label={t('home.close')} onClick={requestClose} disabled={!dismissible}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.getElementById('root') ?? document.body,
  )
}

function chipText(record: HomeRecordPresentation, t: ReturnType<typeof useT>): string {
  if (record.chip.kind === 'personal') return t('home.chipPersonal')
  if (record.chip.kind === 'personal-trip') return t('home.chipPersonalTrip', { trip: record.chip.tripLabel })
  if (record.chip.kind === 'direct') {
    return record.chip.personName
      ? t('home.chipWithPerson', { name: record.chip.personName })
      : t('home.chipDirect')
  }
  if (!record.chip.spaceName) return t('home.sharedSpace')
  return t(record.chip.spaceType === 'group' ? 'home.chipGroup' : 'home.chipTrip', {
    name: record.chip.spaceName,
  })
}

/** Non-modal notice: keeps the ledger visible, scrollable and interactive. */
function AccountNotice({ tasks }: { tasks: readonly AccountAttentionSource[] }) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    panel.current?.focus({ preventScroll: true })
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus({ preventScroll: true })
    }
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    document.addEventListener('focusin', focusOutside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      document.removeEventListener('focusin', focusOutside)
    }
  }, [open])
  return <div className="home-notice-anchor" ref={wrapper}>
    <button ref={trigger} type="button" className="home-account-notice" data-testid="home-account-notice"
      aria-label={`${t('home.accountTasks')} · ${t('home.taskCount', { count: tasks.length })}`}
      title={t('home.accountTasks')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => setOpen(value => !value)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5M12 16h.01" />
      </svg>
      <span className="home-account-notice-dot" aria-hidden="true" />
    </button>
    {open ? <section ref={panel} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}
      tabIndex={-1} className="home-notice-popover" data-testid="home-notice-popover">
      <header>
        <h2 id={`${id}-title`}>{t('home.accountTasks')}</h2>
        <button type="button" className="home-icon-button" aria-label={t('home.close')}
          onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }}>×</button>
      </header>
      <ul className="home-notice-list" tabIndex={0} aria-label={lang === 'zh' ? '通知列表' : 'Notifications'}>
        {tasks.map(task => <li key={task.id} className="home-notice-row">
          <span className="home-notice-icon" aria-hidden="true">!</span>
          <p>{taskLabel(task, t)}</p>
        </li>)}
      </ul>
    </section> : null}
  </div>
}

function taskLabel(task: AccountAttentionSource, t: ReturnType<typeof useT>): string {
  if (task.kind === 'pending_funding') return t('home.taskPendingFunding')
  if (task.kind === 'recurring_attention') return t('home.taskRecurring')
  if (task.kind === 'failed_installment') return t('home.taskInstallment')
  if (task.kind === 'pending_principal') return t('home.taskPrincipal')
  if (task.kind === 'insufficient_balance') return t('home.taskInsufficient', { name: task.accountName ?? '' })
  return t('home.accountTasks')
}

function accountBalanceLabel(account: HomeAccount, lang: ReturnType<typeof useStore.getState>['lang'], t: ReturnType<typeof useT>): string {
  if (!isAvailableMoneyAccount(account) || account.openingStatus !== 'posted') {
    return `${account.currency} · ${t('home.balanceIncomplete')}`
  }
  return formatMoney(account.entrySumMinor, account.currency, lang, t)
}

function MoneyLines({
  lines,
  lang,
  t,
}: {
  lines: readonly CurrencyAmount[]
  lang: ReturnType<typeof useStore.getState>['lang']
  t: ReturnType<typeof useT>
}) {
  if (lines.length === 0) return '—'
  return (
    <span className="home-money-lines" data-count={lines.length}>
      {lines.map((line, index) => (
        <span key={`${line.currency}:${line.amountMinor}:${index}`} className="home-money-line">
          {<MoneyText value={formatMoney(line.amountMinor, line.currency, lang, t)} />}
        </span>
      ))}
    </span>
  )
}

function formatMoney(
  amountMinor: number,
  currency: string,
  lang: ReturnType<typeof useStore.getState>['lang'],
  t: ReturnType<typeof useT>,
): string {
  try {
    return formatMinorAmount(amountMinor, currency, localeForLang(lang))
  } catch {
    return t('home.amountUnavailable')
  }
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CreateAccountSheet({
  defaultCurrency,
  onClose,
  onCreate,
}: {
  defaultCurrency: string
  onClose: () => void
  onCreate: HomeScreenProps['onCreateAccount']
}) {
  const t = useT()
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<CashAccountType>('ewallet')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [opening, setOpening] = useState('')
  const [asOf, setAsOf] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const trimmedName = name.trim()
    const trimmedOpening = opening.trim()
    const trimmedDate = asOf.trim()
    if (!trimmedName) return
    if ((trimmedOpening === '') !== (trimmedDate === '')) {
      setError(t('home.openingPair'))
      return
    }
    let openingBalanceMinor: number | null = null
    if (trimmedOpening !== '') {
      try {
        openingBalanceMinor = /^0+(?:\.0*)?$/.test(trimmedOpening)
          ? 0
          : parseMajorAmount(trimmedOpening, currency)
      } catch {
        setError(t('home.openingPair'))
        return
      }
    }
    setSaving(true)
    setError('')
    try {
      await onCreate({
        name: trimmedName,
        accountType,
        currency: currency.trim().toUpperCase(),
        openingBalanceMinor,
        balanceAsOf: trimmedDate || null,
      })
      onClose()
    } catch {
      setError(t('home.unavailable'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <HomeSheet title={t('home.addAccountTitle')} onClose={onClose} testId="home-create-account-sheet" dismissible={!saving}>
      <label className="home-sheet-option">
        <span>{t('home.accountName')}</span>
        <input className="ms-input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="home-sheet-option">
        <span>{t('home.accountType')}</span>
        <select className="ms-input" value={accountType} onChange={(event) => setAccountType(event.target.value as CashAccountType)}>
          <option value="cash">{t('home.accountType.cash')}</option>
          <option value="bank">{t('home.accountType.bank')}</option>
          <option value="ewallet">{t('home.accountType.ewallet')}</option>
        </select>
      </label>
      <label className="home-sheet-option">
        <span>{t('home.accountCurrency')}</span>
        <input className="ms-input" value={currency} maxLength={3} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
      </label>
      <p className="home-note">{t('home.openingHelp')}</p>
      <label className="home-sheet-option">
        <span>{t('home.openingAmount')}</span>
        <input className="ms-input" inputMode="decimal" value={opening} onChange={(event) => setOpening(event.target.value)} />
      </label>
      <label className="home-sheet-option">
        <span>{t('home.openingDate')}</span>
        <input className="ms-input" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
      </label>
      {error ? <p className="home-status" role="alert">{error}</p> : null}
      <button type="button" className="home-sheet-option" data-testid="home-create-account" disabled={saving || name.trim() === ''} onClick={() => void submit()}>
        <span>{saving ? t('home.creatingAccount') : t('home.createAccount')}</span>
      </button>
    </HomeSheet>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3l14 14M8 8.5A3 3 0 0011.5 12M4 7.5C2.8 8.5 2 10 2 10s3 5 8 5c1.2 0 2.3-.3 3.2-.8M8.2 5.2C8.8 5.1 9.4 5 10 5c5 0 8 5 8 5s-.6 1-1.7 2.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
