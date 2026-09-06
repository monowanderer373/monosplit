import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { useT } from '../lib/i18n'
import type { CanonicalExpense } from '../types'
import {
  expenseContextActivity,
  matchesContextSearch,
  rankMoneyContexts,
} from '../lib/contextRanking'
import type { GlobalDestination, MoneyContextRef } from '../lib/moneyContext'
import {
  EMPTY_MONEY_CONTEXT_CATALOG,
  loadMoneyContextCatalog,
  type MoneyContextCatalog,
} from '../lib/moneyContextCatalog'

type Props = {
  isAnonymous: boolean
  excludedSpaceId?: string
  mode?: 'entry' | 'switch'
  destination?: GlobalDestination
  expenses?: CanonicalExpense[]
  pendingSwitch?: MoneyContextRef | null
  contextError?: boolean
  resolving?: boolean
  onSelect: (context: MoneyContextRef) => void
  onConfirmSwitch?: () => void
  onCancelSwitchWarning?: () => void
  onClose: () => void
}

export default function ContextGate({
  isAnonymous,
  excludedSpaceId,
  mode = 'entry',
  destination = 'personal',
  expenses = [],
  pendingSwitch,
  contextError = false,
  resolving = false,
  onSelect,
  onConfirmSwitch,
  onCancelSwitchWarning,
  onClose,
}: Props) {
  const t = useT()
  const dialogRef = useAccessibleDialog<HTMLElement>(onClose)
  const requestRef = useRef(0)
  const [contexts, setContexts] = useState<MoneyContextCatalog>(
    EMPTY_MONEY_CONTEXT_CATALOG,
  )
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setLoadFailed(false)
    try {
      const catalog = await loadMoneyContextCatalog({
        isAnonymous,
        excludedSpaceId,
      })
      if (requestId !== requestRef.current) return
      setContexts(catalog)
    } catch {
      if (requestId === requestRef.current) {
        setContexts(EMPTY_MONEY_CONTEXT_CATALOG)
        setLoadFailed(true)
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [excludedSpaceId, isAnonymous])

  useEffect(() => {
    void load()
    return () => {
      requestRef.current += 1
    }
  }, [load])

  const hasSharedTargets = useMemo(
    () => contexts.people.length + contexts.groups.length + contexts.trips.length > 0,
    [contexts],
  )
  const personal = useMemo<MoneyContextRef[]>(
    () => (isAnonymous ? [] : [{ kind: 'personal' }]),
    [isAnonymous],
  )
  const allContexts = useMemo(
    () => [
      ...personal,
      ...contexts.people,
      ...contexts.groups,
      ...contexts.trips,
    ],
    [contexts, personal],
  )
  const labels = useMemo(() => ({
    personal: t('common.personal'),
    person: t('contextPicker.personType'),
    group: t('contextPicker.groupType'),
    trip: t('contextPicker.tripType'),
  }), [t])
  const ranked = useMemo(
    () => rankMoneyContexts({
      contexts: allContexts,
      activity: expenseContextActivity(expenses, allContexts),
      destination,
    }),
    [allContexts, destination, expenses],
  )
  const recentContexts = ranked
    .filter((item) => item.lastUsedAt)
    .slice(0, 3)
    .map((item) => item.context)
  const filterOptions = (options: readonly MoneyContextRef[]) =>
    options.filter((context) => matchesContextSearch(context, query, labels))

  const renderOptions = (
    title: string,
    options: readonly MoneyContextRef[],
  ) => {
    const visible = filterOptions(options)
    return visible.length > 0 ? (
    <div className="mt-4">
      <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{title}</p>
      <div className="mt-2 grid gap-2">
        {visible.map((context) => {
          const key = context.kind === 'person' ? context.personId : context.kind === 'space' ? context.spaceId : 'personal'
          const label = context.kind === 'personal' ? t('common.personal') : context.displayName
          const typeLabel = context.kind === 'personal'
            ? t('common.personal')
            : context.kind === 'person'
              ? t('contextPicker.personType')
              : context.spaceType === 'trip'
                ? t('contextPicker.tripType')
                : t('contextPicker.groupType')
          return (
            <button
              key={`${context.kind}:${key}`}
              className="ms-btn-ghost min-h-11 w-full items-center justify-between gap-3 text-left"
              disabled={resolving}
              onClick={() => onSelect(context)}
            >
              <span className="truncate">{label}</span>
              <span aria-hidden="true" className="shrink-0 text-[10px] font-extrabold uppercase text-[var(--ms-text-muted)]">
                {typeLabel}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  ) : null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--ms-surface)] p-5 shadow-2xl sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-gate-title"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="ms-label">{t(mode === 'switch' ? 'contextPicker.switchLabel' : 'contextGate.label')}</p>
            <h2 id="context-gate-title" className="mt-1 text-2xl font-extrabold">
              {t(mode === 'switch' ? 'contextPicker.switchTitle' : 'contextGate.title')}
            </h2>
            <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
              {t(mode === 'switch' ? 'contextPicker.switchHelp' : 'contextGate.help')}
            </p>
          </div>
          <button className="ms-btn-ghost h-11 w-11 shrink-0 p-0" onClick={onClose} aria-label={t('common.close')}>×</button>
        </header>

        <label className="mt-5 block">
          <span className="sr-only">{t('contextPicker.search')}</span>
          <input
            className="ms-input w-full"
            type="search"
            value={query}
            placeholder={t('contextPicker.search')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {pendingSwitch ? (
          <div className="mt-4 rounded-2xl bg-[var(--ms-info-bg)] p-4 text-sm text-[var(--ms-info)]">
            <p className="font-extrabold">{t('contextPicker.lossTitle')}</p>
            <p className="mt-1">{t('contextPicker.lossHelp')}</p>
            <div className="mt-3 flex gap-2">
              <button className="ms-btn-primary py-2" onClick={onConfirmSwitch}>
                {t('contextPicker.continueSwitch')}
              </button>
              <button className="ms-btn-ghost py-2" onClick={onCancelSwitchWarning}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : null}

        {query.trim() === '' ? renderOptions(t('contextPicker.recent'), recentContexts) : null}
        {renderOptions(t('common.personal'), personal)}
        {renderOptions(t('contextGate.people'), contexts.people)}
        {renderOptions(t('contextGate.groups'), contexts.groups)}
        {renderOptions(t('contextGate.trips'), contexts.trips)}

        {loading ? (
          <p className="mt-4 text-sm text-[var(--ms-text-muted)]">{t('contextGate.loading')}</p>
        ) : null}
        {loadFailed ? (
          <div className="mt-4 rounded-xl bg-[var(--ms-danger-bg)] p-3 text-sm text-[var(--ms-danger)]">
            <p>{t('contextGate.loadFailed')}</p>
            <button className="ms-btn-ghost mt-2 py-2" onClick={() => void load()}>{t('common.retry')}</button>
          </div>
        ) : null}
        {contextError ? (
          <p className="mt-4 rounded-xl bg-[var(--ms-danger-bg)] p-3 text-sm text-[var(--ms-danger)]">
            {t('contextPicker.ineligible')}
          </p>
        ) : null}
        {!loading && !loadFailed && filterOptions(allContexts).length === 0 ? (
          <p className="mt-4 text-center text-sm text-[var(--ms-text-muted)]">
            {t('contextPicker.noResults')}
          </p>
        ) : null}
        {!loading && !loadFailed && isAnonymous && !hasSharedTargets ? (
          <p className="mt-4 rounded-xl bg-[var(--ms-info-bg)] p-3 text-sm text-[var(--ms-info)]">
            {t('contextGate.noTargets')}
          </p>
        ) : null}
      </section>
    </div>
  )
}
