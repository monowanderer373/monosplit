import { useEffect, useMemo, useState } from 'react'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney, todayISO } from '../lib/format'
import { useT } from '../lib/i18n'
import { getGroupBackups, relativeTime, type GroupBackup } from '../lib/groupBackups'
import { getPersonNameStyle } from '../lib/personTheme'
import {
  autoAllocateSettlement,
  createGroupSettlementSnapshot,
  getCounterpartyBalances,
  getSplitOutstandingAmountFromSnapshot,
  isSplitFullySettledFromSnapshot,
  type SettlementPaymentSummary,
} from '../lib/settlementLedger'
import { useStore } from '../store/useStore'
import type { Group } from '../types'

type Props = {
  group: Group
  canSettle?: boolean
}

type QuickSettleState = {
  open: boolean
  debtorId: string
  creditorId: string
  currency: string
  amount: number
  paymentDate: string
}

type EditPaymentState = {
  paymentId: string
  paymentDate: string
  repayAmount: string
  allocations: Record<string, string>
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

export default function SettleTab({ group, canSettle = true }: Props) {
  const t = useT()
  const addSettlementPayment = useStore((state) => state.addSettlementPayment)
  const updateSettlementPayment = useStore((state) => state.updateSettlementPayment)
  const removeSettlementPayment = useStore((state) => state.removeSettlementPayment)
  const restoreGroupFromBackup = useStore((state) => state.restoreGroupFromBackup)
  const lang = useStore((state) => state.lang)
  const snapshot = useMemo(() => createGroupSettlementSnapshot(group), [group])
  const settlements = snapshot.settlements
  const [debtorFilterId, setDebtorFilterId] = useState('all')
  const [payerFilterId, setPayerFilterId] = useState('all')
  const [settlePayerFilterId, setSettlePayerFilterId] = useState('all')
  const [settleRepayFilterId, setSettleRepayFilterId] = useState('all')
  const [quickSettle, setQuickSettle] = useState<QuickSettleState>({
    open: false,
    debtorId: '',
    creditorId: '',
    currency: '',
    amount: 0,
    paymentDate: todayISO(),
  })
  const [editPayment, setEditPayment] = useState<EditPaymentState | null>(null)
  const editingPaymentTarget = useMemo(
    () => (editPayment ? snapshot.paymentSummaries.find((row) => row.payment.id === editPayment.paymentId)?.payment ?? null : null),
    [editPayment, snapshot.paymentSummaries],
  )

  useEffect(() => {
    setSettlePayerFilterId('all')
    setSettleRepayFilterId('all')
  }, [group.id])

  const personNameById = useMemo(() => {
    const map: Record<string, string> = {}
    group.people.forEach((person) => {
      map[person.id] = person.name
    })
    return map
  }, [group.people])

  const pairMeta = useMemo(() => {
    const meta = new Map<string, { expenseCount: number; splitCount: number }>()
    group.expenses.forEach((expense) => {
      const payerIds = expense.payerIds ?? []
      const seenPairs = new Set<string>()
      expense.splits.forEach((split, splitIndex) => {
        if (payerIds.includes(split.personId)) return
        const outstandingAmount = getSplitOutstandingAmountFromSnapshot(snapshot, expense.id, splitIndex)
        if (outstandingAmount <= 0.001) return
        for (const payerId of payerIds) {
          const key = `${split.personId}-${payerId}-${expense.paidCurrency}`
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
  }, [group.expenses, snapshot])

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
      totalByCurrency[row.currency] = round4((totalByCurrency[row.currency] || 0) + row.amount)
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
        directByCurrency[row.currency] = round4((directByCurrency[row.currency] || 0) + row.amount)
      }
      if (row.debtorId === payerFilterId && row.creditorId === debtorFilterId) {
        contraByCurrency[row.currency] = round4((contraByCurrency[row.currency] || 0) + row.amount)
      }
    })

    const currencies = Array.from(new Set([...Object.keys(directByCurrency), ...Object.keys(contraByCurrency)]))
    const netAfterContraByCurrency: Record<string, number> = {}
    currencies.forEach((currency) => {
      netAfterContraByCurrency[currency] = round4((contraByCurrency[currency] || 0) - (directByCurrency[currency] || 0))
    })

    return {
      mode: 'pair' as const,
      totalByCurrency,
      directByCurrency,
      contraByCurrency,
      netAfterContraByCurrency,
    }
  }, [debtorFilterId, filteredSettlements, payerFilterId, settlements])

  const settlementRows = useMemo(() => {
    const showOnlyOutstanding = settlePayerFilterId === 'all' && settleRepayFilterId === 'all'
    return group.expenses
      .slice()
      .sort((a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime())
      .map((expense) => {
        if (settlePayerFilterId !== 'all' && !(expense.payerIds ?? []).includes(settlePayerFilterId)) return null
        const rows = expense.splits
          .map((split, splitIndex) => ({
            split,
            splitIndex,
          }))
          .filter(({ split }) => !(expense.payerIds ?? []).includes(split.personId))
          .filter(({ split }) => settleRepayFilterId === 'all' || split.personId === settleRepayFilterId)
          .map(({ split, splitIndex }) => {
            const amount = getSplitOutstandingAmountFromSnapshot(snapshot, expense.id, splitIndex)
            const repaid = isSplitFullySettledFromSnapshot(snapshot, expense.id, splitIndex)
            return {
              personId: split.personId,
              amount,
              repaid,
            }
          })
          .filter((row) => row.amount > 0.001 || row.repaid)
        if (rows.length === 0) return null
        const outstandingTotal = rows.filter((row) => !row.repaid).reduce((sum, row) => sum + row.amount, 0)
        if (showOnlyOutstanding && outstandingTotal <= 0.001) return null
        return {
          expenseId: expense.id,
          description: expense.description,
          date: expense.date,
          payerIds: expense.payerIds,
          amount: expense.amount,
          paidCurrency: expense.paidCurrency,
          rows,
          outstandingTotal,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
  }, [group.expenses, settlePayerFilterId, settleRepayFilterId, snapshot])

  const paymentHistory = useMemo(() => snapshot.paymentSummaries.slice(0, 8), [snapshot.paymentSummaries])

  const [backupsOpen, setBackupsOpen] = useState(false)
  const [backups, setBackups] = useState<GroupBackup[]>([])

  useEffect(() => {
    if (backupsOpen) setBackups(getGroupBackups(group.id))
  }, [backupsOpen, group.id])

  const handleRestore = (backup: GroupBackup) => {
    if (!window.confirm(t('backup.confirmRestore'))) return
    restoreGroupFromBackup(group.id, backup.data.expenses, backup.data.settlementPayments)
    setBackupsOpen(false)
    setBackups([])
  }

  const openQuickSettle = (debtorId: string, creditorId: string, currency: string, amount: number) => {
    if (!canSettle) return
    setQuickSettle({
      open: true,
      debtorId,
      creditorId,
      currency,
      amount,
      paymentDate: todayISO(),
    })
  }

  const confirmQuickSettle = () => {
    if (!canSettle || !quickSettle.debtorId || !quickSettle.creditorId || quickSettle.amount <= 0) return
    addSettlementPayment(group.id, {
      debtorId: quickSettle.debtorId,
      currency: quickSettle.currency,
      repayCurrency: quickSettle.currency,
      repayAmount: quickSettle.amount,
      paymentDate: quickSettle.paymentDate,
      rate: null,
      rateSource: null,
      rateDate: null,
      source: 'quick_settle',
      allocations: [{ creditorId: quickSettle.creditorId, amount: quickSettle.amount }],
      note: null,
    })
    setQuickSettle({
      open: false,
      debtorId: '',
      creditorId: '',
      currency: '',
      amount: 0,
      paymentDate: todayISO(),
    })
  }

  const startEditPayment = (summaryRow: SettlementPaymentSummary) => {
    const allocations: Record<string, string> = {}
    const currentCounterpartyIds = new Set(
      getCounterpartyBalances(snapshot, summaryRow.payment.debtorId, summaryRow.payment.currency).map((row) => row.creditorId),
    )
    summaryRow.payment.allocations.forEach((allocation) => {
      currentCounterpartyIds.add(allocation.creditorId)
    })
    Array.from(currentCounterpartyIds).forEach((creditorId) => {
      const existing = summaryRow.payment.allocations.find((allocation) => allocation.creditorId === creditorId)
      allocations[creditorId] = existing ? String(existing.amount) : ''
    })
    setEditPayment({
      paymentId: summaryRow.payment.id,
      paymentDate: summaryRow.payment.paymentDate,
      repayAmount: String(summaryRow.payment.repayAmount),
      allocations,
    })
  }

  const saveEditedPayment = () => {
    if (!editPayment) return
    const target = editingPaymentTarget
    if (!target) return
    const nextRepayAmount = Number(editPayment.repayAmount || 0)
    if (!Number.isFinite(nextRepayAmount) || nextRepayAmount < 0) return
    const allocations = Object.entries(editPayment.allocations)
      .map(([creditorId, rawAmount]) => ({
        creditorId,
        amount: Math.max(0, round4(Number(rawAmount || 0))),
      }))
      .filter((allocation) => allocation.amount > 0.0001)
    const debtBudget =
      target.repayCurrency !== target.currency && target.rate && target.rate > 0
        ? nextRepayAmount / target.rate
        : nextRepayAmount
    const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.amount, 0)
    if (allocationTotal - debtBudget > 0.001) {
      window.alert(t('settle.editOverAllocated'))
      return
    }
    updateSettlementPayment(group.id, target.id, {
      paymentDate: editPayment.paymentDate,
      repayAmount: nextRepayAmount,
      allocations,
      source: 'history_edit',
    })
    setEditPayment(null)
  }

  const adjustEditedPaymentByCurrentDebt = () => {
    if (!editPayment || !editingPaymentTarget) return
    const nextRepayAmount = Number(editPayment.repayAmount || 0)
    if (!Number.isFinite(nextRepayAmount) || nextRepayAmount < 0) return
    const debtBudget =
      editingPaymentTarget.repayCurrency !== editingPaymentTarget.currency && editingPaymentTarget.rate && editingPaymentTarget.rate > 0
        ? nextRepayAmount / editingPaymentTarget.rate
        : nextRepayAmount
    const nextAllocations = autoAllocateSettlement(
      getCounterpartyBalances(snapshot, editingPaymentTarget.debtorId, editingPaymentTarget.currency)
        .filter((row) => row.netAmount > 0.001)
        .map((row) => ({ creditorId: row.creditorId, amount: row.netAmount })),
      debtBudget,
    )
    const nextMap: Record<string, string> = {}
    Object.keys(editPayment.allocations).forEach((creditorId) => {
      nextMap[creditorId] = ''
    })
    nextAllocations.forEach((allocation) => {
      nextMap[allocation.creditorId] = allocation.amount > 0 ? String(allocation.amount) : ''
    })
    setEditPayment((prev) => (prev ? { ...prev, allocations: nextMap } : prev))
  }

  const selectedDebtorName = group.people.find((person) => person.id === debtorFilterId)?.name ?? t('card.unknown')
  const selectedPayerName = group.people.find((person) => person.id === payerFilterId)?.name ?? t('card.unknown')

  return (
    <section className="space-y-4 pb-20 lg:pb-0">
      <div className="ms-card-soft">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="ms-title mr-auto">{t('summary.settlementTitle')}</h2>
          <select
            className="ms-input h-8 py-0 text-xs"
            value={settlePayerFilterId}
            onChange={(e) => setSettlePayerFilterId(e.target.value)}
          >
            <option value="all">{t('settle.allPayers')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
          <select
            className="ms-input h-8 py-0 text-xs"
            value={settleRepayFilterId}
            onChange={(e) => setSettleRepayFilterId(e.target.value)}
          >
            <option value="all">{t('settle.allMembers')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </div>

        {settlementRows.length === 0 ? (
          <div className="py-6 text-center text-sm text-[#6b6058]">{t('summary.noSettlement')}</div>
        ) : (
          <div className="space-y-3">
            {settlementRows.map((row) => {
              const isFullySettled = row.outstandingTotal <= 0.001
              return (
                <div
                  key={row.expenseId}
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: isFullySettled ? 'rgba(80,106,70,0.30)' : 'rgba(158,74,74,0.22)',
                    background: isFullySettled ? 'rgba(80,106,70,0.05)' : 'rgba(158,74,74,0.04)',
                  }}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: `1px solid ${isFullySettled ? 'rgba(80,106,70,0.18)' : 'rgba(158,74,74,0.12)'}` }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#2c2520]">{row.description}</p>
                      <p className="text-xs text-[#9a9088]">
                        {t('card.paidBy')}{' '}
                        {row.payerIds.map((pid, index) => (
                          <span key={pid} className="font-medium text-[#6b6058]">
                            {index > 0 ? ', ' : ''}{personNameById[pid] ?? t('card.unknown')}
                          </span>
                        ))}
                        {' '}· {row.date}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-[#2c2520]">
                        {getCurrencySymbol(row.paidCurrency)}{formatMoney(row.amount)}
                      </p>
                      {isFullySettled ? (
                        <span className="inline-block rounded-full bg-[rgba(80,106,70,0.15)] px-2 py-0.5 text-[10px] font-semibold text-[#4e6642]">
                          {t('settle.settledBadge')}
                        </span>
                      ) : (
                        <p className="text-xs font-bold text-[#9e4a4a]">
                          {getCurrencySymbol(row.paidCurrency)}{formatMoney(row.outstandingTotal)} {t('settle.due')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    {row.rows.map((line, idx) => {
                      const person = group.people.find((p) => p.id === line.personId)
                      const initial = (person?.name ?? '?').slice(0, 1).toUpperCase()
                      return (
                        <div
                          key={`${row.expenseId}-${line.personId}-${idx}`}
                          className="flex items-center gap-3 px-4 py-2.5"
                          style={{
                            borderTop: idx > 0 ? `1px solid ${isFullySettled ? 'rgba(80,106,70,0.10)' : 'rgba(139,110,78,0.10)'}` : undefined,
                            background: line.repaid ? 'rgba(80,106,70,0.04)' : 'transparent',
                          }}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              background: line.repaid ? 'rgba(80,106,70,0.15)' : 'rgba(139,110,78,0.12)',
                              color: line.repaid ? '#4e6642' : '#5a4838',
                            }}
                          >
                            {initial}
                          </div>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#2c2520]">
                            {person?.name ?? t('card.unknown')}
                          </span>
                          {line.repaid ? (
                            <span className="shrink-0 text-sm font-semibold text-[#4e6642]">{t('summary.paid')}</span>
                          ) : (
                            <span className="shrink-0 text-sm font-bold text-[#9e4a4a]">
                              {getCurrencySymbol(row.paidCurrency)}{formatMoney(line.amount)}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="ms-card-soft">
        <h2 className="ms-title mb-3">{t('settle.title')}</h2>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="ms-input w-full" value={payerFilterId} onChange={(e) => setPayerFilterId(e.target.value)}>
            <option value="all">{t('settle.payerAll')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
          <select className="ms-input w-full" value={debtorFilterId} onChange={(e) => setDebtorFilterId(e.target.value)}>
            <option value="all">{t('settle.debtorAll')}</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </div>

        {filteredSettlements.length === 0 ? <p className="text-sm text-[#4a6a4a]">{t('settle.noBalances')}</p> : null}
        <div className="space-y-2">
          {filteredSettlements.map((settlement) => {
            const debtorPerson = group.people.find((person) => person.id === settlement.debtorId)
            const creditorPerson = group.people.find((person) => person.id === settlement.creditorId)
            const metaKey = `${settlement.debtorId}-${settlement.creditorId}-${settlement.currency}`
            const meta = pairMeta.get(metaKey)
            return (
              <div key={`${settlement.debtorId}-${settlement.creditorId}-${settlement.currency}`} className="rounded-xl border border-[#d4a8a8] bg-[rgba(158,74,74,0.06)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#2c2520]">
                      <span style={getPersonNameStyle(debtorPerson)}>{debtorPerson?.name ?? t('card.unknown')}</span> →{' '}
                      <span style={getPersonNameStyle(creditorPerson)}>{creditorPerson?.name ?? t('card.unknown')}</span>
                    </p>
                    <p className="text-xs text-[#6b6058]">
                      {t('settle.across')} {meta?.expenseCount ?? 0} {t('settle.expenseCount')}, {meta?.splitCount ?? 0} {t('settle.splitLines')}
                    </p>
                    <p className="text-lg font-bold text-[#9e4a4a]">
                      {getCurrencySymbol(settlement.currency)}{formatMoney(settlement.amount)}
                    </p>
                  </div>
                  <button
                    className="ms-btn-ghost min-h-11 px-3 py-2 text-xs font-medium text-[#8a3a3a]"
                    disabled={!canSettle}
                    onClick={() => openQuickSettle(settlement.debtorId, settlement.creditorId, settlement.currency, settlement.amount)}
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
                  {getCurrencySymbol(currency)}{formatMoney(amount)} {currency}
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
                    {getCurrencySymbol(currency)}{formatMoney(amount)} {currency}
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
                    {getCurrencySymbol(currency)}{formatMoney(amount)} {currency}
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
                        {selectedDebtorName} and {selectedPayerName} {t('settle.settledIn')} {currency} {t('settle.afterContra')}
                      </p>
                    )
                  }
                  if (amountAfterContra < 0) {
                    return (
                      <div key={currency} className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-[#8a3a3a]">
                          {getCurrencySymbol(currency)}{formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} {t('settle.stillPay')} {selectedPayerName}.
                        </p>
                        <button
                          className="ms-btn-primary px-3 py-1 text-xs font-semibold"
                          disabled={!canSettle}
                          onClick={() => openQuickSettle(debtorFilterId, payerFilterId, currency, Math.abs(amountAfterContra))}
                        >
                          {t('settle.repayAll')}
                        </button>
                      </div>
                    )
                  }
                  return (
                    <p key={currency} className="mt-1 text-sm font-semibold text-[#4a6a4a]">
                      {getCurrencySymbol(currency)}{formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} {t('settle.noNeedPay')} {selectedPayerName} {t('settle.stillOwes')} {selectedDebtorName} {t('settle.afterContra')}
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
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="ms-title" style={{ color: '#4a6a4a' }}>{t('settle.historyTitle')}</h3>
        </div>
        <div className="space-y-2">
          {paymentHistory.length === 0 ? <p className="text-sm text-[#6b6058]">{t('settle.noRepaid')}</p> : null}
          {paymentHistory.map((summaryRow) => {
            const debtor = group.people.find((person) => person.id === summaryRow.payment.debtorId)
            const creditorNames = summaryRow.payment.allocations.map((allocation) => personNameById[allocation.creditorId] ?? t('card.unknown'))
            return (
              <div key={summaryRow.payment.id} className="rounded-xl border border-[#a8c4a8] bg-[rgba(90,122,90,0.06)] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#2c2520]">
                      <span style={getPersonNameStyle(debtor)}>{debtor?.name ?? t('card.unknown')}</span> →{' '}
                      <span>{creditorNames.length === 1 ? creditorNames[0] : `${creditorNames.length} ${t('settle.creditorsLabel')}`}</span>
                    </p>
                    <p className="text-base font-bold text-[#4a6a4a]">
                      {getCurrencySymbol(summaryRow.payment.repayCurrency)}{formatMoney(summaryRow.payment.repayAmount)}
                    </p>
                    <p className="text-xs text-[#6b6058]">
                      {t('settle.repaidOn')} {summaryRow.payment.paymentDate}
                    </p>
                    <div className="mt-2 space-y-1">
                      {summaryRow.allocations.map((allocation) => (
                        <p key={`${summaryRow.payment.id}-${allocation.creditorId}`} className="text-xs text-[#4f463f]">
                          {personNameById[allocation.creditorId] ?? t('card.unknown')}: {getCurrencySymbol(summaryRow.payment.currency)}{formatMoney(allocation.amount)}
                          {summaryRow.payment.currency !== summaryRow.payment.repayCurrency ? ` ${summaryRow.payment.currency}` : ''}
                        </p>
                      ))}
                    </div>
                    {summaryRow.unappliedAmount > 0.001 ? (
                      <p className="mt-2 text-xs font-semibold text-[#9e4a4a]">
                        {t('settle.unappliedWarning')} {getCurrencySymbol(summaryRow.payment.currency)}{formatMoney(summaryRow.unappliedAmount)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button className="ms-btn-ghost px-3 py-2 text-xs" disabled={!canSettle} onClick={() => startEditPayment(summaryRow)}>
                      {t('group.edit')}
                    </button>
                    <button
                      className="ms-btn-ghost border-[#c49898] px-3 py-2 text-xs text-[#9e4a4a]"
                      disabled={!canSettle}
                      onClick={() => {
                        if (!window.confirm(t('settle.undoPaymentConfirm'))) return
                        removeSettlementPayment(group.id, summaryRow.payment.id)
                      }}
                    >
                      {t('card.undo')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Backup restore panel ─────────────────────────────────────────── */}
      <div className="ms-card-soft">
        <button
          className="flex w-full items-center justify-between gap-3"
          onClick={() => setBackupsOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b6058" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
            </svg>
            <span className="text-sm font-semibold text-[#6b6058]">{t('backup.title')}</span>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9a9088" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: backupsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {backupsOpen && (
          <div className="mt-3 space-y-2">
            {backups.length === 0 ? (
              <p className="text-sm text-[#9a9088]">{t('backup.noBackups')}</p>
            ) : (
              backups.slice(0, 10).map((backup) => {
                const triggerLabel = {
                  add_payment: t('backup.triggerAdd'),
                  remove_payment: t('backup.triggerRemove'),
                  update_payment: t('backup.triggerUpdate'),
                  manual: t('backup.triggerManual'),
                }[backup.trigger] ?? backup.trigger
                return (
                  <div key={backup.id} className="flex items-center gap-3 rounded-xl border border-[var(--ms-border,#e6e0d5)] bg-[var(--ms-surface,#faf8f4)] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#2c2520]">{relativeTime(backup.savedAt, lang)}</p>
                      <p className="text-xs text-[#9a9088]">{triggerLabel}</p>
                    </div>
                    <button
                      className="shrink-0 rounded-lg border border-[#c49898] px-3 py-1.5 text-xs font-semibold text-[#9e4a4a] transition-colors hover:bg-[rgba(158,74,74,0.08)] active:opacity-70"
                      onClick={() => handleRestore(backup)}
                    >
                      {t('backup.restore')}
                    </button>
                  </div>
                )
              })
            )}
            <p className="pt-1 text-[11px] text-[#9a9088]">{t('backup.deviceOnly')}</p>
          </div>
        )}
      </div>

      {quickSettle.open && canSettle ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/40 p-3 lg:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#faf8f4] p-5 shadow-xl">
            <h3 className="text-2xl font-semibold text-[#2c2520]">{t('settle.repayModal')}</h3>
            <p className="mt-3 text-base leading-8 text-[#3a3330]">{t('settle.repayDesc')}</p>
            <p className="mt-4 text-lg font-semibold text-[#8a3a3a]">
              {getCurrencySymbol(quickSettle.currency)}{formatMoney(quickSettle.amount)} {quickSettle.currency}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="quick-settle-date" className="text-sm text-[#3a3330]">{t('settle.repaidOn')}</label>
              <input
                id="quick-settle-date"
                type="date"
                className="ms-input flex-1"
                value={quickSettle.paymentDate}
                onChange={(e) => setQuickSettle((prev) => ({ ...prev, paymentDate: e.target.value }))}
              />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button className="rounded-2xl bg-[#8b6e4e] px-6 py-3 text-lg font-semibold text-white" onClick={confirmQuickSettle}>
                {t('settle.confirm')}
              </button>
              <button
                className="rounded-2xl border border-[#e6e0d5] bg-[#faf8f4] px-6 py-3 text-lg font-medium text-[#3a3330]"
                onClick={() => setQuickSettle({ open: false, debtorId: '', creditorId: '', currency: '', amount: 0, paymentDate: todayISO() })}
              >
                {t('expense.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editPayment ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/40 p-3 lg:items-center">
          <div className="w-full max-w-lg rounded-3xl bg-[#faf8f4] p-5 shadow-xl">
            <h3 className="text-xl font-semibold text-[#2c2520]">{t('settle.editPaymentTitle')}</h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-[#3a3330]">
                {t('settle.repaidOn')}
                <input
                  type="date"
                  className="ms-input mt-1 w-full"
                  value={editPayment.paymentDate}
                  onChange={(e) => setEditPayment((prev) => (prev ? { ...prev, paymentDate: e.target.value } : prev))}
                />
              </label>
              <label className="block text-sm text-[#3a3330]">
                {t('settle.paymentAmount')}
                <input
                  className="ms-input mt-1 w-full"
                  type="number"
                  inputMode="decimal"
                  value={editPayment.repayAmount}
                  onChange={(e) => setEditPayment((prev) => (prev ? { ...prev, repayAmount: e.target.value } : prev))}
                />
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('settle.paymentAllocations')}</p>
                  <button className="text-xs font-medium text-[#6b6058] underline underline-offset-2" onClick={adjustEditedPaymentByCurrentDebt}>
                    {t('settle.adjustedByCurrentDebt')}
                  </button>
                </div>
                {Object.entries(editPayment.allocations).map(([creditorId, amount]) => (
                  <label key={creditorId} className="block text-sm text-[#3a3330]">
                    {personNameById[creditorId] ?? t('card.unknown')}
                    <input
                      className="ms-input mt-1 w-full"
                      type="number"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) =>
                        setEditPayment((prev) =>
                          prev
                            ? {
                                ...prev,
                                allocations: { ...prev.allocations, [creditorId]: e.target.value },
                              }
                            : prev,
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button className="ms-btn-primary flex-1 py-2.5" onClick={saveEditedPayment}>
                {t('expense.saveChanges')}
              </button>
              <button className="ms-btn-ghost flex-1 py-2.5" onClick={() => setEditPayment(null)}>
                {t('expense.cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
