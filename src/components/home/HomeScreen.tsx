import { capitalizeDescription } from '../../lib/description'
import MoneyText from '../MoneyText'
import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAccessibleDialog } from '../../hooks/useAccessibleDialog'
import QuickIcon from '../QuickIcon'
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
import { availableMoney as allAccountBalances, addMinor, homeRecordAmountState, isAvailableMoneyAccount, localCalendarDate, payableTotals } from '../../lib/homeView'
import { parseMajorAmount } from '../../lib/money'
import type { CashAccountType } from '../../lib/personalAccountRepository'
import { useT, type TranslationKey } from '../../lib/i18n'
import { formatDate, localeForLang } from '../../lib/locale'
import { formatMinorAmount } from '../../lib/money'
import { useStore } from '../../store/useStore'

const recordIconNames: Record<string, string> = {
  food: 'Food', dessert: 'Food', noodle: 'Food', fruit: 'Food',
  coffee: 'Coffee', drink: 'Drink', drinks: 'Drink', groceries: 'Groceries', greens: 'Groceries',
  car: 'Transport', bus: 'Transport', transport: 'Transport', transportation: 'Transport',
  shopping: 'Shopping', home: 'Home', travel: 'Travel', flight: 'Travel', plane: 'Travel',
  accommodation: 'Stay', hotel: 'Stay', stay: 'Stay', health: 'Health', bills: 'Bills',
  fun: 'Fun', activities: 'Fun', sightseeing: 'Travel', gifts: 'Gifts', other: 'Other',
}

type DisplayRecord = HomeRecordPresentation & {
  statusLabel?: string | null
  action?: ReactNode
}

export type HomeScreenProps = {
  timezone?: string
  initialAccountPanel?: 'manage'
  onCloseAccountPanel?: () => void
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
  const densityDescriptionId = useId()
  const lang = useStore((state) => state.lang)
  const [sheet, setSheet] = useState<null | 'accounts' | 'manage' | 'trips' | 'create' | 'review'>(props.initialAccountPanel ?? null)
  const accountTrigger = useRef<HTMLButtonElement>(null)
  const closeSheet = () => { setSheet(null); props.onCloseAccountPanel?.() }
  const assetAccounts = props.accounts.filter(isAvailableMoneyAccount)
  const selected = props.selectedAccountId === 'all'
    ? null
    : assetAccounts.find((account) => account.id === props.selectedAccountId) ?? null
  const today = localCalendarDate(new Date(), props.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'))
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
          <div className="home-title-row"><h1 className="home-title">{props.mode === 'daily' ? t('home.myDay') : t('home.modeTravel')}</h1><AccountNotice tasks={props.accountTasks} /></div>
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
          <span className="home-fold" aria-hidden="true" />
          <p id="home-balance-title" className="home-balance-label">{t('home.accountBalance')}</p>
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
          <div className="home-account-target">
            <button ref={accountTrigger} type="button" className="home-account-button" data-testid="home-account-selector"
              aria-haspopup="dialog" aria-expanded={sheet === 'accounts'} onClick={() => setSheet('accounts')}>
              <span>{selected?.name ?? t('home.allAccounts')}</span><Chevron />
            </button>
          </div>
        </section>
        <div className="home-stat-row">
          {(['receivable', 'payable'] as const).map(direction => (
            <section key={direction} className={`home-stat home-debt-stat is-${direction}`} data-testid={`home-${direction}`} data-state={props.sharedStatus} data-empty={props.sharedStatus === 'ready' && (direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)).every(line => line.amountMinor === 0)}>
              <span className="home-meta">{t(direction === 'receivable' ? 'home.toCollect' : 'home.payable')}</span>
              <span className="home-debt-value">
                {props.sharedStatus === 'error' ? t('home.unavailable')
                  : props.sharedStatus === 'loading' ? <><span className="home-sr">{t('home.loading')}</span><span className="home-debt-skeleton" aria-hidden="true" /></>
                  : <MoneyLines lines={(direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)).length > 0 ? (direction === 'receivable' ? props.receivables : payableTotals(props.sharedContexts)) : [{currency:props.defaultCurrency ?? 'MYR',amountMinor:0}]} lang={lang} t={t} />}
              </span>
            </section>
          ))}
        </div>
        {props.sharedStatus === 'ready' && (props.sharedPreviews?.length ?? 0) > 0 ?
          <UnconfirmedNotice contexts={props.sharedPreviews!} onReview={() => setSheet('review')} /> : null}
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
            <span id={densityDescriptionId} className="home-sr">{t(props.density === 'detailed' ? 'home.detailed' : 'home.compact')}</span>
            <button
              type="button"
              className="home-density-toggle"
              role="switch"
              aria-label={t('home.densityLabel')}
              aria-describedby={densityDescriptionId}
              aria-checked={props.density === 'compact'}
              title={t(props.density === 'detailed' ? 'home.compact' : 'home.detailed')}
              onClick={() => props.onDensityChange(props.density === 'detailed' ? 'compact' : 'detailed')}
            >
              <span className="home-density-track" aria-hidden="true">
                <span className="home-density-thumb" />
                <span className="home-density-option is-detailed" data-icon="list">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><path d="M4 4h8M4 8h8M4 12h8" /></svg>
                </span>
                <span className="home-density-option is-compact" data-icon="grid">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 3h3v3H3ZM10 3h3v3h-3ZM3 10h3v3H3ZM10 10h3v3h-3Z" /></svg>
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
        <HomeSheet title={t('home.accountSheet')} onClose={closeSheet} testId="home-account-sheet" returnFocusRef={accountTrigger}>
          <div className="home-account-list">
            <AccountOption name={t('home.allAccounts')} type="all" selected={props.selectedAccountId === 'all'}
              onSelect={() => { props.onSelectAccount('all'); closeSheet() }}>
              {props.accountsStatus !== 'ready' ? t(props.accountsStatus === 'loading' ? 'home.loading' : 'home.unavailable')
                : <span className="home-money-lines">{allAccountBalances(assetAccounts, 'all').map(balance => <span key={balance.currency}>
                  {balance.amountMinor == null ? t('home.balanceIncomplete') : formatMoney(balance.amountMinor, balance.currency, lang, t)}
                  {balance.knownOnly ? ` · ${t('home.knownBalance')}` : ''}
                </span>)}</span>}
            </AccountOption>
            {props.accountsStatus === 'ready' ? assetAccounts.map(account => <AccountOption key={account.id} name={account.name}
              type={account.accountType} selected={account.id === props.selectedAccountId}
              onSelect={() => { props.onSelectAccount(account.id); closeSheet() }}>
              {accountBalanceLabel(account, lang, t)}
            </AccountOption>) : null}
          </div>
          <button type="button" className="home-add-account-button" data-testid="home-add-account" onClick={() => setSheet('create')}>
            <PlusIcon /><span>{t('home.addAccount')}</span>
          </button>
        </HomeSheet>
      ) : null}

      {sheet === 'review' ? (
        <HomeSheet title={t('home.unconfirmed')} onClose={closeSheet} testId="home-review-sheet">
          <p className="home-meta">{t('home.previewExcluded')}</p>
          {(['pending', 'manual'] as const).map(status => {
            const contexts = (props.sharedPreviews ?? []).filter(context => context.status === status)
            if (!contexts.length) return null
            return <section className="home-split-preview-section" key={status}>
              <h3>{t(status === 'pending' ? 'home.pendingConfirmation' : 'home.yourRecords')}</h3>
              {contexts.map(context => <button key={context.id} type="button" className="home-sheet-option home-debt-option"
                onClick={() => { closeSheet(); props.onOpenSharedContext(context) }}>
                <span className="home-debt-person"><span>{context.label}</span><small>{capitalizeDescription(context.description)}</small></span>
                <span className="home-preview-lines">{context.lines.map((line, index) => <span key={index}>
                  {t(line.direction === 'receivable' ? 'home.toCollect' : 'home.payable')} · {formatMoney(line.amountMinor, line.currency, lang, t)}
                </span>)}<span className="home-preview-status">{t('home.unconfirmed')}</span></span>
              </button>)}
            </section>
          })}
        </HomeSheet>
      ) : null}

      {sheet === 'manage' ? (
        <HomeSheet title={t('home.manageSheet')} onClose={closeSheet} testId="home-manage-sheet">
          {props.accountsStatus !== 'ready' ? <p className="home-status" role="status">{t(props.accountsStatus === 'loading' ? 'home.loading' : 'home.unavailable')}</p> : props.accounts.filter((account) => !account.archived).map((account) => (
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
          returnFocusRef={accountTrigger}
          defaultCurrency={props.defaultCurrency ?? 'MYR'}
          onClose={closeSheet}
          onCreate={props.onCreateAccount}
        />
      ) : null}

      {sheet === 'trips' ? (
        <HomeSheet title={t('home.tripSheet')} onClose={closeSheet} testId="home-trip-sheet">
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

function ModeBookmark({ mode, onChange }: { mode: 'daily' | 'travel'; onChange: (mode: 'daily' | 'travel') => void }) {
  const t = useT()
  return <div className="home-mode" data-testid="home-mode-switch" role="group" aria-label={t('home.modeLabel')}>
    {(['daily', 'travel'] as const).map(choice => <button type="button" key={choice} aria-pressed={choice === mode}
      onClick={() => { if (choice !== mode) onChange(choice) }}><span>{t(choice === 'daily' ? 'home.modeDaily' : 'home.modeTravel')}</span></button>)}
  </div>
}

function AccountOption({ name, type, selected, onSelect, children }: {
  name: string; type: string; selected: boolean; onSelect: () => void; children: ReactNode
}) {
  return <button type="button" className="home-sheet-option home-account-option" aria-pressed={selected} onClick={onSelect}>
    <span className="home-account-icon" aria-hidden="true"><AccountIcon type={type} /></span>
    <span className="home-account-name">{name}</span><span className="home-account-amount">{children}</span>
    <span className="home-account-marker" aria-hidden="true">{selected ? <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m4 9 3 3 7-7" /></svg> : null}</span>
  </button>
}

function AccountIcon({ type }: { type: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    {type === 'all' ? <><circle cx="8" cy="7" r="3"/><path d="M2 20v-2a6 6 0 0 1 12 0v2H2Zm14-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 4 4v2h-4"/></>
      : type === 'bank' ? <><path d="m3 8 9-5 9 5H3Zm0 13h18M5 10v8m5-8v8m4-8v8m5-8v8"/></>
      : <><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18m-14 6h4"/></>}
  </svg>
}

function PlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
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
    <span className="home-day-total-label">{t('home.dayTotal')}</span>
    <span className="home-day-total-value">{incomplete ? t('home.amountUnavailable') : <MoneyLines
      lines={Array.from(totals, ([currency, amountMinor]) => ({ currency, amountMinor }))}
      lang={lang} t={t}
    />}</span>
  </span>
}

function CompactDate({ date, kind }: { date: string; kind: HomeDateGroup['kind'] }) {
  const t = useT()
  const lang = useStore(state => state.lang)
  const value = new Date(`${date}T00:00:00`)
  if (Number.isNaN(value.getTime())) return <strong>{date}</strong>
  const day = new Intl.DateTimeFormat(localeForLang(lang), { month: 'short', day: 'numeric' }).format(value)
  const year = new Intl.DateTimeFormat(localeForLang(lang), { year: 'numeric' }).format(value)
  return <time className="home-compact-date" dateTime={date}>
    <strong>{kind === 'today' ? `${t('home.today')} · ` : kind === 'yesterday' ? `${t('home.yesterday')} · ` : ''}{day}</strong>
    {' '}<span className="home-date-year">{year}</span>
  </time>
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
    {props.recordGroups.slice(0, visibleDays).map((group, index) => <div className="home-day" data-tone={index % 2 ? 'cool' : 'warm'} key={group.date}>
      <div className="home-date">
        {props.density === 'compact' ? <CompactDate date={group.date} kind={group.kind} /> : <strong>{group.kind === 'today'
          ? `${t('home.today')} · ${formatDate(group.date, lang)}`
          : group.kind === 'yesterday'
            ? `${t('home.yesterday')} · ${formatDate(group.date, lang)}`
            : formatDate(group.date, lang)}</strong>}
        {props.density === 'compact' ? <DayTotal records={group.records} /> : null}
      </div>
      {group.records.map(record => <RecordRow key={record.id} accountsStatus={props.accountsStatus}
        record={{ ...record, statusLabel: props.recordStatuses?.[record.id] ?? null, action: props.recordActions?.[record.id] }} />)}
    </div>)}
    <div className="home-records-end" data-testid="home-records-end">
      {hasMore ? <button ref={sentinel} type="button" className="home-text-button" onClick={() => setVisibleDays(count => count + 1)}>
        {t('home.earlierRecords')}
      </button> : <p role="status">{incomplete ? t('home.someRecordsUnavailable') : loading ? t('home.loading') : t('home.allRecordsShown')}</p>}
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
  const movement = record.journalKind === 'transfer' || record.journalKind === 'settlement_in' || record.journalKind === 'settlement_out'
  const cue = movement
    ? { sign: record.journalKind === 'transfer' ? '' : record.direction === 'in' ? '+' : '−', tone: 'movement', label: t(record.journalKind === 'transfer' ? 'home.transfer' : 'home.settlement') }
    : record.direction === 'in'
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
          <span className="home-record-icon" aria-hidden="true">{record.category.match(/^\p{Extended_Pictographic}[\p{Emoji_Modifier}\uFE0F\u200D\p{Extended_Pictographic}]*/u)?.[0] ?? <QuickIcon name={recordIconNames[record.category.trim().toLowerCase()] ?? 'Other'} size={20} />}</span>
        ) : null}
        <div className="home-record-copy">
          <p className="home-record-title">{capitalizeDescription(record.description)}</p>
          {record.showChip ? <span className="home-chip">
            {record.compact && (record.chip.kind === 'direct' || record.chip.kind === 'space') ? <svg className="home-shared-mark" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="3" /><path d="M2 21v-2a7 7 0 0 1 14 0v2H2Z M16 4a3 3 0 0 1 0 6 M19 21h3v-2a7 7 0 0 0-5-6" />
            </svg> : null}
            {chipText(record, t)}
          </span> : null}
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

/** Display-only preview totals, kept separate from all confirmed financial balances. */
function previewTotals(contexts: readonly SharedPreviewContext[], direction: 'receivable' | 'payable'): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const context of contexts) for (const line of context.lines) {
    if (line.direction !== direction) continue
    totals.set(line.currency, addMinor(totals.get(line.currency) ?? 0, line.amountMinor))
  }
  return Array.from(totals, ([currency, amountMinor]) => ({ currency, amountMinor }))
}

function UnconfirmedNotice({ contexts, onReview }: { contexts: readonly SharedPreviewContext[]; onReview: () => void }) {
  const t = useT()
  const lang = useStore(state => state.lang)
  const directions = (['receivable', 'payable'] as const).filter(direction => contexts.some(context => context.lines.some(line => line.direction === direction)))
  return <button type="button" className="home-unconfirmed-notice" data-testid="home-unconfirmed-notice" onClick={onReview}>
    <span className="home-notice-face">
      <img src="/denim-paper/pocket-unconfirmed.png" width="20" height="20" alt="" aria-hidden="true" />
      <span className="home-unconfirmed-copy"><span>{t('home.unconfirmed')}</span>
        {directions.length ? directions.map(direction => <span className="home-unconfirmed-amount" key={direction} data-testid={`home-${direction}-unconfirmed`}>
          {directions.length > 1 ? `${t(direction === 'receivable' ? 'home.toCollect' : 'home.payable')} ` : ''}
          <MoneyLines lines={previewTotals(contexts, direction)} lang={lang} t={t} />
        </span>) : <span>{t('home.previewCount', { count: contexts.length })}</span>}
      </span>
      <span className="home-review-label">{t('home.review')}<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></span>
    </span>
  </button>
}

function HomeSheet({
  title,
  onClose,
  testId,
  children,
  dismissible = true,
  returnFocusRef,
}: {
  title: string
  onClose: () => void
  testId: string
  children: ReactNode
  dismissible?: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
}) {
  const t = useT()
  const [closing, setClosing] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestClose = () => {
    if (!dismissible || closeTimer.current) return
    setClosing(true)
    closeTimer.current = setTimeout(onClose, 180)
  }
  const ref = useAccessibleDialog<HTMLElement>(requestClose, undefined, returnFocusRef)
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
        <span className="home-sheet-handle" aria-hidden="true" />
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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4M12 2v2" />
      </svg>
      {tasks.length > 0 ? <span className="home-account-notice-dot" aria-hidden="true" /> : null}
    </button>
    {open ? <section ref={panel} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}
      tabIndex={-1} className="home-notice-popover" data-testid="home-notice-popover">
      <header>
        <h2 id={`${id}-title`}>{t('home.accountTasks')}</h2>
        <button type="button" className="home-icon-button" aria-label={t('home.close')}
          onClick={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }}>×</button>
      </header>
      <ul className="home-notice-list" tabIndex={0} aria-label={t('home.notifications')}>
        {tasks.length === 0 ? <li className="home-notice-row">{t('home.noAccountTasks')}</li> : null}
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
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function CreateAccountSheet({
  defaultCurrency,
  onClose,
  onCreate,
  returnFocusRef,
}: {
  defaultCurrency: string
  onClose: () => void
  onCreate: HomeScreenProps['onCreateAccount']
  returnFocusRef?: RefObject<HTMLElement | null>
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
    <HomeSheet title={t('home.addAccountTitle')} onClose={onClose} testId="home-create-account-sheet" dismissible={!saving} returnFocusRef={returnFocusRef}>
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
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3l14 14M8 8.5A3 3 0 0011.5 12M4 7.5C2.8 8.5 2 10 2 10s3 5 8 5c1.2 0 2.3-.3 3.2-.8M8.2 5.2C8.8 5.1 9.4 5 10 5c5 0 8 5 8 5s-.6 1-1.7 2.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
