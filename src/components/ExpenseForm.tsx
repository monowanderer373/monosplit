import { useEffect, useMemo, useState } from 'react'
import { CURRENCIES, getCurrencySymbol, type RateResult } from '../lib/currency'
import { detectCategory } from '../lib/autoCategory'
import {
  calcEqualSplits,
  calcItemizedSplits,
  calcPercentageSplits,
  calcSharesSplits,
  calcAdjustmentSplits,
  assertPayerHasItemizedValue,
} from '../lib/splitCalc'
import { formatMoney, todayISO } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Expense, ExpenseType, Group, ItemizedInputMode, PaymentMethod, RateMode, SplitMode } from '../types'
import { SELECTABLE_EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import { useT, tCategory } from '../lib/i18n'
import SplitExpander from './SplitExpander'


type Props = {
  group: Group
  initialExpense?: Expense | null
  submitLabel?: string
  title?: string
  showModeBadge?: boolean
  onSave: (expense: Omit<Expense, 'id' | 'createdAt'>) => void
  onCancel?: () => void
  onRemove?: () => void
}

type FormState = {
  expenseType: ExpenseType
  category: string
  description: string
  payerIds: string[]
  amount: string
  paidCurrency: string
  repayCurrency: string
  paymentMethod: PaymentMethod
  splitMode: SplitMode
  splitPersonIds: string[]
  itemizedInputMode: ItemizedInputMode
  itemizedInput: Record<string, string>
  percentageInput: Record<string, string>
  sharesInput: Record<string, string>
  adjustmentInput: Record<string, string>
  serviceTaxPct: string
  salesTaxPct: string
  tipsPct: string
  rateMode: RateMode
  manualRate: string
  date: string
}

function hasFiniteNumberInput(raw: string | undefined): boolean {
  if (raw == null || raw === '') return false
  const value = Number(raw)
  return Number.isFinite(value)
}

function getActiveSplitPersonIds(form: FormState): string[] {
  if (form.expenseType === 'refund' || form.splitMode === 'equal') return form.splitPersonIds

  if (form.splitMode === 'itemized') {
    return form.splitPersonIds.filter((personId) => {
      const raw = form.itemizedInput[personId]
      if (raw == null || raw === '') return false
      const value = Number(raw)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'percentage') {
    return form.splitPersonIds.filter((personId) => {
      const value = Number(form.percentageInput[personId] || 0)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'shares') {
    return form.splitPersonIds.filter((personId) => {
      const value = Number(form.sharesInput[personId] || 0)
      return Number.isFinite(value) && value > 0
    })
  }

  if (form.splitMode === 'adjustment') {
    return form.splitPersonIds.filter((personId) => hasFiniteNumberInput(form.adjustmentInput[personId]))
  }

  return form.splitPersonIds
}

function blankForm(group: Group): FormState {
  const today = todayISO()
  return {
    expenseType: 'expense',
    category: 'Other',
    description: '',
    payerIds: group.people[0] ? [group.people[0].id] : [],
    amount: '',
    paidCurrency: group.defaultPaidCurrency,
    repayCurrency: group.defaultRepayCurrency,
    paymentMethod: 'card',
    splitMode: 'equal',
    splitPersonIds: group.people.map((p) => p.id),
    itemizedInputMode: 'pretax',
    itemizedInput: {},
    percentageInput: {},
    sharesInput: {},
    adjustmentInput: {},
    serviceTaxPct: '',
    salesTaxPct: '',
    tipsPct: '',
    rateMode: 'auto',
    manualRate: '',
    date: today,
  }
}

function expenseToForm(expense: Expense): FormState {
  const itemizedInput: Record<string, string> = {}
  if (expense.splitMode === 'itemized') {
    for (const split of expense.splits) {
      if (!split) continue
      if (expense.itemizedInputMode === 'total') {
        itemizedInput[split.personId] = split.amount != null ? String(split.amount) : ''
      } else {
        itemizedInput[split.personId] = split.baseAmount != null ? String(split.baseAmount) : ''
      }
    }
  }
  const firstSplit = expense.splits[0]
  return {
    expenseType: expense.type ?? 'expense',
    category: normalizeCategory(expense.category),
    description: expense.description || '',
    payerIds: expense.payerIds?.length ? expense.payerIds : [],
    amount: expense.amount != null ? String(expense.amount) : '',
    paidCurrency: expense.paidCurrency || 'JPY',
    repayCurrency: expense.repayCurrency || firstSplit?.repayCurrency || 'MYR',
    paymentMethod: expense.paymentMethod || 'card',
    splitMode: expense.splitMode || 'equal',
    splitPersonIds: expense.splits.map((split) => split.personId).filter(Boolean),
    itemizedInputMode: expense.itemizedInputMode || 'pretax',
    itemizedInput,
    percentageInput: expense.splitMode === 'percentage' && expense.amount > 0
      ? Object.fromEntries(
          expense.splits.map((s) => [
            s.personId,
            s.amount != null ? formatMoney((s.amount / expense.amount) * 100, 2) : '0',
          ]),
        )
      : {},
    sharesInput: {},
    adjustmentInput: {},
    serviceTaxPct: expense.serviceTaxPct != null ? String(expense.serviceTaxPct) : '',
    salesTaxPct: expense.salesTaxPct != null ? String(expense.salesTaxPct) : '',
    tipsPct: expense.tipsPct != null ? String(expense.tipsPct) : '',
    rateMode: firstSplit?.rateSource === 'manual' ? 'manual' : 'auto',
    manualRate: firstSplit?.rateSource === 'manual' && firstSplit.rate != null ? String(firstSplit.rate) : '',
    date: expense.date || todayISO(),
  }
}

export default function ExpenseForm({
  group,
  initialExpense = null,
  submitLabel = 'Save Expense',
  title = 'Add Expense',
  showModeBadge = true,
  onSave,
  onCancel,
  onRemove,
}: Props) {
  const t = useT()
  const [form, setForm] = useState<FormState>(() => (initialExpense ? expenseToForm(initialExpense) : blankForm(group)))
  const [rateInfo, setRateInfo] = useState<RateResult | null>(null)
  const [error, setError] = useState('')
  // tracks whether the current category was set by auto-detection
  const [autoCatActive, setAutoCatActive] = useState(false)

  useEffect(() => {
    if (initialExpense) {
      setForm(expenseToForm(initialExpense))
    } else {
      setForm(blankForm(group))
    }
    setRateInfo(null)
    setError('')
    setAutoCatActive(false)
  }, [group, initialExpense])

  // Auto-detect category from description as the user types
  useEffect(() => {
    if (initialExpense) return // don't override when editing
    const detected = detectCategory(form.description)
    if (detected) {
      setForm((prev) => ({ ...prev, category: detected }))
      setAutoCatActive(true)
    } else {
      setAutoCatActive(false)
    }
  }, [form.description, initialExpense])

  const totalTaxPct = useMemo(
    () => Number(form.serviceTaxPct || '0') + Number(form.salesTaxPct || '0') + Number(form.tipsPct || '0'),
    [form.serviceTaxPct, form.salesTaxPct, form.tipsPct],
  )

  const effectiveRate = useMemo(() => {
    if (form.paidCurrency === form.repayCurrency) return 1
    if (form.rateMode === 'manual') {
      const value = Number(form.manualRate)
      return Number.isFinite(value) && value > 0 ? value : null
    }
    return rateInfo?.rate ?? null
  }, [form.manualRate, form.paidCurrency, form.rateMode, form.repayCurrency, rateInfo])

  // ── Refund type toggle handler ──────────────────────────────────────────
  const switchExpenseType = (newType: ExpenseType) => {
    if (newType === form.expenseType) return
    if (newType === 'refund') {
      // Current payer(s) become who pays back; everyone else becomes recipients
      const payerBackIds = form.payerIds.length > 0 ? form.payerIds : group.people[0] ? [group.people[0].id] : []
      const recipientIds = group.people.filter((p) => !payerBackIds.includes(p.id)).map((p) => p.id)
      setForm((prev) => ({
        ...prev,
        expenseType: 'refund',
        category: 'Refund',
        payerIds: recipientIds.length > 0 ? recipientIds : group.people.map((p) => p.id),
        splitPersonIds: payerBackIds,
        splitMode: 'equal',
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        expenseType: 'expense',
        category: 'Other',
        payerIds: prev.splitPersonIds.length > 0 ? [prev.splitPersonIds[0]] : group.people[0] ? [group.people[0].id] : [],
        splitPersonIds: group.people.map((p) => p.id),
      }))
    }
  }

  // ── Refund summary line ──────────────────────────────────────────────────
  const refundSummary = useMemo(() => {
    if (form.expenseType !== 'refund') return null
    const amount = Number(form.amount)
    if (!amount || form.payerIds.length === 0 || form.splitPersonIds.length === 0) return null
    const symbol = getCurrencySymbol(form.paidCurrency)
    const perRecipient = amount / form.payerIds.length
    const recipients = form.payerIds
      .map((id) => group.people.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[]
    const payers = form.splitPersonIds
      .map((id) => group.people.find((p) => p.id === id)?.name)
      .filter(Boolean) as string[]

    const recipientStr =
      recipients.length === 1
        ? recipients[0]
        : recipients.length === 2
          ? `${recipients[0]} & ${recipients[1]}`
          : `${recipients.slice(0, -1).join(', ')} & ${recipients[recipients.length - 1]}`

    const payerStr = payers.join(', ')
    return `${payerStr} pays ${symbol}${formatMoney(perRecipient)} each to ${recipientStr}`
  }, [form.expenseType, form.amount, form.payerIds, form.splitPersonIds, form.paidCurrency, group.people])

  const itemizedSummary = useMemo(() => {
    if (form.splitMode !== 'itemized') return null
    const expenseAmount = Number(form.amount)
    const taxFactor = totalTaxPct / 100
    const hasExpenseAmount = Number.isFinite(expenseAmount) && expenseAmount > 0

    let enteredPreTaxSum = 0
    let enteredTaxIncSum = 0
    let filledCount = 0

    for (const personId of form.splitPersonIds) {
      const raw = form.itemizedInput[personId]
      if (raw == null || raw === '') continue
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) continue
      filledCount += 1
      if (form.itemizedInputMode === 'total') {
        enteredTaxIncSum += value
        enteredPreTaxSum += value / (1 + taxFactor)
      } else {
        enteredPreTaxSum += value
        enteredTaxIncSum += value * (1 + taxFactor)
      }
    }

    const preTaxBudget = hasExpenseAmount && taxFactor > 0
      ? Number((expenseAmount / (1 + taxFactor)).toFixed(2))
      : hasExpenseAmount ? expenseAmount : null

    const isPretaxMode = form.itemizedInputMode === 'pretax'
    const displayTotal = isPretaxMode
      ? Number(enteredPreTaxSum.toFixed(2))
      : Number(enteredTaxIncSum.toFixed(2))
    const compareTarget = isPretaxMode ? preTaxBudget : (hasExpenseAmount ? expenseAmount : null)
    const diff = compareTarget != null ? Number((compareTarget - displayTotal).toFixed(2)) : null

    return {
      enteredTotal: displayTotal,
      enteredTaxIncTotal: Number(enteredTaxIncSum.toFixed(2)),
      filledCount,
      diff,
      hasExpenseAmount,
      preTaxBudget,
      isPretaxMode,
    }
  }, [
    form.amount,
    form.itemizedInput,
    form.itemizedInputMode,
    form.splitMode,
    form.splitPersonIds,
    totalTaxPct,
  ])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = () => {
    setError('')
    const activeSplitPersonIds = getActiveSplitPersonIds(form)
    if (group.people.length === 0) {
      setError(t('error.addTravellers'))
      return
    }
    if (!form.description.trim()) {
      setError(t('error.enterDescription'))
      return
    }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t('error.validAmount'))
      return
    }
    if (form.payerIds.length === 0) {
      setError(form.expenseType === 'refund' ? t('error.selectPayer') : t('error.selectPayer'))
      return
    }
    if (form.splitPersonIds.length === 0) {
      setError(t('error.selectSplit'))
      return
    }
    if (activeSplitPersonIds.length === 0) {
      setError(t('error.selectSplit'))
      return
    }
    // Rate validation skipped — rate UI is hidden; rate will be set in Settle Up later
    if (
      form.expenseType !== 'refund' &&
      form.splitMode === 'itemized' &&
      itemizedSummary?.hasExpenseAmount &&
      itemizedSummary.diff != null &&
      Math.abs(itemizedSummary.diff) > 0.5
    ) {
      const delta = `${getCurrencySymbol(form.paidCurrency)}${formatMoney(Math.abs(itemizedSummary.diff))}`
      const modeLine =
        itemizedSummary.diff > 0 ? t('error.itemizedRemaining') : t('error.itemizedExceeding')
      const warning = `${t('error.cannotSave')}\n\n${modeLine} ${delta} ${t('error.tallyNote')}`
      window.alert(warning)
      setError(`${modeLine} ${delta}. ${t('error.itemizedTally')}`)
      return
    }

    if (form.splitMode === 'percentage') {
      const totalPct = form.splitPersonIds.reduce(
        (s, pid) => s + Number(form.percentageInput[pid] || 0),
        0,
      )
      if (Math.abs(totalPct - 100) > 0.5) {
        setError(`Percentages must add up to 100% (currently ${formatMoney(totalPct, 1)}%).`)
        return
      }
    }

    if (form.splitMode === 'shares') {
      const totalShares = form.splitPersonIds.reduce(
        (s, pid) => s + Math.max(0, Number(form.sharesInput[pid] || 0)),
        0,
      )
      if (totalShares <= 0) {
        setError('Enter at least one share to split.')
        return
      }
    }

    const commonArgs = {
      repayCurrency: form.repayCurrency,
      rate: effectiveRate,
      rateSource: form.rateMode === 'manual' ? 'manual' : rateInfo?.source ?? null,
      rateDate: form.rateMode === 'manual' ? form.date : rateInfo?.date ?? null,
    }

    let splits
    // Refund always uses simple equal split among "paid back by" people
    if (form.expenseType === 'refund') {
      splits = calcEqualSplits({ peopleIds: form.splitPersonIds, totalAmount: amount, ...commonArgs })
    } else if (form.splitMode === 'itemized') {
      const payerMissingValue = form.payerIds.some((pid) => !assertPayerHasItemizedValue(pid, form.itemizedInput))
      if (payerMissingValue) {
        setError(t('error.itemizedPayer'))
        return
      }
      splits = calcItemizedSplits({
        peopleIds: activeSplitPersonIds,
        itemizedInput: form.itemizedInput,
        itemizedInputMode: form.itemizedInputMode,
        serviceTaxPct: Number(form.serviceTaxPct || '0'),
        salesTaxPct: Number(form.salesTaxPct || '0'),
        tipsPct: Number(form.tipsPct || '0'),
        ...commonArgs,
      })
    } else if (form.splitMode === 'percentage') {
      splits = calcPercentageSplits({
        peopleIds: activeSplitPersonIds,
        percentageInput: form.percentageInput,
        totalAmount: amount,
        ...commonArgs,
      })
    } else if (form.splitMode === 'shares') {
      splits = calcSharesSplits({
        peopleIds: activeSplitPersonIds,
        sharesInput: form.sharesInput,
        totalAmount: amount,
        ...commonArgs,
      })
    } else if (form.splitMode === 'adjustment') {
      splits = calcAdjustmentSplits({
        peopleIds: activeSplitPersonIds,
        adjustmentInput: form.adjustmentInput,
        totalAmount: amount,
        ...commonArgs,
      })
    } else {
      splits = calcEqualSplits({
        peopleIds: form.splitPersonIds,
        totalAmount: amount,
        ...commonArgs,
      })
    }

    onSave({
      type: form.expenseType,
      category: form.expenseType === 'refund' ? 'Refund' : normalizeCategory(form.category),
      description: form.description.trim(),
      payerIds: form.payerIds,
      amount,
      paidCurrency: form.paidCurrency,
      repayCurrency: form.repayCurrency,
      paymentMethod: form.paymentMethod,
      splitMode: form.expenseType === 'refund' ? 'equal' : form.splitMode,
      itemizedInputMode: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? form.itemizedInputMode : null,
      serviceTaxPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.serviceTaxPct || '0') : null,
      salesTaxPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.salesTaxPct || '0') : null,
      tipsPct: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? Number(form.tipsPct || '0') : null,
      taxPctTotal: form.splitMode === 'itemized' && form.expenseType !== 'refund' ? totalTaxPct : null,
      date: form.date,
      splits,
    })

    setForm(blankForm(group))
    setRateInfo(null)
    setError('')
  }

  const isRefund = form.expenseType === 'refund'

  return (
    <section className={`ms-card-soft ${isRefund ? 'border-[rgba(30,90,90,0.25)] bg-[rgba(30,90,90,0.03)]' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="ms-title">
          {isRefund
            ? (initialExpense ? t('expense.editRefundTitle') : t('expense.addRefundTitle'))
            : title}
        </h2>
        {onRemove ? (
          <button className="ms-btn-ghost border-[#c49898] text-[#9e4a4a]" onClick={onRemove}>
            {t('expense.remove')}
          </button>
        ) : showModeBadge ? (
          <span className="rounded-full bg-[rgba(139,110,78,0.08)] px-2 py-1 text-[11px] font-medium text-[#74593c]">
            {t('expense.mobileQuick')}
          </span>
        ) : null}
      </div>

      {/* ── Expense / Refund toggle ──────────────────────────────────── */}
      <div className="mb-4 flex overflow-hidden rounded-xl border border-[#d8d0c4]">
        <button
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${
            !isRefund ? 'bg-[#8b6e4e] text-white' : 'text-[#6b6058] hover:bg-[rgba(139,110,78,0.06)]'
          }`}
          onClick={() => switchExpenseType('expense')}
        >
          💸 {t('expense.typeExpense')}
        </button>
        <button
          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors ${
            isRefund ? 'bg-[#2e6060] text-white' : 'text-[#6b6058] hover:bg-[rgba(30,90,90,0.06)]'
          }`}
          onClick={() => switchExpenseType('refund')}
        >
          ↩ {t('expense.typeRefund')}
        </button>
      </div>

      <div className="flex flex-col gap-4">

        {/* ── Description (full width) ────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
            {t('expense.description')}
          </label>
          <input
            className="ms-input w-full"
            placeholder={isRefund ? 'e.g. Airbnb rebate, overpayment refund...' : 'e.g. Team dinner, taxi, Lawson...'}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            autoFocus
          />
        </div>

        {/* ── Amount + Currency (side by side) ────────────────────────── */}
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
              {isRefund ? t('expense.totalRefundAmt') : t('expense.amount')}
            </label>
            <input
              className="ms-input w-full"
              placeholder="0.00"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setField('amount', e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
              {t('expense.currency')}
            </label>
            <select
              className="ms-input w-full"
              value={form.paidCurrency}
              onChange={(e) => {
                setField('paidCurrency', e.target.value)
                setRateInfo(null)
              }}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Category — hidden for refunds (auto-set to Refund) ─────── */}
        {!isRefund && (
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
                {t('expense.category')}
              </label>
              {autoCatActive && (
                <span className="rounded bg-[rgba(139,110,78,0.12)] px-1.5 py-0.5 text-[10px] font-medium text-[#74593c]">
                  ✦ auto
                </span>
              )}
            </div>
            <select
              className="ms-input w-full"
              value={form.category}
              onChange={(e) => {
                setField('category', e.target.value)
                setAutoCatActive(false)
              }}
            >
              {SELECTABLE_EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {tCategory(category)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── REFUND MODE: Refunded to + Paid back by ─────────────────── */}
        {isRefund ? (
          <>
            {/* Recipients — who gets money back (payerIds) */}
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#2e6060]">
                  ↩ {t('expense.refundedTo')}
                </label>
                <span className="text-[10px] text-[#6b9090]">{t('expense.refundedToHint')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.people.map((person) => {
                  const active = form.payerIds.includes(person.id)
                  return (
                    <button
                      key={person.id}
                      className={`ms-chip transition-colors ${
                        active
                          ? 'border-[rgba(30,90,90,0.6)] bg-[rgba(30,90,90,0.12)] text-[#1e5a5a]'
                          : 'border-[#d8d0c4] text-[#6b6058]'
                      }`}
                      onClick={() =>
                        setForm((prev) => {
                          const has = prev.payerIds.includes(person.id)
                          return {
                            ...prev,
                            payerIds: has
                              ? prev.payerIds.filter((id) => id !== person.id)
                              : [...prev.payerIds, person.id],
                          }
                        })
                      }
                    >
                      {active ? '✓ ' : ''}{person.name}
                    </button>
                  )
                })}
              </div>
              {form.payerIds.length > 0 && Number(form.amount) > 0 && (
                <p className="mt-1.5 text-xs text-[#4a8080]">
                  {getCurrencySymbol(form.paidCurrency)}{formatMoney(Number(form.amount) / form.payerIds.length)}{' '}
                  {t('expense.refundEqualHint')}
                </p>
              )}
            </div>

            {/* Payers — who sends the refund back (splitPersonIds) */}
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
                  ↑ {t('expense.paidBackBy')}
                </label>
                <span className="text-[10px] text-[#9a9088]">{t('expense.paidBackByHint')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.people.map((person) => {
                  const active = form.splitPersonIds.includes(person.id)
                  return (
                    <button
                      key={person.id}
                      className={`ms-chip transition-colors ${
                        active ? 'ms-chip-active-indigo' : 'border-[#d8d0c4] text-[#6b6058]'
                      }`}
                      onClick={() =>
                        setForm((prev) => {
                          const has = prev.splitPersonIds.includes(person.id)
                          return {
                            ...prev,
                            splitPersonIds: has
                              ? prev.splitPersonIds.filter((id) => id !== person.id)
                              : [...prev.splitPersonIds, person.id],
                          }
                        })
                      }
                    >
                      {active ? '✓ ' : ''}{person.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Summary line */}
            <div className="rounded-xl border border-[rgba(30,90,90,0.20)] bg-[rgba(30,90,90,0.06)] px-4 py-3">
              <p className="text-sm font-medium text-[#1e5a5a]">
                {refundSummary ?? t('expense.refundSummaryNone')}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* ── EXPENSE MODE: Paid by ─────────────────────────────────── */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
                {t('expense.paidBy')}
              </label>
              <div className="flex flex-wrap gap-2">
                {group.people.map((person) => {
                  const active = form.payerIds.includes(person.id)
                  return (
                    <button
                      key={person.id}
                      className={`ms-chip ${active ? 'ms-chip-active-indigo' : 'border-[#d8d0c4] text-[#6b6058]'}`}
                      onClick={() => {
                        setForm((prev) => {
                          const has = prev.payerIds.includes(person.id)
                          return {
                            ...prev,
                            payerIds: has
                              ? prev.payerIds.filter((id) => id !== person.id)
                              : [...prev.payerIds, person.id],
                          }
                        })
                      }}
                      style={getPersonNameStyle(person)}
                    >
                      {active ? '✓ ' : ''}{person.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Split ─────────────────────────────────────────────────── */}
            <SplitExpander
              state={{
                splitMode: form.splitMode,
                splitPersonIds: form.splitPersonIds,
                itemizedInput: form.itemizedInput,
                itemizedInputMode: form.itemizedInputMode,
                percentageInput: form.percentageInput,
                sharesInput: form.sharesInput,
                adjustmentInput: form.adjustmentInput,
                serviceTaxPct: form.serviceTaxPct,
                salesTaxPct: form.salesTaxPct,
                tipsPct: form.tipsPct,
              }}
              onChange={(next) =>
                setForm((prev) => ({
                  ...prev,
                  splitMode: next.splitMode,
                  splitPersonIds: next.splitPersonIds,
                  itemizedInput: next.itemizedInput,
                  itemizedInputMode: next.itemizedInputMode,
                  percentageInput: next.percentageInput,
                  sharesInput: next.sharesInput,
                  adjustmentInput: next.adjustmentInput,
                  serviceTaxPct: next.serviceTaxPct,
                  salesTaxPct: next.salesTaxPct,
                  tipsPct: next.tipsPct,
                }))
              }
              group={group}
              totalAmount={Number(form.amount) || 0}
              paidCurrency={form.paidCurrency}
            />
          </>
        )}

        {/* ── Date ────────────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
            {t('expense.date')}
          </label>
          <input
            type="date"
            className="ms-input w-full"
            value={form.date}
            onChange={(e) => setField('date', e.target.value)}
          />
          {(() => {
            const today = todayISO()
            const inTrip =
              group.startDate && group.endDate
                ? form.date >= group.startDate && form.date <= group.endDate
                : false
            const isFuture = form.date > today
            const hasTrip = group.startDate && group.endDate
            if (!form.date) return null
            return (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {hasTrip ? (
                  <span className={inTrip ? 'font-medium text-[#4a6a4a]' : 'text-[#9a9088]'}>
                    {inTrip ? `● ${t('expense.withinTrip')}` : `○ ${t('expense.outsideTrip')}`}
                    <span className="ml-1 text-[#9a9088]">({group.startDate} — {group.endDate})</span>
                  </span>
                ) : null}
                {isFuture ? (
                  <span className="text-[#c49898]">{t('expense.futureDate')}</span>
                ) : null}
              </div>
            )
          })()}
        </div>

        {error ? <p className="text-sm text-[#9e4a4a]">{error}</p> : null}

        {/* ── Action buttons ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className={`h-11 rounded-xl font-semibold text-white transition-colors ${
              isRefund ? 'bg-[#2e6060] hover:bg-[#245050]' : 'ms-btn-primary'
            }`}
            onClick={submit}
          >
            {isRefund ? t('expense.saveRefund') : submitLabel}
          </button>
          {onCancel ? (
            <button className="ms-btn-ghost h-11" onClick={onCancel}>
              {t('expense.cancel')}
            </button>
          ) : null}
        </div>
      </div>

    </section>
  )
}
