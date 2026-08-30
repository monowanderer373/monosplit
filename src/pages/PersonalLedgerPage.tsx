import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import QuickAddSheet from '../components/QuickAddSheet'
import CaptureLibrary, { type CapturePreset } from '../components/CaptureLibrary'
import { useAuth } from '../hooks/useAuth'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { formatMinorAmount } from '../lib/money'
import { recordProductEvent } from '../lib/productEvents'
import { categoryKey, scopeKey, useT } from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'

export default function PersonalLedgerPage() {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const navigate = useNavigate()
  const location = useLocation()
  const { authUser, loading } = useAuth()
  const ledger = usePersonalLedger()
  const [quickAddStartedAt, setQuickAddStartedAt] = useState<number | null>(
    () => location.pathname === '/quick-add' ? Date.now() : null,
  )
  const [capturePreset, setCapturePreset] = useState<CapturePreset | null>(null)
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [category, setCategory] = useState('All')

  const categories = useMemo(
    () => ['All', ...new Set(ledger.rows.map((row) => row.expense.category))],
    [ledger.rows],
  )
  const visibleRows = useMemo(
    () => ledger.rows.filter((row) =>
      row.expense.occurredOn.startsWith(month)
      && (category === 'All' || row.expense.category === category),
    ),
    [category, ledger.rows, month],
  )

  useEffect(() => {
    if (quickAddStartedAt == null || !ledger.participantId) return
    void recordProductEvent({
      participantId: ledger.participantId,
      eventName: 'quick_add_started',
      source: 'manual',
      metadata: {
        entry: location.pathname === '/quick-add'
          ? new URLSearchParams(location.search).get('source') ?? 'deep-link'
          : 'ledger',
      },
    })
  }, [ledger.participantId, location.pathname, location.search, quickAddStartedAt])

  const closeQuickAdd = () => {
    setQuickAddStartedAt(null)
    setCapturePreset(null)
    if (location.pathname === '/quick-add') navigate('/', { replace: true })
  }

  if (loading) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <p className="text-sm text-[var(--ms-text-secondary)]">{t('ledger.opening')}</p>
      </main>
    )
  }

  if (!authUser) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md text-center">
          <p className="ms-label">{t('ledger.privateLabel')}</p>
          <h1 className="mt-2 text-3xl font-extrabold">{t('ledger.privateTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('ledger.privateHelp')}
          </p>
          <button className="ms-btn-primary mt-6 w-full" onClick={() => navigate('/login')}>
            {t('common.signIn')}
          </button>
          <button className="ms-btn-ghost mt-2 w-full" onClick={() => navigate('/spaces')}>
            {t('ledger.openSpaces')}
          </button>
        </section>
      </main>
    )
  }

  if (!ledger.participantId) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <section className="ms-card-hero w-full max-w-md">
          <p className="ms-label">{t('ledger.schemaLabel')}</p>
          <h1 className="mt-2 text-2xl font-extrabold">{t('ledger.schemaTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--ms-text-secondary)]">
            {t('ledger.schemaHelp')}
          </p>
          <button className="ms-btn-ghost mt-5 w-full" onClick={() => navigate('/spaces')}>
            {t('ledger.openSpacesAnyway')}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="ms-page pb-32">
      <header className="mx-auto flex max-w-3xl items-start justify-between gap-4">
        <div>
          <p className="ms-label">{t('ledger.personal')}</p>
          <h1 className="ms-brand mt-1 text-2xl font-bold">{t('ledger.brand')}</h1>
          <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">
            {t('ledger.hello', { name: authUser.displayName ?? authUser.email ?? t('ledger.there') })}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="ms-btn-ghost text-sm" onClick={() => navigate('/capture')}>{t('ledger.smartCapture')}</button>
          <button className="ms-btn-ghost text-sm" onClick={() => navigate('/profile')}>{t('common.profile')}</button>
        </div>
      </header>

      <section className="mx-auto mt-6 max-w-3xl">
        {ledger.totals.length === 0 ? (
          <div className="ms-card-hero">
            <p className="ms-label">{t('ledger.thisMonth')}</p>
            <p className="mt-4 text-4xl font-extrabold">{t('ledger.emptyTitle')}</p>
            <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
              {t('ledger.emptyHelp')}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ledger.totals.map((total) => (
              <article key={total.currency} className="ms-card-hero">
                <div className="flex items-center justify-between gap-3">
                  <p className="ms-label">{total.currency}</p>
                  <span className="text-xs text-[var(--ms-text-muted)]">{t('ledger.allActive')}</span>
                </div>
                <p className="mt-3 text-3xl font-extrabold">
                  {formatMinorAmount(total.personalSpendingMinor, total.currency)}
                </p>
                <p className="mt-1 text-sm text-[var(--ms-text-secondary)]">{t('ledger.yourSpending')}</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[var(--ms-text-muted)]">{t('common.paid')}</p>
                    <p className="font-bold">{formatMinorAmount(total.paidMinor, total.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--ms-text-muted)]">{t('ledger.trackedReceivable')}</p>
                    <p className="font-bold text-[var(--ms-success)]">
                      {formatMinorAmount(total.trackedReceivableMinor, total.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--ms-text-muted)]">{t('ledger.pendingAdvance')}</p>
                    <p className="font-bold">{formatMinorAmount(total.pendingAdvanceMinor, total.currency)}</p>
                  </div>
                  <div>
                    <p className="text-[var(--ms-text-muted)]">{t('ledger.untrackedAdvance')}</p>
                    <p className="font-bold">{formatMinorAmount(total.untrackedAdvanceMinor, total.currency)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <CaptureLibrary
        participantId={ledger.participantId}
        timezone={authUser.timezone ?? 'Asia/Kuala_Lumpur'}
        expenses={ledger.expenses}
        onOpen={(preset) => {
          setCapturePreset(preset)
          setQuickAddStartedAt(Date.now())
        }}
      />

      <section className="mx-auto mt-8 max-w-3xl">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="ms-label">{t('ledger.entries')}</p>
            <h2 className="mt-1 text-xl font-extrabold">{t('ledger.activity')}</h2>
          </div>
          <input
            className="ms-input h-10 w-40"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            aria-label={t('ledger.thisMonth')}
          />
        </div>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              className={item === category ? 'ms-btn-primary shrink-0 py-2' : 'ms-btn-ghost shrink-0 py-2'}
              onClick={() => setCategory(item)}
            >
              {item === 'All' ? t('common.all') : t(categoryKey(item))}
            </button>
          ))}
        </div>

        <div className="ms-list">
          {visibleRows.length === 0 ? (
            <p className="p-6 text-center text-sm text-[var(--ms-text-muted)]">{t('ledger.noEntries')}</p>
          ) : visibleRows.map((row, index) => {
            const pending = ledger.outbox.find(
              (item) => item.command.requestId === row.expense.clientRequestId,
            )
            return (
              <div key={row.expense.id}>
                {index > 0 ? <hr className="ms-divider" /> : null}
                <article className="ms-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{row.expense.description ?? t(categoryKey(row.expense.category))}</p>
                      {pending ? (
                        <span className="rounded-full bg-[var(--ms-info-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--ms-info)]">
                          {pending.status === 'rejected' ? t('ledger.needsAttention') : t('ledger.pendingSync')}
                        </span>
                      ) : null}
                      {pending?.status === 'rejected' ? (
                        <button
                          className="min-h-9 px-2 text-xs font-extrabold text-[var(--ms-accent)]"
                          onClick={() => void ledger.retryCommand(pending.command.requestId)}
                        >
                          {t('common.retry')}
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                      {formatDate(row.expense.occurredOn, lang)} · {t(scopeKey(row.expense.scope))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold">
                      {formatMinorAmount(row.personalSpendingMinor, row.expense.currency)}
                    </p>
                    {row.paidMinor !== row.personalSpendingMinor ? (
                      <p className="text-xs text-[var(--ms-text-muted)]">
                        {t('ledger.paidAmount', { amount: formatMinorAmount(row.paidMinor, row.expense.currency) })}
                      </p>
                    ) : null}
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ms-border)] bg-[var(--ms-surface)]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <button className="px-3 py-2 text-sm font-extrabold text-[var(--ms-accent)]">{t('common.ledger')}</button>
          <button className="px-3 py-2 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/spaces')}>{t('common.spaces')}</button>
          <button
            className="flex h-14 w-14 -translate-y-4 items-center justify-center rounded-full bg-[var(--ms-accent)] text-3xl font-light text-white shadow-[var(--ms-elev-accent)]"
            onClick={() => {
              setCapturePreset(null)
              setQuickAddStartedAt(Date.now())
            }}
            aria-label={t('ledger.quickAddLabel')}
          >
            +
          </button>
          <button className="px-3 py-2 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/friends')}>{t('common.friends')}</button>
          <button className="px-3 py-2 text-sm font-bold text-[var(--ms-text-secondary)]" onClick={() => navigate('/profile')}>{t('common.me')}</button>
        </div>
      </nav>

      {quickAddStartedAt != null ? (
        <QuickAddSheet
          participantId={ledger.participantId}
          participantName={authUser.displayName ?? authUser.email ?? t('common.me')}
          defaultCurrency={authUser.defaultCurrency ?? 'MYR'}
          startedAtMs={quickAddStartedAt}
          source={capturePreset?.source}
          initialValues={capturePreset?.values}
          clientRequestId={capturePreset?.clientRequestId}
          onSaved={capturePreset?.onSaved}
          onClose={closeQuickAdd}
          onSave={ledger.saveDraft}
        />
      ) : null}
    </main>
  )
}
