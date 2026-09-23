import { useState, type ReactNode } from 'react'
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
  SummaryTileLayout,
} from '../../lib/homeView'
import { isAvailableMoneyAccount } from '../../lib/homeView'
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
  balances: readonly AvailableMoneyTotal[]
  monthlySpending: readonly CurrencyAmount[]
  receivables: readonly CurrencyAmount[]
  tileLayout: SummaryTileLayout
  accountTasks: readonly AccountAttentionSource[]
  sharedContexts: readonly SharedContext[]
  sharedStatus: 'loading' | 'error' | 'ready'
  recordGroups: readonly HomeDateGroup[]
  recordActions?: Record<string, ReactNode>
  recordStatuses?: Record<string, string>
  onShowAllRecords: () => void
  showingAllRecords: boolean
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
  const [sheet, setSheet] = useState<null | 'accounts' | 'manage' | 'tasks' | 'shared' | 'trips'>(null)
  const assetAccounts = props.accounts.filter(isAvailableMoneyAccount)
  const selected = props.selectedAccountId === 'all'
    ? null
    : assetAccounts.find((account) => account.id === props.selectedAccountId) ?? null

  return (
    <div className="home-frame">
      <header className="home-header" data-testid="home-header">
        <div />
        <div className="home-mode" role="group" aria-label={t('home.modeLabel')} data-testid="home-mode-switch">
          <button
            type="button"
            aria-pressed={props.mode === 'daily'}
            onClick={() => props.onModeChange('daily')}
          >
            {t('home.modeDaily')}
          </button>
          <button
            type="button"
            aria-pressed={props.mode === 'travel'}
            onClick={() => props.onModeChange('travel')}
          >
            {t('home.modeTravel')}
          </button>
        </div>
      </header>

      {props.mode === 'daily' ? (
        <section className="home-card" aria-labelledby="home-balance-title">
          <div className="home-card-top">
            <button
              type="button"
              className="home-account-button"
              data-testid="home-account-selector"
              onClick={() => setSheet('accounts')}
            >
              <span id="home-balance-title">{selected?.name ?? t('home.allAccounts')}</span>
              <Chevron />
            </button>
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
          <BalanceValues
            status={props.accountsStatus}
            balances={props.balances}
            hidden={props.balanceHidden}
            emptyLabel={t('home.noAccounts')}
          />
          <div className="home-stat-row">
            <div className="home-stat">
              <p className="home-meta">{t('home.monthSpending')}</p>
              <p>{formatLines(props.monthlySpending, lang, t)}</p>
            </div>
            <div className="home-stat">
              <p className="home-meta">{t('home.toCollect')}</p>
              <p>
                {props.sharedStatus === 'error'
                  ? t('home.unavailable')
                  : formatLines(props.receivables, lang, t)}
              </p>
            </div>
          </div>
        </section>
      ) : (
        <TripCard
          trip={props.trip}
          status={props.travelStatus}
          spending={props.tripSpending}
          onOpen={() => setSheet('trips')}
          onCreate={props.onCreateTrip}
        />
      )}

      {props.mode === 'daily' && props.tileLayout !== 'hidden' ? (
        <div className="home-tiles" data-layout={props.tileLayout} data-testid="home-tiles">
          {props.tileLayout !== 'shared' ? (
            <button type="button" className="home-tile home-tile-account" onClick={() => setSheet('tasks')}>
              <span className="home-tile-icon" aria-hidden="true"><WalletIcon /></span>
              <strong>{t('home.accountTasks')}</strong>
              {props.accountTasks.length > 0 ? (
                <span className="home-badge" aria-label={t('home.taskCount', { count: props.accountTasks.length })}>
                  {props.accountTasks.length}
                </span>
              ) : null}
            </button>
          ) : null}
          {props.tileLayout !== 'account' ? (
            <button type="button" className="home-tile home-tile-shared" onClick={() => setSheet('shared')}>
              <span className="home-tile-icon" aria-hidden="true"><PeopleIcon /></span>
              <strong>{t('home.sharedBalances')}</strong>
              {props.sharedContexts.length > 0 ? (
                <span className="home-badge" aria-label={t('home.sharedCount', { count: props.sharedContexts.length })}>
                  {props.sharedContexts.length}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="home-section" aria-labelledby="home-records-title">
        <div className="home-section-head">
          <h2 id="home-records-title">
            {props.mode === 'travel' ? t('home.travelRecords') : t('home.recent')}
          </h2>
          <div className="home-section-actions">
            <div className="home-density" role="group" aria-label={t('home.densityLabel')}>
              <button
                type="button"
                aria-pressed={props.density === 'detailed'}
                onClick={() => props.onDensityChange('detailed')}
              >
                {t('home.detailed')}
              </button>
              <button
                type="button"
                aria-pressed={props.density === 'compact'}
                onClick={() => props.onDensityChange('compact')}
              >
                {t('home.compact')}
              </button>
            </div>
            <button
              type="button"
              className="home-text-button"
              aria-current={props.showingAllRecords ? 'true' : undefined}
              onClick={props.onShowAllRecords}
            >
              {t('home.viewAll')} ›
            </button>
          </div>
        </div>
        {props.mode === 'travel' && props.travelStatus === 'error' ? (
          <p className="home-status" role="alert">{t('home.unavailable')}</p>
        ) : props.recordGroups.length === 0 ? (
          <p className="home-status">{t(props.emptyRecordsLabel ?? 'home.noRecords')}</p>
        ) : props.recordGroups.map((group) => (
          <div key={group.date}>
            <div className="home-date">
              <strong>
                {group.kind === 'today'
                  ? `${t('home.today')} · ${formatDate(group.date, lang)}`
                  : group.kind === 'yesterday'
                    ? `${t('home.yesterday')} · ${formatDate(group.date, lang)}`
                    : formatDate(group.date, lang)}
              </strong>
              <i />
            </div>
            {group.records.map((record) => (
              <RecordRow
                key={record.id}
                accountsReady={props.accountsStatus === 'ready'}
                record={{
                  ...record,
                  statusLabel: props.recordStatuses?.[record.id] ?? null,
                  action: props.recordActions?.[record.id],
                }}
              />
            ))}
          </div>
        ))}
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
        </HomeSheet>
      ) : null}

      {sheet === 'tasks' ? (
        <HomeSheet title={t('home.accountTasks')} onClose={() => setSheet(null)} testId="home-task-sheet">
          {props.accountTasks.length === 0 ? <p className="home-status">{t('home.noTasks')}</p> : props.accountTasks.map((task) => (
            <p key={task.id} className="home-sheet-option">{taskLabel(task, t)}</p>
          ))}
        </HomeSheet>
      ) : null}

      {sheet === 'shared' ? (
        <HomeSheet title={t('home.sharedBalances')} onClose={() => setSheet(null)} testId="home-shared-sheet">
          <SharedSide
            title={t('home.receivable')}
            tone="receivable"
            contexts={props.sharedContexts}
            direction="receivable"
            onOpen={(context) => {
              setSheet(null)
              props.onOpenSharedContext(context)
            }}
          />
          <SharedSide
            title={t('home.payable')}
            tone="payable"
            contexts={props.sharedContexts}
            direction="payable"
            onOpen={(context) => {
              setSheet(null)
              props.onOpenSharedContext(context)
            }}
          />
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

function BalanceValues({
  status,
  balances,
  hidden,
  emptyLabel,
}: {
  status: 'loading' | 'error' | 'ready'
  balances: readonly AvailableMoneyTotal[]
  hidden: boolean
  emptyLabel: string
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  if (status === 'loading') return <p className="home-status">{t('home.loading')}</p>
  if (status === 'error') return <p className="home-status" role="alert">{t('home.unavailable')}</p>
  if (balances.length === 0) return <p className="home-status">{emptyLabel}</p>
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
                : formatMoney(balance.amountMinor, balance.currency, lang, t)}
            {!hidden && balance.knownOnly ? <span className="home-note"> {t('home.knownBalance')}</span> : null}
          </p>
        ))}
      </div>
      {!hidden && unknownCount > 0 ? (
        <p className="home-note">{t('home.balanceIncompleteCount', { count: unknownCount })}</p>
      ) : null}
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
        <Chevron />
      </button>
      <p className="home-meta">{t('home.mySpending')}</p>
      <p className="home-balance-figure">{formatLines(spending, lang, t)}</p>
      {range ? <p className="home-note">{range}</p> : null}
    </section>
  )
}

function RecordRow({ record, accountsReady }: { record: DisplayRecord; accountsReady: boolean }) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const cue = record.direction === 'in'
    ? { sign: '+', tone: 'incoming', label: t('home.incoming') }
    : { sign: '−', tone: 'outgoing', label: t('home.outgoing') }
  return (
    <article className={record.compact ? 'home-record is-compact' : 'home-record'} data-testid="home-record">
      <div className="home-record-main">
        {record.showIcon ? (
          <span className="home-record-icon" aria-hidden="true">{getCategoryIcon(record.category)}</span>
        ) : null}
        <div className="home-record-copy">
          <p className="home-record-title">{record.description}</p>
          {record.showChip ? <span className="home-chip">{chipText(record, t)}</span> : null}
          {record.statusLabel ? <p className="home-note">{record.statusLabel}</p> : null}
        </div>
        <div className="home-record-money">
          <p className={`home-amount ${record.amountKnown === false ? '' : cue.tone}`}>
            {record.amountKnown === false ? t('home.amountUnavailable') : (
              <>
                <span className="home-sr">{cue.label}</span>
                {cue.sign}{formatMoney(record.amountMinor, record.currency, lang, t)}
              </>
            )}
          </p>
          <p className="home-wallet">
            {!accountsReady
              ? t('home.unavailable')
              : record.fundingPending
                ? t('home.fundingPending')
                : record.walletName ?? t('home.walletUnlinked')}
          </p>
          {record.action}
        </div>
      </div>
    </article>
  )
}

function SharedSide({
  title,
  tone,
  contexts,
  direction,
  onOpen,
}: {
  title: string
  tone: 'receivable' | 'payable'
  contexts: readonly SharedContext[]
  direction: 'receivable' | 'payable'
  onOpen: (context: SharedContext) => void
}) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const visible = contexts.flatMap((context) => {
    const lines = context.lines.filter((line) => line.direction === direction)
    return lines.length === 0 ? [] : [{ context, lines }]
  })
  return (
    <div>
      <h3 className={`home-side-title ${tone}`}>{title}</h3>
      {visible.length === 0 ? <p className="home-status">{t('home.noSharedSide')}</p> : visible.map(({ context, lines }) => (
        <button key={`${direction}:${context.id}`} type="button" className="home-sheet-option" onClick={() => onOpen(context)}>
          <span>{context.label || t('home.sharedSpace')}</span>
          <span className="home-meta">
            {lines.map((line) => formatMoney(line.amountMinor, line.currency, lang, t)).join(' · ')}
          </span>
        </button>
      ))}
    </div>
  )
}

function HomeSheet({
  title,
  onClose,
  testId,
  children,
}: {
  title: string
  onClose: () => void
  testId: string
  children: ReactNode
}) {
  const t = useT()
  const ref = useAccessibleDialog<HTMLElement>(onClose)
  return (
    <div className="home-sheet-backdrop">
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
          <button type="button" className="home-icon-button" aria-label={t('home.close')} onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
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
  return record.chip.spaceName || t('home.sharedSpace')
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
  return `${account.currency} · ${formatMoney(account.entrySumMinor, account.currency, lang, t)}`
}

function formatLines(
  lines: readonly CurrencyAmount[],
  lang: ReturnType<typeof useStore.getState>['lang'],
  t: ReturnType<typeof useT>,
): string {
  if (lines.length === 0) return '—'
  return lines.map((line) => formatMoney(line.amountMinor, line.currency, lang, t)).join(' · ')
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

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
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

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 3l14 14M8 8.5A3 3 0 0011.5 12M4 7.5C2.8 8.5 2 10 2 10s3 5 8 5c1.2 0 2.3-.3 3.2-.8M8.2 5.2C8.8 5.1 9.4 5 10 5c5 0 8 5 8 5s-.6 1-1.7 2.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="4" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 7h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function PeopleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="6" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="6" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 12c.4-2 2-3 3.5-3s3.1 1 3.5 3M10 9.2c1.2.1 2.3.8 2.8 2.3" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}
