import { useEffect, useMemo, useState } from 'react'
import { CURRENCIES, fetchRate, getCurrencySymbol, type RateResult } from '../lib/currency'
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
import type { Expense, Group, ItemizedInputMode, PaymentMethod, RateMode, SplitMode } from '../types'
import { EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import { useT, tCategory } from '../lib/i18n'
import SplitExpander from './SplitExpander'
import type { SplitSheetState } from './AdjustSplitSheet'

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

function blankForm(group: Group): FormState {
  const today = todayISO()
  const initialDate = today
  return {
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
    date: initialDate,
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
  const [rateError, setRateError] = useState('')
  const [fetchAttempts, setFetchAttempts] = useState(0)
  const [error, setError] = useState('')
  const [loadingRate, setLoadingRate] = useState(false)
  // tracks whether the current category was set by auto-detection
  const [autoCatActive, setAutoCatActive] = useState(false)

  useEffect(() => {
    if (initialExpense) {
      setForm(expenseToForm(initialExpense))
    } else {
      setForm(blankForm(group))
    }
    setRateInfo(null)
    setRateError('')
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

  const perPersonPreview = useMemo(() => {
    const amount = Number(form.amount)
    const n = form.splitPersonIds.length
    const paidSym = getCurrencySymbol(form.paidCurrency)
    const repaySym = getCurrencySymbol(form.repayCurrency)
    if (!Number.isFinite(amount) || amount <= 0 || n === 0) return ''
    if (form.splitMode === 'equal') {
      const each = amount / n
      const converted = effectiveRate ? each * effectiveRate : null
      return converted
        ? `${paidSym}${formatMoney(each)} ${t('expense.each')} (≈ ${repaySym}${formatMoney(converted)})`
        : `${paidSym}${formatMoney(each)} ${t('expense.each')}`
    }
    if (form.splitMode === 'percentage') {
      const total = form.splitPersonIds.reduce((s, pid) => s + Number(form.percentageInput[pid] || 0), 0)
      return `${formatMoney(total, 1)}% of 100% — ${n} people`
    }
    if (form.splitMode === 'shares') {
      const totalShares = form.splitPersonIds.reduce((s, pid) => s + Math.max(0, Number(form.sharesInput[pid] || 0)), 0)
      return totalShares > 0 ? `${formatMoney(totalShares, 0)} total shares — ${n} people` : `${n} people`
    }
    if (form.splitMode === 'adjustment') {
      return `Equal base + adjustments — ${n} people`
    }
    if (form.splitMode === 'itemized') {
      return `Itemized split — ${n} people`
    }
    return ''
  }, [effectiveRate, form.amount, form.paidCurrency, form.repayCurrency, form.splitMode, form.splitPersonIds, form.percentageInput, form.sharesInput, t])

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

  const onFetchRate = async () => {
    setRateError('')

    if (!form.date) {
      setRateError(t('error.selectDate'))
      return
    }

    if (form.paidCurrency === form.repayCurrency) {
      setRateInfo({ rate: 1, source: 'same', date: form.date })
      setFetchAttempts(0)
      return
    }

    const today = todayISO()
    if (form.date > today) {
      setRateError(t('error.futureRate'))
      return
    }

    setLoadingRate(true)
    const result = await fetchRate(form.paidCurrency, form.repayCurrency, form.date)
    setLoadingRate(false)

    if (!result) {
      const next = fetchAttempts + 1
      setFetchAttempts(next)
      if (next >= 4) {
        setRateError(t('error.fetchFailedFinal'))
      } else {
        setRateError(`${t('error.fetchFailed')} (${next}/4). ${t('error.tryAgain')}`)
      }
      return
    }

    setFetchAttempts(0)
    setRateInfo(result)
  }

  const submit = () => {
    setError('')
    setRateError('')
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
      setError(t('error.selectPayer'))
      return
    }
    if (form.splitPersonIds.length === 0) {
      setError(t('error.selectSplit'))
      return
    }
    // Rate validation skipped — rate UI is hidden; rate will be set in Settle Up later
    if (
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
    if (form.splitMode === 'itemized') {
      const payerMissingValue = form.payerIds.some((pid) => !assertPayerHasItemizedValue(pid, form.itemizedInput))
      if (payerMissingValue) {
        setError(t('error.itemizedPayer'))
        return
      }
      splits = calcItemizedSplits({
        peopleIds: form.splitPersonIds,
        itemizedInput: form.itemizedInput,
        itemizedInputMode: form.itemizedInputMode,
        serviceTaxPct: Number(form.serviceTaxPct || '0'),
        salesTaxPct: Number(form.salesTaxPct || '0'),
        tipsPct: Number(form.tipsPct || '0'),
        ...commonArgs,
      })
    } else if (form.splitMode === 'percentage') {
      splits = calcPercentageSplits({
        peopleIds: form.splitPersonIds,
        percentageInput: form.percentageInput,
        totalAmount: amount,
        ...commonArgs,
      })
    } else if (form.splitMode === 'shares') {
      splits = calcSharesSplits({
        peopleIds: form.splitPersonIds,
        sharesInput: form.sharesInput,
        totalAmount: amount,
        ...commonArgs,
      })
    } else if (form.splitMode === 'adjustment') {
      splits = calcAdjustmentSplits({
        peopleIds: form.splitPersonIds,
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
      category: normalizeCategory(form.category),
      description: form.description.trim(),
      payerIds: form.payerIds,
      amount,
      paidCurrency: form.paidCurrency,
      repayCurrency: form.repayCurrency,
      paymentMethod: form.paymentMethod,
      splitMode: form.splitMode,
      itemizedInputMode: form.splitMode === 'itemized' ? form.itemizedInputMode : null,
      serviceTaxPct: form.splitMode === 'itemized' ? Number(form.serviceTaxPct || '0') : null,
      salesTaxPct: form.splitMode === 'itemized' ? Number(form.salesTaxPct || '0') : null,
      tipsPct: form.splitMode === 'itemized' ? Number(form.tipsPct || '0') : null,
      taxPctTotal: form.splitMode === 'itemized' ? totalTaxPct : null,
      date: form.date,
      splits,
    })

    setForm(blankForm(group))
    setRateInfo(null)
    setRateError('')
    setError('')
  }

  return (
    <section className="ms-card-soft">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="ms-title">{title}</h2>
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

      <div className="flex flex-col gap-4">

        {/* ── Description (full width) ────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
            {t('expense.description')}
          </label>
          <input
            className="ms-input w-full"
            placeholder="e.g. Team dinner, taxi, Lawson..."
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            autoFocus
          />
        </div>

        {/* ── Amount + Currency (side by side) ────────────────────────── */}
        <div className="grid grid-cols-[1fr_100px] gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#6b6058]">
              {t('expense.amount')}
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

        {/* ── Category (auto-detected from description) ──────────────── */}
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
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {tCategory(category)}
              </option>
            ))}
          </select>
        </div>

        {/* ── Paid by ─────────────────────────────────────────────────── */}
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
                className={`ms-chip ${
                  active ? 'ms-chip-active-indigo' : 'border-[#d8d0c4] text-[#6b6058]'
                }`}
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
          {active ? '✓ ' : ''}
              {person.name}
            </button>
            )
          })}
          </div>
        </div>

        {/* ── Split ───────────────────────────────────────────────────── */}
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
          <button className="ms-btn-primary h-11" onClick={submit}>
            {submitLabel}
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
