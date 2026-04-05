import { useMemo, useState } from 'react'
import { getSettlements } from '../lib/settlement'
import { getCurrencySymbol } from '../lib/currency'
import { formatMoney, todayISO } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Group } from '../types'

type Props = {
  group: Group
  onMarkPairRepaid: (debtorId: string, creditorId: string, currency: string, repaidDate: string) => void
}

export default function SettleTab({ group, onMarkPairRepaid }: Props) {
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

  return (
    <section className="space-y-4 pb-20 lg:pb-0">
      <div className="ms-card-soft">
        <h2 className="ms-title mb-3">Outstanding Dashboard</h2>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="ms-input w-full"
            value={payerFilterId}
            onChange={(e) => setPayerFilterId(e.target.value)}
          >
            <option value="all">Payer · All</option>
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
            <option value="all">Debtor · All</option>
            {group.people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>

        {filteredSettlements.length === 0 ? <p className="text-sm text-[#4a6a4a]">No outstanding balances for this filter.</p> : null}
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
                      across {meta?.expenseCount ?? 0} expense(s), {meta?.splitCount ?? 0} split line(s)
                    </p>
                    <p className="text-lg font-bold text-[#9e4a4a]">
                      {getCurrencySymbol(settlement.currency)}
                      {formatMoney(settlement.amount)}
                    </p>
                  </div>
                  <button
                    className="ms-btn-ghost min-h-11 px-3 py-2 text-xs font-medium text-[#8a3a3a]"
                    onClick={() => onMarkPairRepaid(settlement.debtorId, settlement.creditorId, settlement.currency, todayISO())}
                  >
                    Mark as repaid
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-xl border border-[#e6e0d5] bg-[#faf8f4] p-3">
          <h3 className="mb-2 text-sm font-semibold text-[#2c2520]">Total Summary</h3>
          {summary.mode === 'generic' ? (
            <div className="space-y-1">
              <p className="text-xs text-[#6b6058]">Outstanding totals for current filters</p>
              {Object.entries(summary.totalByCurrency).map(([currency, amount]) => (
                <p key={currency} className="text-sm font-semibold text-[#9e4a4a]">
                  {getCurrencySymbol(currency)}
                  {formatMoney(amount)} {currency}
                </p>
              ))}
              {Object.keys(summary.totalByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">No outstanding amount.</p> : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Overall outstanding</p>
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === debtorFilterId))}>{selectedDebtorName}</span> owes{' '}
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === payerFilterId))}>{selectedPayerName}</span> before contra
                </p>
                {Object.entries(summary.directByCurrency).map(([currency, amount]) => (
                  <p key={currency} className="mt-1 text-sm font-semibold text-[#9e4a4a]">
                    {getCurrencySymbol(currency)}
                    {formatMoney(amount)} {currency}
                  </p>
                ))}
                {Object.keys(summary.directByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">No direct debt found.</p> : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Contra (two-way, same currency)</p>
                <p className="text-xs text-[#6b6058]">
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === payerFilterId))}>{selectedPayerName}</span> owes{' '}
                  <span style={getPersonNameStyle(group.people.find((person) => person.id === debtorFilterId))}>{selectedDebtorName}</span> and can be offset
                </p>
                {Object.entries(summary.contraByCurrency).map(([currency, amount]) => (
                  <p key={currency} className="mt-1 text-sm font-semibold text-[#8b6e4e]">
                    {getCurrencySymbol(currency)}
                    {formatMoney(amount)} {currency}
                  </p>
                ))}
                {Object.keys(summary.contraByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">No contra amount.</p> : null}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Net after contra</p>
                {Object.entries(summary.netAfterContraByCurrency).map(([currency, amountAfterContra]) => {
                  if (Math.abs(amountAfterContra) < 0.0001) {
                    return (
                      <p key={currency} className="mt-1 text-sm font-semibold text-[#6b6058]">
                        {selectedDebtorName} and {selectedPayerName} are settled in {currency} after contra.
                      </p>
                    )
                  }
                  if (amountAfterContra < 0) {
                    return (
                      <div key={currency} className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-[#8a3a3a]">
                          {getCurrencySymbol(currency)}
                          {formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} still needs to pay {selectedPayerName}.
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
                          Repay all
                        </button>
                      </div>
                    )
                  }
                  return (
                    <p key={currency} className="mt-1 text-sm font-semibold text-[#4a6a4a]">
                      {getCurrencySymbol(currency)}
                      {formatMoney(Math.abs(amountAfterContra))} {currency} · {selectedDebtorName} does not need to pay; {selectedPayerName} still owes {selectedDebtorName} after contra.
                    </p>
                  )
                })}
                {Object.keys(summary.netAfterContraByCurrency).length === 0 ? <p className="text-sm text-[#6b6058]">No net amount.</p> : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="ms-card-soft">
        <h3 className="ms-title mb-3" style={{ color: '#4a6a4a' }}>Recent Repaid</h3>
        <div className="space-y-2 md:grid md:grid-cols-2 md:gap-2 md:space-y-0 xl:grid-cols-3">
          {repaidRows.length === 0 ? <p className="text-sm text-[#6b6058]">No repaid records yet.</p> : null}
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
              <p className="text-xs text-[#6b6058]">Repaid on {row.date}</p>
            </div>
          ))}
        </div>
      </div>

      {repayModal.open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2c2520]/40 p-3 lg:items-center">
          <div className="w-full max-w-md rounded-3xl bg-[#faf8f4] p-5 shadow-xl">
            <h3 className="text-2xl font-semibold text-[#2c2520]">Repay all matching shares</h3>
            <p className="mt-3 text-base leading-8 text-[#3a3330]">
              Confirm this payment to settle all matching unpaid lines for this payer/debtor pair in one action.
            </p>

            <p className="mt-3 text-2xl font-semibold text-[#2c2520]">
              <span style={getPersonNameStyle(group.people.find((person) => person.id === repayModal.debtorId))}>
                {group.people.find((person) => person.id === repayModal.debtorId)?.name ?? 'Debtor'}
              </span>{' '}
              pays{' '}
              <span style={getPersonNameStyle(group.people.find((person) => person.id === repayModal.payerId))}>
                {group.people.find((person) => person.id === repayModal.payerId)?.name ?? 'Payer'}
              </span>
            </p>

            <p className="mt-4 text-lg font-semibold text-[#8a3a3a]">
              Amount to pay after contra:{' '}
              {getCurrencySymbol(repayModal.currency)}
              {formatMoney(Math.abs(repayModal.amountAfterContra))} {repayModal.currency}
            </p>

            <p className="mt-2 text-base text-[#3a3330]">Lines to mark repaid: {repayAllLineCount}</p>

            <div className="mt-4 flex items-center gap-3">
              <label htmlFor="repaid-date" className="text-lg text-[#3a3330]">
                Repaid on
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
                Confirm
              </button>
              <button
                className="rounded-2xl border border-[#e6e0d5] bg-[#faf8f4] px-6 py-3 text-xl font-medium text-[#3a3330]"
                onClick={() => {
                  setRepayModal({ open: false, debtorId: '', payerId: '', currency: '', amountAfterContra: 0 })
                  setRepaidDate(todayISO())
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
