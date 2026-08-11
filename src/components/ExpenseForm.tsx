import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CURRENCIES, getCurrencySymbol, type RateResult } from '../lib/currency'
import { detectCategory } from '../lib/autoCategory'
import {
  compileExpense,
  computeReceiptSummary,
  type ExpenseCompileErrorKey,
  type FormState,
} from '../lib/compileExpense'
import { formatMoney, todayISO } from '../lib/format'
import { getPersonNameStyle } from '../lib/personTheme'
import { generateId } from '../lib/id'
import type { Expense, ExpenseType, Group, SplitMode } from '../types'
import { SELECTABLE_EXPENSE_CATEGORIES, normalizeCategory } from '../lib/categories'
import { useT, tCategory, type TranslationKey } from '../lib/i18n'
import SplitExpander from './SplitExpander'
import type { ReceiptItemInput } from './AdjustSplitSheet'


type Props = {
  group: Group
  initialExpense?: Expense | null
  submitLabel?: string
  title?: string
  showModeBadge?: boolean
  onSave: (expense: Omit<Expense, 'id' | 'createdAt'>) => void | Promise<void>
  onCancel?: () => void
  onRemove?: () => void
}

type ExpenseDraft = {
  version: 1
  form: FormState
  autoCatActive: boolean
}

const EXPENSE_ERROR_KEY_TO_I18N: Record<
  Exclude<ExpenseCompileErrorKey, 'itemized_mismatch' | 'percentage_mismatch'>,
  TranslationKey
> = {
  no_travellers: 'error.addTravellers',
  missing_description: 'error.enterDescription',
  invalid_amount: 'error.validAmount',
  missing_payer: 'error.selectPayer',
  missing_split: 'error.selectSplit',
  receipt_needs_item: 'error.receiptNeedItem',
  receipt_invalid_item: 'error.receiptInvalidItem',
  shares_all_zero: 'error.sharesAllZero',
  itemized_payer_missing_value: 'error.itemizedPayer',
}

function WizardCard({
  step,
  title,
  help,
  children,
}: {
  step: number
  title: string
  help: string
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4 shadow-[0_10px_24px_rgba(119,76,36,0.06)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ms-accent-bg)] text-sm font-black text-[var(--ms-accent)]">
          {step}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-black text-[var(--ms-text)]">{title}</h3>
          <p className="mt-0.5 text-xs text-[var(--ms-text-secondary)]">{help}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

const EXPENSE_DRAFT_STORAGE_PREFIX = 'ms_expense_draft:'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getExpenseDraftKey(groupId: string): string {
  return `${EXPENSE_DRAFT_STORAGE_PREFIX}${groupId}`
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function readIdList(value: unknown, validIds: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.filter((id): id is string => typeof id === 'string' && validIds.has(id))))
}

function readStringMap(value: unknown, validIds: Set<string>): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, entryValue]) => {
    if (validIds.has(key) && typeof entryValue === 'string') acc[key] = entryValue
    return acc
  }, {})
}

function blankReceiptItem(group: Group): ReceiptItemInput {
  return {
    id: generateId('receipt-item'),
    name: '',
    unitPrice: '',
    quantity: '1',
    debtorIds: group.people.length > 0 ? [group.people[0].id] : [],
  }
}

function sanitizeReceiptItemInputs(value: unknown, group: Group): ReceiptItemInput[] {
  if (!Array.isArray(value)) return []
  const validIds = new Set(group.people.map((person) => person.id))
  return value
    .filter(isRecord)
    .map((item, index) => {
      const debtorIds = readIdList(item.debtorIds, validIds)
      return {
        id: typeof item.id === 'string' && item.id ? item.id : generateId(`receipt-item-${index}`),
        name: typeof item.name === 'string' ? item.name : '',
        unitPrice: typeof item.unitPrice === 'string' ? item.unitPrice : '',
        quantity: typeof item.quantity === 'string' ? item.quantity : '',
        debtorIds: debtorIds.length > 0 ? debtorIds : [],
      }
    })
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
    receiptItems: [blankReceiptItem(group)],
    receiptTaxAmount: '',
    serviceTaxPct: '',
    salesTaxPct: '',
    tipsPct: '',
    rateMode: 'auto',
    manualRate: '',
    date: today,
  }
}

function hasMeaningfulDraft(form: FormState, group: Group): boolean {
  const base = blankForm(group)
  const hasEntries = (record: Record<string, string>) => Object.values(record).some((value) => value.trim() !== '')
  const hasReceiptEntries =
    form.receiptItems.length !== base.receiptItems.length ||
    form.receiptItems.some((item, index) => {
      const baseItem = base.receiptItems[index]
      return (
        item.name.trim() !== '' ||
        item.unitPrice.trim() !== '' ||
        item.quantity.trim() !== (baseItem?.quantity ?? '') ||
        item.debtorIds.length !== (baseItem?.debtorIds.length ?? 0) ||
        !sameIds(item.debtorIds, baseItem?.debtorIds ?? [])
      )
    })

  return (
    form.description.trim() !== '' ||
    form.amount.trim() !== '' ||
    form.receiptTaxAmount.trim() !== '' ||
    form.manualRate.trim() !== '' ||
    form.serviceTaxPct.trim() !== '' ||
    form.salesTaxPct.trim() !== '' ||
    form.tipsPct.trim() !== '' ||
    hasEntries(form.itemizedInput) ||
    hasEntries(form.percentageInput) ||
    hasEntries(form.sharesInput) ||
    hasEntries(form.adjustmentInput) ||
    hasReceiptEntries ||
    form.expenseType !== base.expenseType ||
    form.category !== base.category ||
    form.payerIds.length !== base.payerIds.length ||
    !sameIds(form.payerIds, base.payerIds) ||
    form.paidCurrency !== base.paidCurrency ||
    form.repayCurrency !== base.repayCurrency ||
    form.paymentMethod !== base.paymentMethod ||
    form.splitMode !== base.splitMode ||
    form.splitPersonIds.length !== base.splitPersonIds.length ||
    !sameIds(form.splitPersonIds, base.splitPersonIds) ||
    form.itemizedInputMode !== base.itemizedInputMode ||
    form.rateMode !== base.rateMode ||
    form.date !== base.date
  )
}

function sanitizeDraftForm(value: unknown, group: Group): FormState | null {
  if (!isRecord(value)) return null

  const base = blankForm(group)
  const validIds = new Set(group.people.map((person) => person.id))
  const expenseType: ExpenseType = value.expenseType === 'refund' ? 'refund' : 'expense'
  const splitMode: SplitMode =
    value.splitMode === 'itemized' ||
    value.splitMode === 'percentage' ||
    value.splitMode === 'shares' ||
    value.splitMode === 'adjustment' ||
    value.splitMode === 'receipt' ||
    value.splitMode === 'equal'
      ? value.splitMode
      : base.splitMode

  const payerIds = readIdList(value.payerIds, validIds)
  const splitPersonIds = readIdList(value.splitPersonIds, validIds)
  const receiptItems = sanitizeReceiptItemInputs(value.receiptItems, group)

  return {
    ...base,
    expenseType,
    category: typeof value.category === 'string' && value.category ? value.category : base.category,
    description: typeof value.description === 'string' ? value.description : '',
    payerIds: payerIds.length > 0 ? payerIds : base.payerIds,
    amount: typeof value.amount === 'string' ? value.amount : '',
    paidCurrency: typeof value.paidCurrency === 'string' && value.paidCurrency ? value.paidCurrency : base.paidCurrency,
    repayCurrency: typeof value.repayCurrency === 'string' && value.repayCurrency ? value.repayCurrency : base.repayCurrency,
    paymentMethod: value.paymentMethod === 'cash' ? 'cash' : 'card',
    splitMode: expenseType === 'refund' ? 'equal' : splitMode,
    splitPersonIds: splitPersonIds.length > 0 ? splitPersonIds : base.splitPersonIds,
    itemizedInputMode: value.itemizedInputMode === 'total' ? 'total' : 'pretax',
    itemizedInput: readStringMap(value.itemizedInput, validIds),
    percentageInput: readStringMap(value.percentageInput, validIds),
    sharesInput: readStringMap(value.sharesInput, validIds),
    adjustmentInput: readStringMap(value.adjustmentInput, validIds),
    receiptItems: receiptItems.length > 0 ? receiptItems : base.receiptItems,
    receiptTaxAmount: typeof value.receiptTaxAmount === 'string' ? value.receiptTaxAmount : '',
    serviceTaxPct: typeof value.serviceTaxPct === 'string' ? value.serviceTaxPct : '',
    salesTaxPct: typeof value.salesTaxPct === 'string' ? value.salesTaxPct : '',
    tipsPct: typeof value.tipsPct === 'string' ? value.tipsPct : '',
    rateMode: value.rateMode === 'manual' ? 'manual' : 'auto',
    manualRate: typeof value.manualRate === 'string' ? value.manualRate : '',
    date: typeof value.date === 'string' && value.date ? value.date : base.date,
  }
}

function loadExpenseDraft(group: Group): ExpenseDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(getExpenseDraftKey(group.id))
    if (!raw) return null

    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.version !== 1) return null

    const form = sanitizeDraftForm(parsed.form, group)
    if (!form || !hasMeaningfulDraft(form, group)) {
      window.localStorage.removeItem(getExpenseDraftKey(group.id))
      return null
    }

    return {
      version: 1,
      form,
      autoCatActive: Boolean(parsed.autoCatActive),
    }
  } catch {
    return null
  }
}

function saveExpenseDraft(groupId: string, draft: ExpenseDraft) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(getExpenseDraftKey(groupId), JSON.stringify(draft))
}

function clearExpenseDraft(groupId: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(getExpenseDraftKey(groupId))
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
  const receiptItems: ReceiptItemInput[] =
    expense.splitMode === 'receipt' && Array.isArray(expense.receiptItems) && expense.receiptItems.length > 0
      ? expense.receiptItems.map((item) => ({
          id: item.id,
          name: item.name ?? '',
          unitPrice: item.unitPrice != null ? String(item.unitPrice) : '',
          quantity: item.quantity != null ? String(item.quantity) : '',
          debtorIds: Array.isArray(item.debtorIds) ? item.debtorIds : [],
        }))
      : []
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
    receiptItems,
    receiptTaxAmount: expense.receiptTaxAmount != null ? String(expense.receiptTaxAmount) : '',
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
  const [draftRestored, setDraftRestored] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const formContextKey = initialExpense ? `${group.id}:${initialExpense.id}` : `${group.id}:new`

  useEffect(() => {
    if (initialExpense) {
      setForm(expenseToForm(initialExpense))
      setDraftRestored(false)
    } else {
      const restoredDraft = loadExpenseDraft(group)
      if (restoredDraft) {
        setForm(restoredDraft.form)
        setAutoCatActive(restoredDraft.autoCatActive)
        setDraftRestored(true)
      } else {
        setForm(blankForm(group))
        setAutoCatActive(false)
        setDraftRestored(false)
      }
    }
    setRateInfo(null)
    setError('')
    if (initialExpense) setAutoCatActive(false)
    // Reset only when switching to a different group or editing a different expense.
    // Realtime sync replaces the `group` object often, and that should not wipe an in-progress draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formContextKey])

  useEffect(() => {
    if (initialExpense) return

    if (!hasMeaningfulDraft(form, group)) {
      clearExpenseDraft(group.id)
      return
    }

    saveExpenseDraft(group.id, {
      version: 1,
      form,
      autoCatActive,
    })
  }, [autoCatActive, form, group, initialExpense])

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

  const receiptSummary = useMemo(
    () => computeReceiptSummary({
      amount: form.amount,
      receiptItems: form.receiptItems,
      receiptTaxAmount: form.receiptTaxAmount,
    }),
    [form.amount, form.receiptItems, form.receiptTaxAmount],
  )

  useEffect(() => {
    if (form.expenseType !== 'expense' || form.splitMode !== 'receipt') return
    const nextAmount = receiptSummary.grandTotal > 0 ? String(receiptSummary.grandTotal) : ''
    if (form.amount === nextAmount) return
    setForm((prev) => {
      if (prev.expenseType !== 'expense' || prev.splitMode !== 'receipt') return prev
      return { ...prev, amount: nextAmount }
    })
  }, [form.amount, form.expenseType, form.splitMode, receiptSummary.grandTotal])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const submit = async () => {
    if (isSaving) return
    setIsSaving(true)
    setError('')

    const result = compileExpense(form, { group, rateInfo, initialExpense })
    if (!result.ok) {
      if (result.errorKey === 'itemized_mismatch') {
        const delta = `${getCurrencySymbol(form.paidCurrency)}${formatMoney(Math.abs(result.diff))}`
        const modeLine = result.diff > 0 ? t('error.itemizedRemaining') : t('error.itemizedExceeding')
        const warning = `${t('error.cannotSave')}\n\n${modeLine} ${delta} ${t('error.tallyNote')}`
        window.alert(warning)
        setError(`${modeLine} ${delta}. ${t('error.itemizedTally')}`)
      } else if (result.errorKey === 'percentage_mismatch') {
        setError(`${t('error.percentageMismatch')} ${formatMoney(result.totalPct, 1)}%).`)
      } else {
        setError(t(EXPENSE_ERROR_KEY_TO_I18N[result.errorKey]))
      }
      setIsSaving(false)
      return
    }

    try {
      await Promise.resolve(onSave(result.expense))

      clearExpenseDraft(group.id)
      setDraftRestored(false)
      setForm(blankForm(group))
      setRateInfo(null)
      setError('')
      setAutoCatActive(false)
    } finally {
      setIsSaving(false)
    }
  }

  const isRefund = form.expenseType === 'refund'
  const discardDraft = () => {
    clearExpenseDraft(group.id)
    setDraftRestored(false)
    setForm(blankForm(group))
    setRateInfo(null)
    setError('')
    setAutoCatActive(false)
  }

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
        ) : draftRestored && !initialExpense ? (
          <button className="ms-btn-ghost text-xs" onClick={discardDraft}>
            {t('expense.discardDraft')}
          </button>
        ) : showModeBadge ? (
          <span className="rounded-full bg-[rgba(139,110,78,0.08)] px-2 py-1 text-[11px] font-medium text-[#74593c]">
            {t('expense.mobileQuick')}
          </span>
        ) : null}
      </div>

      {draftRestored && !initialExpense ? (
        <p className="mb-3 text-xs text-[#6b6058]">{t('expense.draftRestored')}</p>
      ) : null}

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

        {/* ── Step 1: bill identity ───────────────────────────────────── */}
        <WizardCard step={1} title={t('expenseWizard.stepWhat')} help={t('expenseWizard.stepWhatHelp')}>
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
        </WizardCard>

        {/* ── Step 2: amount + currency ───────────────────────────────── */}
        <WizardCard step={2} title={t('expenseWizard.stepAmount')} help={t('expenseWizard.stepAmountHelp')}>
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
              readOnly={!isRefund && form.splitMode === 'receipt'}
            />
            {!isRefund && form.splitMode === 'receipt' ? (
              <p className="mt-1 text-xs text-[#9a9088]">{t('expense.receiptAutoAmount')}</p>
            ) : null}
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
        </WizardCard>

        {/* ── Category — hidden for refunds (auto-set to Refund) ─────── */}
        {!isRefund && (
          <div className="rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4 shadow-[0_10px_24px_rgba(119,76,36,0.06)]">
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
            {/* ── Step 3: payer ─────────────────────────────────────────── */}
            <WizardCard step={3} title={t('expenseWizard.stepPayer')} help={t('expenseWizard.stepPayerHelp')}>
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
            </WizardCard>

            {/* ── Step 4: split method ───────────────────────────────────── */}
            <WizardCard step={4} title={t('expenseWizard.stepSplit')} help={t('expenseWizard.stepSplitHelp')}>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--ms-accent-bg)] px-3 py-2">
                  <p className="text-sm font-black text-[var(--ms-text)]">{t('expenseWizard.equalTitle')}</p>
                  <p className="text-xs text-[var(--ms-text-secondary)]">{t('expenseWizard.equalHelp')}</p>
                </div>
                <div className="rounded-2xl bg-[var(--ms-surface-dim)] px-3 py-2">
                  <p className="text-sm font-black text-[var(--ms-text)]">{t('expenseWizard.itemizedTitle')}</p>
                  <p className="text-xs text-[var(--ms-text-secondary)]">{t('expenseWizard.itemizedHelp')}</p>
                </div>
              </div>
            <SplitExpander
              state={{
                splitMode: form.splitMode,
                splitPersonIds: form.splitPersonIds,
                itemizedInput: form.itemizedInput,
                receiptItems: form.receiptItems,
                receiptTaxAmount: form.receiptTaxAmount,
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
                  receiptItems: next.receiptItems,
                  receiptTaxAmount: next.receiptTaxAmount,
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
            </WizardCard>
          </>
        )}

        {/* ── Step 5: date + save ─────────────────────────────────────── */}
        <WizardCard step={5} title={t('expenseWizard.stepReview')} help={t('expenseWizard.stepReviewHelp')}>
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
        </WizardCard>

        {error ? <p className="text-sm text-[#9e4a4a]">{error}</p> : null}

        {/* ── Action buttons ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className={`h-11 rounded-xl font-semibold text-white transition-colors ${
              isRefund ? 'bg-[#2e6060] hover:bg-[#245050]' : 'ms-btn-primary'
            }`}
            onClick={submit}
            disabled={isSaving}
          >
            {isSaving ? t('group.syncing') : isRefund ? t('expense.saveRefund') : submitLabel}
          </button>
          {onCancel ? (
            <button className="ms-btn-ghost h-11" onClick={onCancel} disabled={isSaving}>
              {t('expense.cancel')}
            </button>
          ) : null}
        </div>
      </div>

    </section>
  )
}
