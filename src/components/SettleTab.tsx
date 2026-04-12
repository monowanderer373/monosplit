import { useEffect, useMemo, useState } from 'react'
import { getSettlements } from '../lib/settlement'
import { fetchRate, getCurrencySymbol } from '../lib/currency'
import { formatMoney, todayISO } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import { useT } from '../lib/i18n'
import { useStore } from '../store/useStore'
import type { Group } from '../types'

function round2(value: number): number {
  return Number(value.toFixed(2))
}

function calcConvertedSplitAmount(
  split: { convertedAmount: number | null; amount: number | null; rate: number | null },
  expenseRate: number | null,
  sameCurrency: boolean,
): number | null {
  if (split.convertedAmount != null) return split.convertedAmount
  if (sameCurrency) return split.amount
  if (split.amount != null && split.rate != null) return round2(split.amount * split.rate)
  if (split.amount != null && expenseRate != null) return round2(split.amount * expenseRate)
  return null
}

type Props = {
  group: Group
  onMarkPairRepaid: (debtorId: string, creditorId: string, currency: string, repaidDate: string) => void
}

export default function SettleTab({ group, onMarkPairRepaid }: Props) {
  const t = useT()
  const settlements = useMemo(() => getSettlements(group.expenses), [group.expenses])
  const [debtorFilterId, setDebtorFilterId] = useState('all')
  const [payerFilterId, setPayerFilterId] = useState('all')
  const [repayModal, setRepayModal] = useState<{
    open: boolean
    debtorId: string
    payerId: string
    currency: string
    amountAfterContra: number
  }>({
    open: false,
    debtorId: '',
    payerId: '',
    currency: '',
    amountAfterContra: 0,
  })
  const [repaidDate, setRepaidDate] = useState(todayISO())
  const setPersonSkipRepaidConfirm = useStore((s) => s.setPersonSkipRepaidConfirm)
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    debtorId: string
    creditorId: string
    currency: string
    dontShowAgain: boolean
  }>({ open: false, debtorId: '', creditorId: '', currency: '', dontShowAgain: false })
  const selectedDebtorName = group.people.find((person) => person.id === debtorFilterId)?.name ?? 'Debtor'
  const selectedPayerName = group.people.find((person) => person.id === payerFilterId)?.name ?? 'Payer'

  const pairMeta = useMemo(() => {
    const meta = new Map<string, { expenseCount: number; splitCount: number }>()
    group.expenses.forEach((expense) => {
      const payerIds = expense.payerIds ?? []
      const seenPairs = new Set<string>()
      expense.splits.forEach((split) => {
        if (split.repaid || payerIds.includes(split.personId)) return
        const currency = split.repayCurrency || expense.paidCurrency
        for (const payerId of payerIds) {
          const key = `${split.personId}-${payerId}-${currency}`
          const current = meta.get(key) ?? { expenseCount: 0, splitCount: 0 }
          current.splitCount += 1
          if (!seenPairs.has(key)) {
            current.expenseCount += 1
            seenPairs.add(key)
          }
          meta.set(key, current)
        }
      })
    })
    return meta
  }, [group.expenses])

  const filteredSettlements = useMemo(() => {
    return settlements.filter((item) => {
      if (debtorFilterId !== 'all' && item.debtorId !== debtorFilterId) return false
      if (payerFilterId !== 'all' && item.creditorId !== payerFilterId) return false
      return true
    })
  }, [debtorFilterId, payerFilterId, settlements])

  const summary = useMemo(() => {
    const totalByCurrency: Record<string, number> = {}
    filteredSettlements.forEach((row) => {
      totalByCurrency[row.currency] = (totalByCurrency[row.currency] || 0) + row.amount
    })

    if (debtorFilterId === 'all' || payerFilterId === 'all') {
      return {
        mode: 'generic' as const,
        totalByCurrency,
      }
    }

    const directByCurrency: Record<string, number> = {}
    const contraByCurrency: Record<string, number> = {}

    settlements.forEach((row) => {
      if (row.debtorId === debtorFilterId && row.creditorId === payerFilterId) {
        directByCurrency[row.currency] = (directByCurrency[row.currency] || 0) + row.amount
      }
      if (row.debtorId === payerFilterId && row.creditorId === debtorFilterId) {
        contraByCurrency[row.currency] = (contraByCurrency[row.currency] || 0) + row.amount
      }
    })

    const currencies = Array.from(new Set([...Object.keys(directByCurrency), ...Object.keys(contraByCurrency)]))
    const netAfterContraByCurrency: Record<string, number> = {}
    currencies.forEach((currency) => {
      const direct = directByCurrency[currency] || 0
      const contra = contraByCurrency[currency] || 0
      // Keep "negative means debtor still owes payer" for this dashboard section.
      netAfterContraByCurrency[currency] = contra - direct
    })

    return {
      mode: 'pair' as const,
      totalByCurrency,
      directByCurrency,
      contraByCurrency,
      netAfterContraByCurrency,
    }
  }, [debtorFilterId, filteredSettlements, payerFilterId, settlements])

  const repayAllLineCount = useMemo(() => {
    if (!repayModal.open) return 0
    let count = 0
    group.expenses.forEach((expense) => {
      const payerIds = expense.payerIds ?? []
      expense.splits.forEach((split) => {
        if (split.repaid || payerIds.includes(split.personId)) return
        const currency = split.repayCurrency || expense.paidCurrency
        if (currency !== repayModal.currency) return
        for (const payerId of payerIds) {
          const directMatch = split.personId === repayModal.debtorId && payerId === repayModal.payerId
          const contraMatch = split.personId === repayModal.payerId && payerId === repayModal.debtorId
          if (directMatch || contraMatch) count += 1
        }
      })
    })
    return count
  }, [group.expenses, repayModal])

  const repaidRows = useMemo(() => {
    const rows: Array<{ key: string; debtorId: string; debtorName: string; creditorId: string; creditorName: string; amount: number; currency: string; date: string }> = []
    group.expenses.forEach((expense) => {
      const payerIds = expense.payerIds ?? []
      expense.splits.forEach((split) => {
        if (!split.repaid || payerIds.includes(split.personId)) return
        const debtorName = group.people.find((person) => person.id === split.personId)?.name ?? 'Unknown'
        for (const payerId of payerIds) {
          const creditorName = group.people.find((person) => person.id === payerId)?.name ?? 'Unknown'
          rows.push({
            key: `${expense.id}-${split.personId}-${payerId}`,
            debtorId: split.personId,
            debtorName,
            creditorId: payerId,
            creditorName,
            amount: (split.convertedAmount ?? split.amount ?? 0) / payerIds.length,
            currency: split.repayCurrency || expense.paidCurrency,
            date: split.repaidDate ?? '',
          })
        }
      })
    })
    return rows.slice(-8).reverse()
  }, [group.expenses, group.people])

  const handleMarkRepaid = (debtorId: string, creditorId: string, currency: string) => {
    const debtor = group.people.find((p) => p.id === debtorId)
    if (debtor?.skipRepaidConfirm) {
      onMarkPairRepaid(debtorId, creditorId, currency, todayISO())
      return
    }
    setConfirmModal({ open: true, debtorId, creditorId, currency, dontShowAgain: false })
  }

  const confirmRepaid = () => {
    if (confirmModal.dontShowAgain) {
      setPersonSkipRepaidConfirm(group.id, confirmModal.debtorId, true)
    }
    onMarkPairRepaid(confirmModal.debtorId, confirmModal.creditorId, confirmModal.currency, todayISO())
    setConfirmModal({ open: false, debtorId: '', creditorId: '', currency: '', dontShowAgain: false })
  }

  // ── Settlement Overview (per-expense view) ──
  const [onlineRateByExpenseId, setOnlineRateByExpenseId] = useState<Record<string, number>>({})
  const [settlePayerFilterId, setSettlePayerFilterId] = useState('all')
  const [settleRepayFilterId, setSettleRepayFilterId] = useState('all')

  useEffect(() => {
    setSettlePayerFilterId('all')
    setSettleRepayFilterId('all')
  }, [group.id])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      const targets = group.expenses.filter((expense) => {
        if (expense.paidCurrency === expense.repayCurrency) return false
        const storedRate = expense.splits.find((split) => split.rate != null)?.rate
        return storedRate == null && onlineRateByExpenseId[expense.id] == null
      })
      if (targets.length === 0) return
      const results = await Promise.all(
        targets.map(async (expense) => {
          const result = await fetchRate(expense.paidCurrency, expense.repayCurrency, expense.date || 'latest')
          return { expenseId: expense.id, rate: result?.rate ?? null }
        }),
      )
      if (cancelled) return
      setOnlineRateByExpenseId((prev) => {
        const next = { ...prev }
        for (const row of results) {
          if (row.rate != null) next[row.expenseId] = row.rate
        }
        return next
      })
    }
    void run()
    return () => { cancelled = true }
  }, [group.expenses, onlineRateByExpenseId])

  const getExpenseRate = (expenseId: string, fallbackRate: number | null): number | null =>
    fallbackRate ?? onlineRateByExpenseId[expenseId] ?? null

  const personNameById = useMemo(() => {
    const map: Record<string, string> = {}
    group.people.forEach((person) => { map[person.id] = person.name })
    return map
  }, [group.people])

  const settlementRows = useMemo(() => {
    const showOnlyOutstanding = settlePayerFilterId === 'all' && settleRepayFilterId === 'all'
    return group.expenses
      .slice()
      .sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime())
      .map((expense) => {
        if (settlePayerFilterId !== 'all' && !(expense.payerIds ?? []).includes(settlePayerFilterId)) return null
        const storedRate = expense.splits.find((split) => split.rate != null)?.rate ?? null
        const expenseRate = getExpenseRate(expense.id, storedRate)
        const allRows = expense.splits
          .filter((split) => !(expense.payerIds ?? []).includes(split.personId))
          .filter((split) => settleRepayFilterId === 'all' || split.personId === settleRepayFilterId)
          .map((split) => {
            const convertedAmount = calcConvertedSplitAmount(
              split,
              expenseRate,
              expense.paidCurrency === expense.repayCurrency,
            )
            return { personId: split.personId, amount: convertedAmount ?? 0, repaid: split.repaid }
          })
        if (allRows.length === 0) return null
        const outstandingTotal = allRows.filter((row) => !row.repaid).reduce((sum, row) => sum + row.amount, 0)
        if (showOnlyOutstanding && outstandingTotal <= 0) return null
        const paidCount = allRows.filter((row) => row.repaid).length
        return {
          expenseId: expense.id,
          description: expense.description,
          date: expense.date,
          payerIds: expense.payerIds,
          amount: expense.amount,
          paidCurrency: expense.paidCurrency,
          repayCurrency: expense.repayCurrency,
          rows: allRows,
          outstandingTotal,
          paidCount,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
  }, [group.expenses, settlePayerFilterId, settleRepayFilterId, getExpenseRate])

  return (
    <section className="space-y-4 pb-20 lg:pb-0">

      {/* ── Settlement Overview ── */}
      <div className="ms-card-soft">
        <h2 className="ms-title mb-2">{t('summary.settlementTitle')}</h2>
        <p className="mb-3 text-sm text-[#6b6058]">
          {t('summary.settlementDesc')}{' '}
          <span className="mx-1 font-semibold text-[#5a7a8a]">{t('summary.paid')}</span>{' '}
          {t('summary.inCyan')}
        </p>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-2 text-xs font-semibold uppercase tracking-wide text-[#6b6058] md:grid-cols-12">
          <div className="md:col-span-4">{t('summary.item')}</div>
          <div className="md:col-span-3">
            <label className="mb-1 block">{t('summary.payer')}</label>
            <select
              className="ms-input h-8 w-full py-0 text-sm normal-case tracking-normal"
              value={settlePayerFilterId}
              onChange={(e) => setSettlePayerFilterId(e.target.value)}
            >
              <option value="all">{t('summary.all')}</option>
              {group.people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-5">
            <label className="mb-1 block">{t('summary.outstandingRepay')}</label>
            <select
              className="ms-input h-8 w-full py-0 text-sm normal-case tracking-normal"
              value={settleRepayFilterId}
              onChange={(e) => setSettleRepayFilterId(e.target.value)}
            >
              <option value="all">{t('summary.all')}</option>
              {group.people.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {settlementRows.length === 0 ? (
            <div className="py-4 text-sm text-[#6b6058]">{t('summary.noSettlement')}</div>
          ) : null}
          {settlementRows.map((row, rowIdx) => (
            <div
              key={row.expenseId}
              className={`grid grid-cols-1 gap-3 rounded-lg px-3 py-3 md:grid-cols-12 md:gap-2 ${
                rowIdx % 2 === 0
                  ? 'bg-[rgba(139,110,78,0.10)]'
                  : 'bg-[rgba(139,110,78,0.03)]'
              }`}
            >
              <div className="md:col-span-4">
                <p className="text-base font-semibold text-[#2c2520]">{row.description}</p>
                <p className="text-sm text-[#6b6058]">{row.date}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-base font-semibold text-[#2c2520]">
                  {row.payerIds.map((pid, i) => (
                    <span key={pid} style={getPersonNameStyle(group.people.find((person) => person.id === pid))}>
                      {i > 0 ? ', ' : ''}
                      {personNameById[pid] ?? t('card.unknown')}
                    </span>
                  ))}
                </p>
                <p className="text-lg font-bold text-[#2c2520]">
                  {getCurrencySymbol(row.paidCurrency)}
                  {formatMoney(row.amount)}
                </p>
              </div>
              <div className="md:col-span-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('summary.whoOwes')}</p>
                <ul className="mt-1 space-y-1">
                  {row.rows.map((line, idx) => (
                    <li key={`${row.expenseId}-${line.personId}-${idx}`} className="flex items-center justify-between text-sm">
                      <span
                        className="font-semibold text-[#3a3330]"
                        style={getPersonNameStyle(group.people.find((person) => person.id === line.personId))}
                      >
                        {personNameById[line.personId] ?? t('card.unknown')}
                      </span>
                      {line.repaid ? (
                        <span className="font-semibold text-[#5a7a8a]">
                          {t('summary.paid')} (
                          {getCurrencySymbol(row.repayCurrency)}
                          {formatMoney(line.amount)})
                        </span>
                      ) : (
                        <span className="font-semibold text-[#8a3a3a]">
                          {getCurrencySymbol(row.repayCurrency)}
                          {formatMoney(line.amount)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('summary.totalOutstanding')}</p>
                {row.outstandingTotal > 0 ? (
                  <p className="text-2xl font-bold text-[#8a3a3a]">
                    {getCurrencySymbol(row.repayCurrency)}
                    {formatMoney(row.outstandingTotal)}
                  </p>
                ) : (
                  <p className="text-lg font-bold text-[#5a7a8a]">
                    {t('summary.paid')}
                    {row.paidCount > 0 ? ` (${row.paidCount})` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Outstanding Dashboard ── */}
      <div className="ms-card-soft">
        <h2 className="ms-title mb-3">{t('settle.title')}</h2>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="ms-input w-full"
            value={payerFilterId}
            onChange={(e) => setPayerFilterId(e.target.value)}
          >
            <option value="all">{t('settle.payerAll')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
          <select
            className="ms-input w-full"
            value={debtorFilterId}
            onChange={(e) => setDebtorFilterId(e.target.value)}
          >
            <option value="all">{t('settle.debtorAll')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        {filteredSettlements.length === 0 ? <p className="text-sm text-[#4a6a4a]">{t('settle.noBalances')}</p> : null}
        <div className="space-y-2">
          {filteredSettlements.map((settlement) => {
            const debtorName = group.people.find((person) => person.id === settlement.debtorId)?.name ?? 'Unknown'
            const creditorName = group.people.find((person) => person.id === settlement.creditorId)?.name ?? 'Unknown'
            const debtorPerson = group.people.find((person) => person.id === settlement.debtorId)
            const creditorPerson = group.people.find((person) => person.id === settlement.creditorId)
            const metaKey = `${settlement.debtorId}-${settlement.creditorId}-${settlement.currency}`
            const meta = pairMeta.get(metaKey)
            return (
              <div key={`${settlement.debtorId}-${settlement.creditorId}-${settlement.currency}`} className="rounded-xl border border-[#d4a8a8] bg-[rgba(158,74,74,0.06)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#2c2520]">
                      <span style={getPersonNameStyle(debtorPerson)}>{debtorName}</span> → <span style={getPersonNameStyle(creditorPerson)}>{creditorName}</span>
                    </p>
                    <p className="text-xs text-[#6b6058]">
                      {t('settle.across')} {meta?.expenseCount ?? 0} {t('settle.expenseCount')}, {meta?.splitCount ?? 0} {t('settle.splitLines')}
                    </p>
                    <p className="text-lg font-bold text-[#9e4a4a]">
                      {getCurrencySymbol(settlement.currency)}
                      {formatMoney(settlement.amount)}
                    </p>
                  </div>
                  <button
                    className="ms-btn-ghost min-h-11 px-3 py-2 text-xs font-medium text-[#8a3a3a]"
                    onClick={() => handleMarkRepaid(settlement.debtorId, settlement.creditorId, settlement.currency)}
                  >
                    {t('settle.markRepaid')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-xl border border-[#e6e0d5] bg-[#faf8f4] p-3">
          <h3 className="mb-2 text-sm font-semibold text-[#2c2520]">{t('settle.totalSummary')}</h3>
          {summary.mode === 'generic' ? (
            <div className="space-y-1">
              <p className="text-xs text-[#6b6058]">{t('settle.outstandingTotals')}</p>
              {Object.entries(summary.totalByCurrency).map(([currency, amount]) => (
                <p key={currency} className="text-sm font-semibold text-[#9e4a4a]">
                  {getCurrencySymbol(currency)}
                  {formatMoney(amount)} {currency}
                </p>
              ))}
              {Object.keys(summary.totalByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noOutstanding')}</p> : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('settle.overallOutstanding')}</p>
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === debtorFilterId))}>{selectedDebtorName}</span>{' '}
                  {t('settle.owes')}{' '}
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === payerFilterId))}>{selectedPayerName}</span>{' '}
                  {t('settle.beforeContra')}
                </p>
                {Object.entries(summary.directByCurrency).map(([currency, amount]) => (
                  <p key={currency} className="mt-1 text-sm font-semibold text-[#9e4a4a]">
                    {getCurrencySymbol(currency)}
                    {formatMoney(amount)} {currency}
                  </p>
                ))}
                {Object.keys(summary.directByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noDirectDebt')}</p> : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('settle.contra')}</p>
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === payerFilterId))}>{selectedPayerName}</span>{' '}
                  {t('settle.owes')}{' '}
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === debtorFilterId))}>{selectedDebtorName}</span>{' '}
                  {t('settle.canOffset')}
                </p>
                {Object.entries(summary.contraByCurrency).map(([currency, amount]) => (
                  <p key={currency} className="mt-1 text-sm font-semibold text-[#8b6e4e]">
                    {getCurrencySymbol(currency)}
                    {formatMoney(amount)} {currency}
                  </p>
                ))}
                {Object.keys(summary.contraByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noContra')}</p> : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('settle.netAfterContra')}</p>
                {Object.entries(summary.netAfterContraByCurrency).map(([currency, amountAfterContra]) => {
                  if (Math.abs(amountAfterContra) < 0.0001) {
                    return (
                      <p key={currency} className="mt-1 text-sm font-semibold text-[#6b6058]">
                        {selectedDebtorName} and {selectedPayerName} {t('settle.settledIn')} {currency}{' '}
                        {t('settle.afterContra')}
                      </p>
                    )
                  }
                  if (amountAfterContra < 0) {
                    return (
                      <div key={currency} className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-[#8a3a3a]">
                          {getCurrencySymbol(currency)}
                          {formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} {t('settle.stillPay')}{' '}
                          {selectedPayerName}.
                        </p>
                        <button
                          className="ms-btn-primary px-3 py-1 text-xs font-semibold"
                          onClick={() =>
                            setRepayModal({
                              open: true,
                              debtorId: debtorFilterId,
                              payerId: payerFilterId,
                              currency,
                              amountAfterContra,
                            })
                          }
                        >
                          {t('settle.repayAll')}
                        </button>
                      </div>
                    )
                  }
                  return (
                    <p key={currency} className="mt-1 text-sm font-semibold text-[#4a6a4a]">
                      {getCurrencySymbol(currency)}
                      {formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} {t('settle.noNeedPay')} {selectedPayerName}{' '}
                      {t('settle.stillOwes')} {selectedDebtorName} {t('settle.afterContra')}
                    </p>
                  )
                })}
                {Object.keys(summary.netAfterContraByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noNet')}</p> : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ms-card-soft">
        <h3 className="ms-title mb-3" style={{ color: '#4a6a4a' }}>{t('settle.recentRepaid')}</h3>
        <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0 xl:grid-cols-3">
          {repaidRows.length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noRepaid')}</p> : null}
          {repaidRows.map((row) => (
            <div key={row.key} className="rounded-xl border border-[#a8c4a8] bg-[rgba(90,122,90,0.06)] p-3">
              <p className="text-sm font-semibold text-[#2c2520]">
                <span style={getPersonNameStyle(group.people.find((person) => person.id === row.debtorId))}>{row.debtorName}</span> →{' '}
                <span style={getPersonNameStyle(group.people.find((person) => person.id === row.creditorId))}>{row.creditorName}</span>
              </p>
              <p className="text-base font-bold text-[#4a6a4a]">
                {getCurrencySymbol(row.currency)}
                {formatMoney(row.amount)}
              </p>
              <p className="text-xs text-[#6b6058]">
                {t('settle.repaidOn')} {row.date}
              </p>
            </div>
          ))}
        </div>
      </div>

      {repayModal.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/40 p-3 lg:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#faf8f4] p-5 shadow-xl">
            <h3 className="text-2xl font-semibold text-[#2c2520]">{t('settle.repayModal')}</h3>
            <p className="mt-3 text-base leading-8 text-[#3a3330]">{t('settle.repayDesc')}</p>

            <p className="mt-3 text-2xl font-semibold text-[#2c2520]">
              <span style={getPersonNameStyle(group.people.find((person) => person.id === repayModal.debtorId))}>
                {group.people.find((person) => person.id === repayModal.debtorId)?.name ?? 'Debtor'}
              </span>{' '}
              {t('settle.pays')}{' '}
              <span style={getPersonNameStyle(group.people.find((person) => person.id === repayModal.payerId))}>
                {group.people.find((person) => person.id === repayModal.payerId)?.name ?? 'Payer'}
              </span>
            </p>

            <p className="mt-4 text-lg font-semibold text-[#8a3a3a]">
              {t('settle.amountAfterContra')}{' '}
              {getCurrencySymbol(repayModal.currency)}
              {formatMoney(Math.abs(repayModal.amountAfterContra))} {repayModal.currency}
            </p>

            <p className="mt-2 text-base text-[#3a3330]">
              {t('settle.linesToMark')} {repayAllLineCount}
            </p>

            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="repaid-date" className="text-lg text-[#3a3330]">
                {t('settle.repaidOn')}
              </label>
              <input
                id="repaid-date"
                type="date"
                className="ms-input flex-1"
                value={repaidDate}
                onChange={(e) => setRepaidDate(e.target.value)}
              />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-2xl bg-[#8b6e4e] px-6 py-3 text-xl font-semibold text-white"
                onClick={() => {
                  onMarkPairRepaid(repayModal.debtorId, repayModal.payerId, repayModal.currency, repaidDate)
                  onMarkPairRepaid(repayModal.payerId, repayModal.debtorId, repayModal.currency, repaidDate)
                  setRepayModal({ open: false, debtorId: '', payerId: '', currency: '', amountAfterContra: 0 })
                  setRepaidDate(todayISO())
                }}
              >
                {t('settle.confirm')}
              </button>
              <button
                className="rounded-2xl border border-[#e6e0d5] bg-[#faf8f4] px-6 py-3 text-xl font-medium text-[#3a3330]"
                onClick={() => {
                  setRepayModal({ open: false, debtorId: '', payerId: '', currency: '', amountAfterContra: 0 })
                  setRepaidDate(todayISO())
                }}
              >
                {t('expense.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmModal.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/40 p-3 lg:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-[#faf8f4] p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#2c2520]">{t('settle.confirmRepaid')}</h3>
            <p className="mt-2 text-sm text-[#6b6058]">{t('settle.confirmRepaidDesc')}</p>

            <div className="mt-3 rounded-xl border border-[#e6e0d5] bg-white p-3">
              <p className="text-sm font-semibold text-[#2c2520]">
                <span style={getPersonNameStyle(group.people.find((p) => p.id === confirmModal.debtorId))}>
                  {group.people.find((p) => p.id === confirmModal.debtorId)?.name ?? '?'}
                </span>
                {' → '}
                <span style={getPersonNameStyle(group.people.find((p) => p.id === confirmModal.creditorId))}>
                  {group.people.find((p) => p.id === confirmModal.creditorId)?.name ?? '?'}
                </span>
              </p>
              <p className="mt-1 text-base font-bold text-[#9e4a4a]">
                {getCurrencySymbol(confirmModal.currency)}{' '}
                {formatMoney(filteredSettlements.find(
                  (s) => s.debtorId === confirmModal.debtorId && s.creditorId === confirmModal.creditorId && s.currency === confirmModal.currency,
                )?.amount ?? 0)}
                {' '}{confirmModal.currency}
              </p>
            </div>

            <button
              type="button"
              className="mt-4 flex items-center gap-2 text-sm text-[#6b6058]"
              onClick={() => setConfirmModal((prev) => ({ ...prev, dontShowAgain: !prev.dontShowAgain }))}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  confirmModal.dontShowAgain
                    ? 'border-[#8b6e4e] bg-[#8b6e4e] text-white'
                    : 'border-[#c4b8a8] bg-white'
                }`}
              >
                {confirmModal.dontShowAgain ? (
                  <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              {t('settle.doNotShowAgain')}
            </button>

            <div className="mt-4 flex gap-2">
              <button className="ms-btn-primary flex-1 py-2.5" onClick={confirmRepaid}>
                {t('settle.confirm')}
              </button>
              <button
                className="ms-btn-ghost flex-1 py-2.5"
                onClick={() => setConfirmModal({ open: false, debtorId: '', creditorId: '', currency: '', dontShowAgain: false })}
              >
                {t('expense.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
