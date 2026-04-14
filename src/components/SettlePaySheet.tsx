import { useEffect, useMemo, useRef, useState } from 'react'
import { getSettlements } from '../lib/settlement'
import { CURRENCIES, fetchRate, getCurrencySymbol } from '../lib/currency'
import { formatMoney } from '../lib/format'
import { getSplitOutstandingAmount, getSplitPairShareAmount, isRefundPairRepaid } from '../lib/refund'
import { useStore } from '../store/useStore'
import ExpenseSheet from './ExpenseSheet'
import type { Group } from '../types'
import { CATEGORY_ICONS, normalizeCategory } from '../lib/categories'

// FAB position — must match .ms-fab in index.css
const FAB_W = 54
const FAB_H = 54
const FAB_RIGHT = 24
const FAB_BOTTOM = 88

type Phase = 'closed' | 'placed' | 'flying' | 'expanding' | 'revealing' | 'open' | 'closing'

type Props = {
  isOpen: boolean
  group: Group
  authUserId?: string
  onClose: () => void
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(139,110,78,0.15)] text-sm font-bold text-[#5a4838]">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// ── Repay Currency Panel (slides up) ─────────────────────────────────────────
function CurrencyRatePanel({
  isOpen,
  fromCurrency,
  toCurrency,
  onChangeTo,
  rate,
  onChangeRate,
  onClose,
}: {
  isOpen: boolean
  fromCurrency: string
  toCurrency: string
  onChangeTo: (c: string) => void
  rate: string
  onChangeRate: (r: string) => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [fetchedRate, setFetchedRate] = useState<number | null>(null)
  const [fetchError, setFetchError] = useState('')
  const [manualRate, setManualRate] = useState(rate)
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setManualRate(rate)
      setFetchedRate(null)
      setFetchError('')
      setMode('auto')
    }
  }, [isOpen, rate])

  const handleFetch = async () => {
    if (fromCurrency === toCurrency) { setFetchedRate(1); return }
    setLoading(true); setFetchError('')
    try {
      const result = await fetchRate(fromCurrency, toCurrency, 'latest')
      if (result) { setFetchedRate(result.rate); setManualRate(String(result.rate.toFixed(4))) }
      else setFetchError('Rate unavailable. Enter manually.')
    } catch { setFetchError('Failed to fetch. Enter manually.') }
    finally { setLoading(false) }
  }

  const handleDone = () => {
    const r = mode === 'auto' ? (fetchedRate ? String(fetchedRate) : manualRate) : manualRate
    onChangeRate(r)
    onClose()
  }

  const sameCurrency = fromCurrency === toCurrency

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-[#2c2520]/40 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ zIndex: 72 }}
        onClick={onClose}
      />
      {/* Panel — translate3d for GPU compositing on iOS Safari */}
      <div
        className="fixed inset-x-0 bottom-0 rounded-t-2xl bg-[var(--ms-bg,#f4f0e8)] px-5 pb-8 pt-5 shadow-2xl"
        style={{
          zIndex: 73,
          maxHeight: '80svh',
          overflowY: 'auto',
          transform: isOpen ? 'translate3d(0,0,0)' : 'translate3d(0,100%,0)',
          transition: isOpen
            ? 'transform 360ms cubic-bezier(0.32,0.72,0,1)'
            : 'transform 300ms cubic-bezier(0.55,0,1,0.45)',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--ms-border,#d8d0c4)]" />

        <h3 className="ms-title mb-4 text-base">Repay Currency</h3>

        {/* Currency selector */}
        <label className="mb-4 block text-sm text-[#6b6058]">
          Repay in
          <select
            className="ms-input mt-1 w-full"
            value={toCurrency}
            onChange={(e) => { onChangeTo(e.target.value); setFetchedRate(null) }}
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
            ))}
          </select>
        </label>

        {/* Rate section */}
        {!sameCurrency && (
          <div className="space-y-3">
            {/* Mode toggle */}
            <div className="flex gap-2">
              {(['auto', 'manual'] as const).map((m) => (
                <button
                  key={m}
                  className={`flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors ${mode === m ? 'border-[var(--ms-accent,#8b6e4e)] bg-[rgba(139,110,78,0.12)] text-[var(--ms-accent,#8b6e4e)]' : 'border-[var(--ms-border,#e6e0d5)] text-[#6b6058]'}`}
                  onClick={() => setMode(m)}
                >
                  {m === 'auto' ? 'Auto Rate' : 'Manual Rate'}
                </button>
              ))}
            </div>

            {mode === 'auto' && (
              <div className="rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] p-3">
                <p className="mb-2 text-xs text-[#6b6058]">
                  Rate: <span className="font-bold text-[#2c2520]">1 {fromCurrency} = {fetchedRate ? fetchedRate.toFixed(4) : '—'} {toCurrency}</span>
                </p>
                {fetchError && <p className="mb-2 text-xs text-[#9e4a4a]">{fetchError}</p>}
                <button
                  className="ms-btn-primary w-full py-2 text-sm"
                  onClick={handleFetch}
                  disabled={loading}
                >
                  {loading ? 'Fetching…' : fetchedRate ? 'Refresh Rate' : 'Fetch Rate'}
                </button>
              </div>
            )}

            {mode === 'manual' && (
              <div className="rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] p-3">
                <p className="mb-2 text-xs text-[#6b6058]">1 {fromCurrency} = ? {toCurrency}</p>
                <input
                  className="ms-input w-full"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 0.0067"
                  value={manualRate}
                  onChange={(e) => setManualRate(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {sameCurrency && (
          <p className="rounded-xl bg-[rgba(139,110,78,0.08)] px-4 py-3 text-sm text-[#6b6058]">
            Same currency — no conversion needed.
          </p>
        )}

        <button className="ms-btn-primary mt-5 w-full" onClick={handleDone}>
          Done
        </button>
      </div>
    </>
  )
}

// ── Tip log entry ────────────────────────────────────────────────────────────
interface TipEntry {
  id: string
  debtorName: string
  owedAmount: number
  paidAmount: number
  currency: string
  recordedAt: string
}

interface RedirectEntry {
  id: string
  personId: string
  amount: number // in displayCurrency
}

// ── Record Payment View ───────────────────────────────────────────────────────
function RecordPaymentView({
  isOpen,
  debtorId,
  group,
  repayCurrency,
  parsedRate,
  canConvert,
  onRecord,
  onClose,
}: {
  isOpen: boolean
  debtorId: string | null
  group: Group
  repayCurrency: string
  parsedRate: number | null
  canConvert: boolean
  onRecord: (tip: TipEntry | null) => void
  onClose: () => void
}) {
  const debtor = group.people.find((p) => p.id === debtorId)

  // All unpaid splits for this debtor
  const ownedItems = useMemo(() => {
    if (!debtorId) return []
    return group.expenses.flatMap((expense) => {
      const split = expense.splits.find((s) => s.personId === debtorId && !s.repaid && !(expense.payerIds ?? []).includes(debtorId))
      if (!split || split.amount == null) return []
      const outstandingAmount = getSplitOutstandingAmount(expense, split)
      if (outstandingAmount <= 0.001) return []
      return [{ expense, split, amount: outstandingAmount }]
    })
  }, [debtorId, group.expenses])

  // Direct creditors (payers) for this debtor's debts
  const creditorIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { expense } of ownedItems) {
      for (const pid of expense.payerIds ?? []) ids.add(pid)
    }
    return [...ids]
  }, [ownedItems])

  const primaryCurrency = ownedItems[0]?.expense.paidCurrency ?? group.defaultPaidCurrency

  // Contra: what the creditors owe back to the debtor (debtor is a payer in those expenses)
  const contraItems = useMemo(() => {
    if (!debtorId || creditorIds.length === 0) return []
    return group.expenses.flatMap((expense) => {
      if (!(expense.payerIds ?? []).includes(debtorId)) return []
      if (expense.paidCurrency !== primaryCurrency) return []
      return expense.splits.flatMap((split) => {
        if (!creditorIds.includes(split.personId) || split.repaid || split.amount == null) return []
        if ((expense.payerIds ?? []).includes(split.personId)) return []
        if (isRefundPairRepaid(expense, split, debtorId)) return []
        const pairShare = getSplitPairShareAmount(expense, split)
        return [{ expense, split, personId: split.personId, amount: pairShare }]
      })
    })
  }, [debtorId, creditorIds, group.expenses, primaryCurrency])

  const totalOwedRaw = ownedItems.reduce((sum, { amount }) => sum + amount, 0)
  const contraRaw = contraItems.reduce((sum, { amount }) => sum + amount, 0)
  const netOwedRaw = Math.max(0, totalOwedRaw - contraRaw)

  const totalOwedConverted = canConvert && parsedRate ? totalOwedRaw * parsedRate : totalOwedRaw
  const contraConverted = canConvert && parsedRate ? contraRaw * parsedRate : contraRaw
  const netOwedConverted = canConvert && parsedRate ? netOwedRaw * parsedRate : netOwedRaw
  const displayCurrency = canConvert ? repayCurrency : primaryCurrency

  const [editingAmount, setEditingAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Redirect state
  const [redirects, setRedirects] = useState<RedirectEntry[]>([])
  const [redirectPanelOpen, setRedirectPanelOpen] = useState(false)
  const [redirectPersonId, setRedirectPersonId] = useState('')
  const [redirectAmountInput, setRedirectAmountInput] = useState('')

  // All group members except the debtor — eligible redirect targets
  const redirectTargets = group.people.filter((p) => p.id !== debtorId)

  useEffect(() => {
    if (isOpen) {
      setAmountInput(netOwedConverted.toFixed(2))
      setEditingAmount(false)
      setRedirects([])
      setRedirectPanelOpen(false)
    }
  }, [isOpen, netOwedConverted])

  useEffect(() => {
    if (editingAmount) inputRef.current?.focus()
  }, [editingAmount])

  // When redirect panel opens, pre-fill amount with full outstanding
  useEffect(() => {
    if (redirectPanelOpen) {
      setRedirectPersonId(redirectTargets[0]?.id ?? '')
      setRedirectAmountInput(totalOwedConverted.toFixed(2))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redirectPanelOpen])

  const markAllDebtorSplitsRepaid = useStore((s) => s.markAllDebtorSplitsRepaid)
  const markRedirectRepaid = useStore((s) => s.markRedirectRepaid)
  const markSettlementPairRepaid = useStore((s) => s.markSettlementPairRepaid)

  const handleAddRedirect = () => {
    if (!redirectPersonId) return
    const amt = parseFloat(redirectAmountInput)
    if (!amt || amt <= 0) return
    setRedirects((prev) => [...prev, { id: Date.now().toString(), personId: redirectPersonId, amount: amt }])
    setRedirectPanelOpen(false)
  }

  // All receiving avatars = direct creditors + redirect targets (deduped)
  const allReceivingIds = useMemo(() => {
    const ids = new Set(creditorIds)
    for (const r of redirects) ids.add(r.personId)
    return [...ids]
  }, [creditorIds, redirects])

  const handleRecord = () => {
    if (!debtorId) return
    const paid = parseFloat(amountInput) || netOwedConverted
    const repaidDate = new Date().toISOString().slice(0, 10)

    // Mark all of debtor's (Hao's) splits as repaid
    markAllDebtorSplitsRepaid(group.id, debtorId, repaidDate)

    // Mark contra splits: creditors (Voo etc.) owed back to debtor (Hao) → repaid
    if (contraRaw > 0) {
      for (const creditorId of creditorIds) {
        markSettlementPairRepaid(group.id, creditorId, debtorId, primaryCurrency, repaidDate)
      }
    }

    // Apply redirects
    for (const r of redirects) {
      const amtInPaidCurrency = canConvert && parsedRate ? r.amount / parsedRate : r.amount
      markRedirectRepaid(group.id, [...creditorIds], r.personId, amtInPaidCurrency, primaryCurrency, repaidDate)
    }

    const extra = paid - netOwedConverted
    if (extra > 0.009 && debtor) {
      onRecord({
        id: Date.now().toString(),
        debtorName: debtor.name,
        owedAmount: netOwedConverted,
        paidAmount: paid,
        currency: displayCurrency,
        recordedAt: new Date().toISOString(),
      })
    } else {
      onRecord(null)
    }
  }

  return (
    <>
    <div
      className="fixed inset-0 flex flex-col"
      style={{
        zIndex: 75,
        background: 'var(--ms-bg,#f4f0e8)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 320ms cubic-bezier(0.4,0,0.2,1)',
        overflowY: 'auto',
      }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#6b6058] transition-colors hover:bg-[rgba(139,110,78,0.1)] active:opacity-60"
            onClick={onClose}
            aria-label="Go back"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
            </svg>
          </button>
          <h1 className="ms-title text-lg text-[#2c2520]">Record a payment</h1>
        </div>

        {/* Avatar pair — shows all receivers including redirect targets */}
        <div className="flex flex-col items-center gap-3 px-5 py-6">
          <div className="flex items-center gap-4">
            {/* Debtor avatar */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(139,110,78,0.15)] text-xl font-bold text-[#5a4838]">
                {(debtor?.name ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <span className="max-w-[72px] truncate text-xs font-medium text-[#6b6058]">{debtor?.name ?? 'Unknown'}</span>
            </div>
            {/* Arrow */}
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a9088" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
            {/* All receiving avatars */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex -space-x-3">
                {allReceivingIds.slice(0, 4).map((cid, idx) => {
                  const cp = group.people.find((p) => p.id === cid)
                  const isRedirect = !creditorIds.includes(cid)
                  return (
                    <div
                      key={cid}
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[var(--ms-bg,#f4f0e8)] text-lg font-bold"
                      style={{
                        zIndex: allReceivingIds.length - idx,
                        background: isRedirect ? 'rgba(80,106,70,0.18)' : 'rgba(96,65,69,0.15)',
                        color: isRedirect ? '#4e6642' : '#604145',
                      }}
                      title={isRedirect ? `${cp?.name} (redirect)` : cp?.name}
                    >
                      {(cp?.name ?? '?').slice(0, 1).toUpperCase()}
                    </div>
                  )
                })}
              </div>
              {allReceivingIds.length === 1 && (
                <span className="max-w-[72px] truncate text-xs font-medium text-[#6b6058]">
                  {group.people.find((p) => p.id === allReceivingIds[0])?.name ?? 'Payer'}
                </span>
              )}
            </div>
          </div>
          <p className="text-sm text-[#6b6058]">
            <span className="font-semibold text-[#2c2520]">{debtor?.name ?? 'Unknown'}</span>{' '}
            {allReceivingIds.length === 1 && creditorIds.length === 1
              ? `paid ${group.people.find((p) => p.id === creditorIds[0])?.name ?? 'you'}`
              : 'settled up'}
          </p>
        </div>

        {/* Editable amount */}
        <div className="mx-5 mb-5 flex items-center justify-center gap-3 rounded-2xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-5 py-4">
          {editingAmount ? (
            <input
              ref={inputRef}
              className="min-w-0 flex-1 bg-transparent text-center text-3xl font-bold text-[#2c2520] outline-none"
              type="number"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              onBlur={() => setEditingAmount(false)}
            />
          ) : (
            <span className="text-3xl font-bold text-[#2c2520]">
              {getCurrencySymbol(displayCurrency)}{parseFloat(amountInput || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          <button
            className="shrink-0 rounded-lg p-1.5 text-[#9a9088] hover:bg-[rgba(0,0,0,0.06)] active:opacity-60"
            onClick={() => setEditingAmount(true)}
            aria-label="Edit amount"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
        </div>

        {/* Items owed list */}
        <div className="mx-5 mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9a9088]">Items owed</p>
          {ownedItems.length === 0 ? (
            <div className="rounded-2xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-4 py-6 text-center text-sm text-[#9a9088]">
              No outstanding items found.
            </div>
          ) : (
            <div className="space-y-2">
              {ownedItems.map(({ expense, amount }, idx) => {
                const cat = normalizeCategory(expense.category)
                const icon = CATEGORY_ICONS[cat] ?? '🧾'
                const displayAmt = canConvert && parsedRate
                  ? `${getCurrencySymbol(repayCurrency)}${formatMoney(amount * parsedRate)}`
                  : `${getCurrencySymbol(expense.paidCurrency)}${formatMoney(amount)}`
                return (
                  <div key={`${expense.id}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-4 py-3">
                    <span className="text-xl leading-none">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#2c2520]">{expense.description}</p>
                      <p className="text-xs text-[#9a9088]">{expense.date}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#9e4a4a]">{displayAmt}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Contra section — creditor owes debtor back */}
        {contraItems.length > 0 && (
          <div className="mx-5 mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9a9088]">Contra offset</p>
            <div className="space-y-2">
              {contraItems.map(({ expense, personId, amount }, idx) => {
                const cat = normalizeCategory(expense.category)
                const icon = CATEGORY_ICONS[cat] ?? '🧾'
                const payer = group.people.find((p) => p.id === personId)
                const displayAmt = canConvert && parsedRate
                  ? `${getCurrencySymbol(repayCurrency)}${formatMoney(amount * parsedRate)}`
                  : `${getCurrencySymbol(expense.paidCurrency)}${formatMoney(amount)}`
                return (
                  <div key={`contra-${expense.id}-${personId}-${idx}`} className="flex items-center gap-3 rounded-xl border border-[rgba(80,106,70,0.28)] bg-[rgba(80,106,70,0.07)] px-4 py-3">
                    <span className="text-xl leading-none">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#2c2520]">{expense.description}</p>
                      <p className="text-xs text-[#9a9088]">{payer?.name} owes · {expense.date}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#4e6642]">−{displayAmt}</span>
                  </div>
                )
              })}
            </div>

            {/* Net calculation breakdown */}
            <div className="mt-3 rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-4 py-3 space-y-1">
              <div className="flex items-center justify-between text-sm text-[#6b6058]">
                <span>Total owed</span>
                <span className="font-semibold text-[#9e4a4a]">{getCurrencySymbol(displayCurrency)}{formatMoney(totalOwedConverted)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-[#6b6058]">
                <span>Contra offset</span>
                <span className="font-semibold text-[#4e6642]">− {getCurrencySymbol(displayCurrency)}{formatMoney(contraConverted)}</span>
              </div>
              <div className="my-1 h-px bg-[var(--ms-border,#e6e0d5)]" />
              <div className="flex items-center justify-between text-sm font-bold text-[#2c2520]">
                <span>Net payable</span>
                <span>{getCurrencySymbol(displayCurrency)}{formatMoney(netOwedConverted)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Redirect records (shown below items) */}
        {redirects.length > 0 && (
          <div className="mx-5 mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9a9088]">Redirected payments</p>
            <div className="space-y-2">
              {redirects.map((r) => {
                const target = group.people.find((p) => p.id === r.personId)
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-[rgba(80,106,70,0.30)] bg-[rgba(80,106,70,0.07)] px-4 py-3">
                    {/* Forward icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#617a52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#2c2520]">{target?.name ?? 'Unknown'}</p>
                      <p className="text-xs text-[#6b6058]">On behalf of creditor</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-[#4e6642]">
                      {getCurrencySymbol(displayCurrency)}{formatMoney(r.amount)}
                    </span>
                    <button
                      className="shrink-0 text-[#9a9088] hover:text-[#9e4a4a] active:opacity-60"
                      onClick={() => setRedirects((prev) => prev.filter((x) => x.id !== r.id))}
                      aria-label="Remove redirect"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom action row: square Redirect button + Record a payment button */}
        <div className="flex items-center gap-3 px-5 pb-12">
          {/* Square redirect button */}
          <button
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] text-[#6b6058] transition-colors hover:bg-[#e8e0d0] active:opacity-70"
            title="Redirect payment to another person"
            onClick={() => setRedirectPanelOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
            </svg>
          </button>

          {/* Record a payment button */}
          <button
            className="ms-btn-primary flex-1 py-4 text-base"
            onClick={handleRecord}
          >
            Record a payment
          </button>
        </div>
      </div>
    </div>

    {/* Redirect panel (slides up over the Record Payment view) */}
    <>
      <div
        className={`fixed inset-0 bg-[#2c2520]/40 transition-opacity duration-200 ${redirectPanelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        style={{ zIndex: 76 }}
        onClick={() => setRedirectPanelOpen(false)}
      />
      <div
        className="fixed inset-x-0 bottom-0 mx-auto max-w-lg rounded-t-2xl bg-[var(--ms-bg,#f4f0e8)] px-5 pb-8 pt-5 shadow-2xl"
        style={{
          zIndex: 77,
          transform: redirectPanelOpen ? 'translate3d(0,0,0)' : 'translate3d(0,100%,0)',
          transition: redirectPanelOpen
            ? 'transform 360ms cubic-bezier(0.32,0.72,0,1)'
            : 'transform 300ms cubic-bezier(0.55,0,1,0.45)',
          willChange: 'transform',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--ms-border,#d8d0c4)]" />
        <h3 className="ms-title mb-1 text-base">Redirect Payment</h3>
        <p className="mb-4 text-xs text-[#9a9088]">Send part of this payment to another person on behalf of your creditor.</p>

        {/* Person picker */}
        <label className="mb-3 block text-sm font-medium text-[#6b6058]">
          Pay to
          <select
            className="ms-input mt-1 w-full"
            value={redirectPersonId}
            onChange={(e) => setRedirectPersonId(e.target.value)}
          >
            {redirectTargets.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        {/* Amount input */}
        <label className="mb-4 block text-sm font-medium text-[#6b6058]">
          Amount ({displayCurrency})
          <input
            className="ms-input mt-1 w-full"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={redirectAmountInput}
            onChange={(e) => setRedirectAmountInput(e.target.value)}
          />
        </label>

        <p className="mb-4 rounded-xl bg-[rgba(80,106,70,0.08)] px-3 py-2.5 text-xs text-[#4e6642]">
          This clears the equivalent debt that your creditor owes to the selected person.
        </p>

        <button
          className="ms-btn-primary w-full"
          onClick={handleAddRedirect}
          disabled={!redirectPersonId || !parseFloat(redirectAmountInput)}
        >
          Confirm redirect
        </button>
      </div>
    </>
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SettlePaySheet({ isOpen, group, authUserId, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('closed')
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [fillScale, setFillScale] = useState(40)

  // Repay currency state
  const [repayCurrency, setRepayCurrency] = useState(group.defaultRepayCurrency || 'MYR')
  const [exchangeRate, setExchangeRate] = useState('')
  const [currencyPanelOpen, setCurrencyPanelOpen] = useState(false)

  // Add Expense sheet state
  const [addExpenseOpen, setAddExpenseOpen] = useState(false)
  const addExpense = useStore((s) => s.addExpense)

  // Record payment state
  const [selectedDebtorId, setSelectedDebtorId] = useState<string | null>(null)
  const [tipLog, setTipLog] = useState<TipEntry[]>([])

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const clear = () => timers.current.forEach(clearTimeout)
  const after = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timers.current.push(id) }

  const measure = () => {
    const vw = window.innerWidth; const vh = window.innerHeight
    const cx = vw - FAB_RIGHT - FAB_W / 2
    const cy = vh - FAB_BOTTOM - FAB_H / 2
    setTranslate({ x: vw / 2 - cx, y: vh / 2 - cy })
    setFillScale(Math.ceil((Math.sqrt(vw * vw + vh * vh) / (FAB_W / 2)) * 0.75))
  }

  useEffect(() => {
    clear()
    if (isOpen) {
      measure()
      setPhase('placed')
      after(() => setPhase('flying'), 30)
      after(() => setPhase('expanding'), 380)
      after(() => setPhase('revealing'), 780)
      after(() => setPhase('open'), 1050)
    } else {
      if (phase === 'closed') return
      setCurrencyPanelOpen(false)
      setAddExpenseOpen(false)
      setSelectedDebtorId(null)
      setPhase('closing')
      after(() => setPhase('closed'), 480)
    }
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Logged-in user's person in this group
  const myPerson = useMemo(
    () => authUserId ? group.people.find((p) => p.authUserId === authUserId) ?? null : null,
    [authUserId, group.people],
  )
  const myPersonId = myPerson?.id ?? null

  // Settlements — only the logged-in user's own debts
  const settlements = useMemo(() => getSettlements(group.expenses), [group.expenses])
  const debtorRows = useMemo(() => {
    const map = new Map<string, { currency: string; total: number }[]>()
    for (const s of settlements) {
      // Only show the current user's debts if we know who they are
      if (myPersonId && s.debtorId !== myPersonId) continue
      const arr = map.get(s.debtorId) ?? []
      const found = arr.find((e) => e.currency === s.currency)
      if (found) found.total += s.amount
      else arr.push({ currency: s.currency, total: s.amount })
      map.set(s.debtorId, arr)
    }
    return [...map.entries()].map(([personId, totals]) => ({
      personId,
      person: group.people.find((p) => p.id === personId),
      totals,
    }))
  }, [settlements, group.people, myPersonId])

  if (phase === 'closed') return null

  // ── Circle animation ─────────────────────────────────────────────────────
  const isFlying = phase === 'flying'
  const isExpanding = phase === 'expanding'
  const isExpanded = phase === 'revealing' || phase === 'open'
  const isClosing = phase === 'closing'
  const contentIn = phase === 'revealing' || phase === 'open'
  const contentOut = isClosing

  const circleStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed', right: FAB_RIGHT, bottom: FAB_BOTTOM,
      width: FAB_W, height: FAB_H, borderRadius: '50%',
      zIndex: 61, willChange: 'transform, background-color', pointerEvents: 'none',
    }
    if (phase === 'placed') return { ...base, background: 'var(--ms-accent,#8b6e4e)', transform: 'translate(0,0) scale(1)', transition: 'none' }
    if (isFlying) return { ...base, background: 'var(--ms-accent,#8b6e4e)', transform: `translate(${translate.x}px,${translate.y}px) scale(1)`, transition: 'transform 320ms cubic-bezier(0.4,0,0.2,1)' }
    if (isExpanding) return { ...base, background: 'var(--ms-bg,#f4f0e8)', transform: `translate(${translate.x}px,${translate.y}px) scale(${fillScale})`, transition: 'transform 380ms cubic-bezier(0.4,0,0.2,1), background-color 200ms ease' }
    if (isExpanded) return { ...base, opacity: 0, transition: 'opacity 100ms ease', transform: `translate(${translate.x}px,${translate.y}px) scale(${fillScale})` }
    if (isClosing) return { ...base, background: 'var(--ms-accent,#8b6e4e)', transform: 'translate(0,0) scale(0)', transition: 'transform 400ms cubic-bezier(0.4,0,0.2,1), background-color 150ms ease' }
    return base
  }

  const stagger = (i: number): React.CSSProperties => ({
    opacity: contentIn && !contentOut ? 1 : 0,
    transform: contentIn && !contentOut ? 'translateY(0)' : 'translateY(18px)',
    transition: `opacity 280ms ease ${i * 55}ms, transform 280ms ease ${i * 55}ms`,
  })

  // The primary recorded currency of debts (used for rate fetching & conversion)
  const primaryDebtCurrency = debtorRows[0]?.totals[0]?.currency ?? group.defaultPaidCurrency

  // Parsed rate: 1 primaryDebtCurrency = parsedRate repayCurrency
  const parsedRate = exchangeRate ? parseFloat(exchangeRate) : null
  const canConvert = parsedRate != null && parsedRate > 0 && primaryDebtCurrency !== repayCurrency

  // Compute display amount for a person's totals
  const displayAmount = (totals: { currency: string; total: number }[]) => {
    return totals.map(({ currency, total }) => {
      if (canConvert && currency === primaryDebtCurrency) {
        const converted = total * parsedRate!
        return { currency: repayCurrency, amount: converted, original: { currency, amount: total } }
      }
      return { currency, amount: total, original: null }
    })
  }

  return (
    <>
      {/* Morphing circle */}
      <div style={circleStyle()} />

      {/* Backdrop fill */}
      <div className="fixed inset-0" style={{ zIndex: 59, background: 'var(--ms-bg,#f4f0e8)', opacity: isExpanding || isExpanded ? 1 : 0, transition: isExpanding ? 'opacity 300ms ease 100ms' : isClosing ? 'opacity 350ms ease' : 'none', pointerEvents: 'none' }} />

      {/* Content layer */}
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 62, pointerEvents: contentIn && !contentOut ? 'auto' : 'none' }}>
        <div className="mx-auto flex h-full max-w-lg flex-col">

          {/* Back button */}
          <div className="flex items-center px-4 pt-12 pb-2" style={stagger(0)}>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#6b6058] transition-colors hover:bg-[rgba(139,110,78,0.1)] active:opacity-60"
              onClick={onClose}
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
              </svg>
            </button>
          </div>

          {/* Title */}
          <div className="px-5 pb-2" style={stagger(1)}>
            <h1 className="ms-title text-xl leading-snug text-[#2c2520]">
              {myPersonId ? 'Your outstanding balances' : 'Whose outstanding do you want to settle?'}
            </h1>
            {myPersonId && myPerson && (
              <p className="mt-0.5 text-sm text-[#9a9088]">Logged in as <span className="font-semibold text-[#6b6058]">{myPerson.name}</span></p>
            )}
          </div>

          {/* Divider */}
          <div className="mx-5 mb-3 h-px bg-[var(--ms-border,#e6e0d5)]" style={stagger(2)} />

          {/* Tip / extra-payment notices */}
          {tipLog.length > 0 && (
            <div className="mx-4 mb-2 space-y-2" style={stagger(2)}>
              {tipLog.map((tip) => {
                const extra = tip.paidAmount - tip.owedAmount
                return (
                  <div key={tip.id} className="flex items-start gap-2 rounded-xl border border-[rgba(58,106,58,0.25)] bg-[rgba(58,106,58,0.08)] px-3 py-2.5">
                    <span className="mt-0.5 text-base leading-none">🎉</span>
                    <p className="text-xs leading-snug text-[#3a6a3a]">
                      <span className="font-bold">{tip.debtorName}</span> paid{' '}
                      {getCurrencySymbol(tip.currency)}{formatMoney(tip.paidAmount)} and gave an extra{' '}
                      <span className="font-bold">{getCurrencySymbol(tip.currency)}{formatMoney(extra)}</span> tip!
                    </p>
                    <button
                      className="ml-auto shrink-0 text-[#3a6a3a] opacity-50 hover:opacity-100"
                      onClick={() => setTipLog((prev) => prev.filter((t) => t.id !== tip.id))}
                      aria-label="Dismiss"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Person rows */}
          <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: '220px' }}>
            {/* Not a member notice */}
            {authUserId && !myPersonId && (
              <div className="mt-6 rounded-2xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-5 py-6 text-center" style={stagger(3)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-[#9a9088]">
                  <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/>
                </svg>
                <p className="font-semibold text-[#3a3330]">You're not a member yet</p>
                <p className="mt-1 text-xs text-[#9a9088]">You need to be added to this group to view and settle your balance.</p>
              </div>
            )}
            {debtorRows.length === 0 && myPersonId ? (
              <div className="mt-10 text-center" style={stagger(3)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 text-[#9a9088]">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>
                </svg>
                <p className="font-semibold text-[#3a3330]">All settled up!</p>
                <p className="mt-1 text-xs text-[#9a9088]">You have no outstanding balances.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {debtorRows.map(({ personId, person, totals }, i) => (
                  <div key={personId} style={stagger(3 + i)}>
                    <button
                      className="ms-key flex w-full items-center gap-3 rounded-2xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-4 py-3 text-left active:opacity-70"
                      onClick={() => setSelectedDebtorId(personId)}
                    >
                      <Avatar name={person?.name ?? '?'} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#2c2520]">{person?.name ?? 'Unknown'}</p>
                        <p className="mt-0.5 text-xs text-[#9a9088]">Your repayment balance</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {displayAmount(totals).map(({ currency, amount, original }) => (
                          <div key={currency}>
                            <p className="font-bold text-[#9e4a4a]">
                              {getCurrencySymbol(currency)}{formatMoney(amount)}
                            </p>
                            {original && (
                              <p className="text-[10px] text-[#9a9088]">
                                ≈ {getCurrencySymbol(original.currency)}{formatMoney(original.amount)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a9088" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom action bar ───────────────────────────────────────────── */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg" style={stagger(3 + debtorRows.length)}>
            {/* Gradient fade */}
            <div className="h-8 bg-gradient-to-t from-[var(--ms-bg,#f4f0e8)] to-transparent" />

            <div className="bg-[var(--ms-bg,#f4f0e8)] px-5 pb-10 pt-2 pointer-events-auto">
              <div className="flex items-center justify-between gap-3">

                {/* More option button (left) */}
                <button
                  className="flex items-center gap-2 rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-3 py-2.5 text-sm font-medium text-[#6b6058] transition-colors hover:bg-[#e8e0d0] active:opacity-70"
                  onClick={() => { /* More options — coming soon */ }}
                >
                  {/* navigation icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                  </svg>
                  More option
                </button>

                {/* Repay Currency button + Add Expense FAB stacked above it (right) */}
                <div className="relative flex flex-col items-center gap-1">
                  {/* Add Expense FAB — floats directly above the currency button */}
                  <button
                    className="ms-fab absolute"
                    style={{ bottom: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)' }}
                    aria-label="Add Expense"
                    onClick={() => setAddExpenseOpen(true)}
                  >
                    <svg className="h-[30px] w-[30px] text-[#faf8f4]" viewBox="0 0 800 800" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                      <path d="M366.67001 601.32996l66.66001 0 0-165.32996 165.34002 0 0-66.66998-165.34002 0 0-165.33002-66.66001 0 0 165.33002-165.34002 0 0 66.66998 165.33999 0 0.00003 165.32996z m33.06 198.67004q-82.73001 0-155.73001-31.5-73-31.5-127-85.5-54-54-85.5-127-31.5-73-31.5-156 0-83 31.5-156 31.5-73 85.5-127 54-54 127-85.5 73-31.5 156-31.5 83 0 156 31.5 73 31.5 127 85.5 54 54 85.5 127 31.5 73 31.5 156l0 318.67004q0 33.54999-23.89001 57.43995-23.89002 23.89001-57.44001 23.89001l-318.93997 0z m0.26999-66.66998q139.58002 0 236.46002-96.87006 96.87-96.88 96.87-236.45996 0-139.57996-96.87-236.46002-96.88-96.87-236.46002-96.87-139.58002 0-236.46001 96.87-96.86999 96.88-96.86999 236.46002 0 139.58002 96.87001 236.46002 96.88 96.87 236.45999 96.87"/>
                    </svg>
                  </button>

                  {/* Currency button */}
                  <button
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--ms-border,#d8d0c4)] bg-[var(--ms-surface,#faf8f4)] px-3 py-2.5 transition-colors hover:bg-[#e8e0d0] active:opacity-70"
                    style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}
                    onClick={() => setCurrencyPanelOpen(true)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#604145" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                    </svg>
                    <span className="text-sm font-semibold text-[#5a4838]">{repayCurrency}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9a9088" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  <span className="text-[10px] font-medium italic text-[#9a9088]">Repay Currency</span>
                  {canConvert && (
                    <span className="text-[10px] text-[#6b6058]">
                      1 {primaryDebtCurrency} = {parsedRate!.toFixed(4)} {repayCurrency}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── Repay Currency panel ─────────────────────────────────────────────── */}
      <div style={{ zIndex: 70, position: 'fixed', inset: 0, pointerEvents: currencyPanelOpen ? 'auto' : 'none' }}>
        <CurrencyRatePanel
          isOpen={currencyPanelOpen}
          fromCurrency={primaryDebtCurrency}
          toCurrency={repayCurrency}
          onChangeTo={setRepayCurrency}
          rate={exchangeRate}
          onChangeRate={setExchangeRate}
          onClose={() => setCurrencyPanelOpen(false)}
        />
      </div>

      {/* ── Add Expense Sheet (rendered above everything in this sheet) ───────── */}
      <div style={{ zIndex: 70, position: 'fixed', inset: 0, pointerEvents: addExpenseOpen ? 'auto' : 'none' }}>
        <ExpenseSheet
          group={group}
          isOpen={addExpenseOpen}
          onClose={() => setAddExpenseOpen(false)}
          onSave={(expense) => {
            addExpense(group.id, expense)
            setAddExpenseOpen(false)
          }}
        />
      </div>

      {/* ── Record Payment View ──────────────────────────────────────────────── */}
      <RecordPaymentView
        isOpen={selectedDebtorId !== null}
        debtorId={selectedDebtorId}
        group={group}
        repayCurrency={repayCurrency}
        parsedRate={parsedRate}
        canConvert={canConvert}
        onRecord={(tip) => {
          if (tip) setTipLog((prev) => [tip, ...prev])
          setSelectedDebtorId(null)
        }}
        onClose={() => setSelectedDebtorId(null)}
      />
    </>
  )
}
