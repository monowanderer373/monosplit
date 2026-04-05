import { useEffect, useMemo, useState } from 'react'
import { CURRENCIES, fetchRate, getCurrencySymbol, type RateResult } from '../lib/currency'
import { calcEqualSplits, calcItemizedSplits, assertPayerHasItemizedValue } from '../lib/splitCalc'
import { formatMoney, todayISO } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import type { Expense, Group, ItemizedInputMode, PaymentMethod, RateMode, SplitMode } from '../types'
import { EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'

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
  serviceTaxPct: string
  salesTaxPct: string
  tipsPct: string
  rateMode: RateMode
  manualRate: string
  date: string
}

function blankForm(group: Group): FormState {
  const today = todayISO()
  let initialDate = group.startDate || today
  if (group.endDate && initialDate > group.endDate) initialDate = group.endDate
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
  const [form, setForm] = useState<FormState>(() => (initialExpense ? expenseToForm(initialExpense) : blankForm(group)))
  const [rateInfo, setRateInfo] = useState<RateResult | null>(null)
  const [rateError, setRateError] = useState('')
  const [fetchAttempts, setFetchAttempts] = useState(0)
  const [error, setError] = useState('')
  const [loadingRate, setLoadingRate] = useState(false)

  useEffect(() => {
    if (initialExpense) {
      setForm(expenseToForm(initialExpense))
    } else {
      setForm(blankForm(group))
    }
    setRateInfo(null)
    setRateError('')
    setError('')
  }, [group, initialExpense])

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
    if (!Number.isFinite(amount) || amount <= 0 || form.splitPersonIds.length === 0) return ''
    if (form.splitMode === 'equal') {
      const each = amount / form.splitPersonIds.length
      const converted = effectiveRate ? each * effectiveRate : null
      const paidSym = getCurrencySymbol(form.paidCurrency)
      const repaySym = getCurrencySymbol(form.repayCurrency)
      return converted
        ? `${paidSym}${formatMoney(each)} each (≈ ${repaySym}${formatMoney(converted)})`
        : `${paidSym}${formatMoney(each)} each`
    }
    return ''
  }, [effectiveRate, form.amount, form.paidCurrency, form.repayCurrency, form.splitMode, form.splitPersonIds.length])

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

  const toggleSplitPerson = (personId: string) => {
    setForm((prev) => {
      const has = prev.splitPersonIds.includes(personId)
      return {
        ...prev,
        splitPersonIds: has ? prev.splitPersonIds.filter((id) => id !== personId) : [...prev.splitPersonIds, personId],
      }
    })
  }

  const onFetchRate = async () => {
    setRateError('')

    if (!form.date) {
      setRateError('Please select a date first before fetching the rate.')
      return
    }

    if (form.paidCurrency === form.repayCurrency) {
      setRateInfo({ rate: 1, source: 'same', date: form.date })
      setFetchAttempts(0)
      return
    }

    const today = todayISO()
    if (form.date > today) {
      setRateError(`Cannot fetch future rate (${form.date}). Rates are only available up to today (${today}).`)
      return
    }

    setLoadingRate(true)
    const result = await fetchRate(form.paidCurrency, form.repayCurrency, form.date)
    setLoadingRate(false)

    if (!result) {
      const next = fetchAttempts + 1
      setFetchAttempts(next)
      if (next >= 4) {
        setRateError('Failed after multiple attempts. Please switch to manual rate and enter the rate yourself.')
      } else {
        setRateError(`Failed to fetch rate (attempt ${next}/4). Try again or use manual rate.`)
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
      setError('Please add travellers first.')
      return
    }
    if (!form.description.trim()) {
      setError('Please enter description.')
      return
    }
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    if (form.payerIds.length === 0) {
      setError('Please select who paid.')
      return
    }
    if (form.splitPersonIds.length === 0) {
      setError('Please select at least one split person.')
      return
    }
    if (form.rateMode === 'manual' && (effectiveRate == null || effectiveRate <= 0)) {
      setError('Please enter a valid manual rate.')
      return
    }
    if (form.rateMode === 'auto' && form.paidCurrency !== form.repayCurrency && effectiveRate == null) {
      setError('Please fetch rate or switch to manual mode.')
      return
    }
    if (
      form.splitMode === 'itemized' &&
      itemizedSummary?.hasExpenseAmount &&
      itemizedSummary.diff != null &&
      Math.abs(itemizedSummary.diff) > 0.5
    ) {
      const delta = `${getCurrencySymbol(form.paidCurrency)}${formatMoney(Math.abs(itemizedSummary.diff))}`
      const modeLabel = itemizedSummary.diff > 0 ? 'remaining' : 'exceeding'
      const warning = `Cannot save expense.\n\nItemized amounts are still ${modeLabel} by ${delta}, so they do not tally with the total amount.`
      window.alert(warning)
      setError(`Itemized amounts are ${modeLabel} by ${delta}. Please make totals tally before saving.`)
      return
    }

    let splits
    if (form.splitMode === 'itemized') {
      const payerMissingValue = form.payerIds.some((pid) => !assertPayerHasItemizedValue(pid, form.itemizedInput))
      if (payerMissingValue) {
        setError('In itemized mode, all payers must have a value.')
        return
      }
      splits = calcItemizedSplits({
        peopleIds: form.splitPersonIds,
        itemizedInput: form.itemizedInput,
        itemizedInputMode: form.itemizedInputMode,
        serviceTaxPct: Number(form.serviceTaxPct || '0'),
        salesTaxPct: Number(form.salesTaxPct || '0'),
        tipsPct: Number(form.tipsPct || '0'),
        repayCurrency: form.repayCurrency,
        rate: effectiveRate,
        rateSource: form.rateMode === 'manual' ? 'manual' : rateInfo?.source ?? null,
        rateDate: form.rateMode === 'manual' ? form.date : rateInfo?.date ?? null,
      })
    } else {
      splits = calcEqualSplits({
        peopleIds: form.splitPersonIds,
        totalAmount: amount,
        repayCurrency: form.repayCurrency,
        rate: effectiveRate,
        rateSource: form.rateMode === 'manual' ? 'manual' : rateInfo?.source ?? null,
        rateDate: form.rateMode === 'manual' ? form.date : rateInfo?.date ?? null,
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
            Remove Expense
          </button>
        ) : showModeBadge ? (
          <span className="rounded-full bg-[rgba(139,110,78,0.08)] px-2 py-1 text-[11px] font-medium text-[#74593c]">
            Mobile quick mode
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] lg:col-span-2">
          <select className="ms-input" value={form.category} onChange={(e) => setField('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input className="ms-input" placeholder="Description" value={form.description} onChange={(e) => setField('description', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
          <input
            className="ms-input"
            placeholder="Amount"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setField('amount', e.target.value)}
          />
          <select
            className="ms-input"
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

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <select
            className="ms-input"
            value={form.repayCurrency}
            onChange={(e) => {
              setField('repayCurrency', e.target.value)
              setRateInfo(null)
            }}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                Repay: {currency.code}
              </option>
            ))}
          </select>
          <button
            className="ms-btn-ghost h-10 px-3 text-xs font-medium text-[#3a3330]"
            onClick={onFetchRate}
            disabled={loadingRate}
          >
            {loadingRate ? 'Loading...' : 'Fetch rate'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            className="ms-input"
            value={form.rateMode}
            onChange={(e) => setField('rateMode', e.target.value as RateMode)}
          >
            <option value="auto">Auto rate</option>
            <option value="manual">Manual rate</option>
          </select>
          <input
            className="ms-input"
            placeholder="Manual rate"
            inputMode="decimal"
            disabled={form.rateMode !== 'manual'}
            value={form.manualRate}
            onChange={(e) => setField('manualRate', e.target.value)}
          />
        </div>

        {effectiveRate != null ? (
          <p className="rounded-xl bg-[rgba(90,122,90,0.06)] px-3 py-2 text-xs text-[#4a6a4a]">
            1 {form.paidCurrency} = {formatMoney(effectiveRate, 6)} {form.repayCurrency}
            {rateInfo?.source && rateInfo.source !== 'same'
              ? ` — ${rateInfo.source}, rate from ${rateInfo.date}`
              : ''}
          </p>
        ) : null}

        {rateError ? <p className="text-xs text-[#9e4a4a]">{rateError}</p> : null}

        <label className="text-xs font-semibold uppercase text-[#6b6058] lg:col-span-2">Paid by</label>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
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

        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <button
            className={`h-10 rounded-xl border text-sm font-medium transition ${
              form.splitMode === 'equal' ? 'border-[#8b6e4e] bg-[rgba(139,110,78,0.08)] text-[#74593c]' : 'border-[#d8d0c4] text-[#6b6058]'
            }`}
            onClick={() => setField('splitMode', 'equal')}
          >
            Equal
          </button>
          <button
            className={`h-10 rounded-xl border text-sm font-medium ${
              form.splitMode === 'itemized'
                ? 'border-[#8b6e4e] bg-[rgba(139,110,78,0.08)] text-[#74593c]'
                : 'border-[#d8d0c4] text-[#6b6058]'
            }`}
            onClick={() => setField('splitMode', 'itemized')}
          >
            Itemized
          </button>
        </div>

        <div className="flex items-center justify-between lg:col-span-2">
          <label className="text-xs font-semibold uppercase text-[#6b6058]">Split between</label>
          <div className="flex items-center gap-2">
            <button
              className="text-xs text-[#8b6e4e]"
              onClick={() => setField('splitPersonIds', group.people.map((person) => person.id))}
            >
              Select all
            </button>
            <button className="text-xs text-[#6b6058]" onClick={() => setField('splitPersonIds', [])}>
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-2">
          {group.people.map((person) => {
            const active = form.splitPersonIds.includes(person.id)
            return (
              <button
                key={person.id}
                className={`ms-chip ${
                  active ? 'ms-chip-active-emerald' : 'border-[#d8d0c4] text-[#6b6058]'
                }`}
                onClick={() => toggleSplitPerson(person.id)}
                style={getPersonNameStyle(person)}
              >
                {active ? '✓ ' : ''}
                {person.name}
              </button>
            )
          })}
        </div>

        {form.splitMode === 'itemized' ? (
          <div className="rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3 lg:col-span-2">
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                className="h-9 rounded-lg border border-[#d8d0c4] px-2 text-sm outline-none focus:border-[#8b6e4e]"
                value={form.itemizedInputMode}
                onChange={(e) => setField('itemizedInputMode', e.target.value as ItemizedInputMode)}
              >
                <option value="pretax">Input pre-tax</option>
                <option value="total">Input total</option>
              </select>
              <input
                className="h-9 rounded-lg border border-[#d8d0c4] px-2 text-sm outline-none focus:border-[#8b6e4e]"
                placeholder="Service tax %"
                value={form.serviceTaxPct}
                onChange={(e) => setField('serviceTaxPct', e.target.value)}
              />
            </div>
            <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                className="h-9 rounded-lg border border-[#d8d0c4] px-2 text-sm outline-none focus:border-[#8b6e4e]"
                placeholder="Sales tax %"
                value={form.salesTaxPct}
                onChange={(e) => setField('salesTaxPct', e.target.value)}
              />
              <input
                className="h-9 rounded-lg border border-[#d8d0c4] px-2 text-sm outline-none focus:border-[#8b6e4e]"
                placeholder="Tips %"
                value={form.tipsPct}
                onChange={(e) => setField('tipsPct', e.target.value)}
              />
            </div>
            <p className="mb-2 text-xs text-[#6b6058]">Total tax: {formatMoney(totalTaxPct)}%</p>
            <div className="space-y-2">
              {form.splitPersonIds.map((pid) => {
                const person = group.people.find((p) => p.id === pid)
                if (!person) return null
                const rawVal = form.itemizedInput[pid]
                const numVal = rawVal != null && rawVal !== '' ? Number(rawVal) : null
                const taxFactor = totalTaxPct / 100
                const afterTaxVal = numVal != null && Number.isFinite(numVal) && numVal >= 0 && form.itemizedInputMode === 'pretax' && taxFactor > 0
                  ? numVal * (1 + taxFactor)
                  : null
                return (
                  <div key={pid} className="grid items-center gap-2" style={{ gridTemplateColumns: afterTaxVal != null ? '1fr 100px auto' : '1fr 100px' }}>
                    <span className="text-sm text-[#3a3330]" style={getPersonNameStyle(person)}>
                      {person.name}
                    </span>
                    <input
                      className="h-9 rounded-lg border border-[#d8d0c4] px-2 text-sm outline-none focus:border-[#8b6e4e]"
                      placeholder="0"
                      inputMode="decimal"
                      value={form.itemizedInput[pid] ?? ''}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          itemizedInput: { ...prev.itemizedInput, [pid]: e.target.value },
                        }))
                      }
                    />
                    {afterTaxVal != null ? (
                      <span className="whitespace-nowrap text-xs text-[#9a9088]">
                        → {getCurrencySymbol(form.paidCurrency)}{formatMoney(afterTaxVal)}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {itemizedSummary ? (
              <div className="mt-3 rounded-lg bg-[#faf8f4] px-3 py-2 text-xs text-[#6b6058]">
                <p>Filled: {itemizedSummary.filledCount} person(s)</p>
                {itemizedSummary.isPretaxMode && itemizedSummary.preTaxBudget != null ? (
                  <p>
                    Pre-tax budget: {getCurrencySymbol(form.paidCurrency)}
                    {formatMoney(itemizedSummary.preTaxBudget)}
                    <span className="text-[#9a9088]"> (from {getCurrencySymbol(form.paidCurrency)}{formatMoney(Number(form.amount))} incl. {formatMoney(totalTaxPct)}% tax)</span>
                  </p>
                ) : null}
                <p>
                  {itemizedSummary.isPretaxMode ? 'Pre-tax total' : 'Itemized total'}:{' '}
                  {getCurrencySymbol(form.paidCurrency)}
                  {formatMoney(itemizedSummary.enteredTotal)}
                </p>
                {itemizedSummary.isPretaxMode ? (
                  <p>
                    After-tax total: {getCurrencySymbol(form.paidCurrency)}
                    {formatMoney(itemizedSummary.enteredTaxIncTotal)}
                  </p>
                ) : null}
                {itemizedSummary.hasExpenseAmount && itemizedSummary.diff != null ? (
                  <p className={itemizedSummary.diff >= 0 ? 'text-[#4a6a4a]' : 'text-[#9e4a4a]'}>
                    {itemizedSummary.diff >= 0 ? 'Remaining' : 'Exceeds'}:{' '}
                    {getCurrencySymbol(form.paidCurrency)}
                    {formatMoney(Math.abs(itemizedSummary.diff))}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {form.splitMode === 'equal' && perPersonPreview ? (
          <p className="rounded-xl bg-[rgba(139,110,78,0.08)] px-3 py-2 text-sm text-[#74593c] lg:col-span-2">{perPersonPreview}</p>
        ) : null}

        <div className="lg:col-span-2">
          <input
            type="date"
            className="ms-input"
            value={form.date}
            min={group.startDate || undefined}
            max={group.endDate || undefined}
            onChange={(e) => setField('date', e.target.value)}
          />
        </div>

        {error ? <p className="text-sm text-[#9e4a4a] lg:col-span-2">{error}</p> : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:col-span-2">
          <button className="ms-btn-primary h-11" onClick={submit}>
            {submitLabel}
          </button>
          {onCancel ? (
            <button className="ms-btn-ghost h-11" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
