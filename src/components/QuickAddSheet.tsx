import { useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import type { LedgerExpenseDraft } from '../lib/compileExpense'
import { resolveCaptureDefaults } from '../lib/captureDefaults'
import { CURRENCIES } from '../lib/currency'
import { generateId } from '../lib/id'
import {
  categoryKey,
  friendlyErrorKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'

type Props = {
  participantId: string
  participantName: string
  defaultCurrency: string
  startedAtMs: number
  clientRequestId?: string
  source?: NonNullable<LedgerExpenseDraft['captureSource']>
  initialValues?: Partial<Pick<
    LedgerExpenseDraft,
    'amount' | 'currency' | 'description' | 'category' | 'occurredOn'
  >>
  onClose: () => void
  onSaved?: () => void | Promise<void>
  onSave: (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => Promise<{ ok: boolean; error?: string }>
}

export default function QuickAddSheet({
  participantId,
  participantName,
  defaultCurrency,
  startedAtMs,
  clientRequestId,
  source = 'manual',
  initialValues,
  onClose,
  onSaved,
  onSave,
}: Props) {
  const t = useT()
  const amountRef = useRef<HTMLInputElement>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>(onClose, amountRef)
  const resolvedDefaults = useMemo(() => resolveCaptureDefaults({
    provided: initialValues,
    profile: {
      currency: defaultCurrency,
      category: 'Other',
      occurredOn: new Date().toISOString().slice(0, 10),
    },
  }).values, [defaultCurrency, initialValues])
  const [amount, setAmount] = useState(initialValues?.amount ?? '')
  const [description, setDescription] = useState(resolvedDefaults.description ?? '')
  const [currency, setCurrency] = useState(resolvedDefaults.currency ?? defaultCurrency)
  const [category, setCategory] = useState(resolvedDefaults.category ?? 'Other')
  const [occurredOn, setOccurredOn] = useState(resolvedDefaults.occurredOn ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')

  const submit = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const result = await onSave({
      captureSource: source,
      clientRequestId: clientRequestId ?? generateId(),
      scope: 'personal',
      spaceId: null,
      currentParticipantId: participantId,
      amount,
      currency,
      description,
      category,
      occurredOn,
      participants: [{
        id: participantId,
        displayName: participantName,
        kind: 'account',
      }],
      payerAmounts: {},
      splitMode: 'equal',
      exactShareAmounts: {},
    }, startedAtMs)
    if (result.ok) {
      try {
        await onSaved?.()
      } catch {
        setError('quickAdd.recurringPending')
        setSaving(false)
        return
      }
      onClose()
      return
    }
    setError(result.error ? friendlyErrorKey(result.error) : 'friendlyError.saveExpense')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        className="relative z-10 w-full max-w-lg rounded-t-[2rem] bg-[var(--ms-surface)] p-5 shadow-2xl sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        tabIndex={-1}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ms-label">{t('ledger.personal')}</p>
            <h2 id="quick-add-title" className="mt-1 text-2xl font-extrabold">{t('quickAdd.title')}</h2>
          </div>
          <button className="ms-btn-ghost h-10 w-10 p-0" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>

        <label className="block">
          <span className="sr-only">{t('expense.amount')}</span>
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--ms-bg-warm)] px-4 py-3">
            <span className="text-sm font-bold text-[var(--ms-text-secondary)]">{currency}</span>
            <input
              ref={amountRef}
              className="min-w-0 flex-1 bg-transparent text-right text-4xl font-extrabold tracking-tight outline-none"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
          </div>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('expense.currency')}
            <select
              className="ms-input mt-1 w-full"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCIES.map((item) => (
                <option key={item.code} value={item.code}>{item.code}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('expense.date')}
            <input
              className="ms-input mt-1 w-full"
              type="date"
              value={occurredOn}
              onChange={(event) => setOccurredOn(event.target.value)}
            />
          </label>
        </div>

        <label className="mt-3 block text-xs font-bold text-[var(--ms-text-secondary)]">
          {t('quickAdd.note')} <span className="font-normal">({t('common.optional')})</span>
          <input
            className="ms-input mt-1 w-full"
            placeholder={t('quickAdd.notePlaceholder')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <label className="mt-3 block text-xs font-bold text-[var(--ms-text-secondary)]">
          {t('expense.category')}
          <select
            className="ms-input mt-1 w-full"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {['Other', 'Food', 'Transport', 'Stay', 'Shopping', 'Activities'].map((item) => (
              <option key={item} value={item}>{t(categoryKey(item))}</option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="mt-3 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
            {t(error)}
          </p>
        ) : null}

        <button
          className="ms-btn-primary mt-5 h-12 w-full text-base"
          disabled={saving || amount.trim() === ''}
          onClick={() => void submit()}
        >
          {saving ? t('common.saving') : t('quickAdd.save')}
        </button>
        <p className="mt-2 text-center text-xs text-[var(--ms-text-muted)]">
          {t('quickAdd.help')}
        </p>
      </section>
    </div>
  )
}
