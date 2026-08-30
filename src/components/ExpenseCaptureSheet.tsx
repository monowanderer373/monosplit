import { useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import type { ExpenseScope, ParticipantKind } from '../types'
import type { LedgerExpenseDraft } from '../lib/compileExpense'
import { CURRENCIES } from '../lib/currency'
import { generateId } from '../lib/id'
import { categoryKey, friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'

export type CaptureParticipant = {
  id: string
  displayName: string
  kind: ParticipantKind
}

type Props = {
  scope: ExpenseScope
  spaceId: string | null
  contextLabel: string
  currentParticipantId: string
  participants: CaptureParticipant[]
  defaultCurrency: string
  startedAtMs: number
  initialSelectedIds?: string[]
  onClose: () => void
  onSave: (
    draft: LedgerExpenseDraft,
    startedAtMs: number,
  ) => Promise<{ ok: boolean; error?: string }>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ExpenseCaptureSheet({
  scope,
  spaceId,
  contextLabel,
  currentParticipantId,
  participants,
  defaultCurrency,
  startedAtMs,
  initialSelectedIds,
  onClose,
  onSave,
}: Props) {
  const t = useT()
  const amountRef = useRef<HTMLInputElement>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>(onClose, amountRef)
  const initialIds = useMemo(() => {
    const requested = new Set(initialSelectedIds ?? participants.map((participant) => participant.id))
    requested.add(currentParticipantId)
    return participants.filter((participant) => requested.has(participant.id)).map((participant) => participant.id)
  }, [currentParticipantId, initialSelectedIds, participants])
  const [selectedIds, setSelectedIds] = useState(initialIds)
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [category, setCategory] = useState('Other')
  const [occurredOn, setOccurredOn] = useState(today)
  const [splitMode, setSplitMode] = useState<'equal' | 'exact'>('equal')
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>({})
  const [exactShareAmounts, setExactShareAmounts] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')

  const selectedParticipants = participants.filter((participant) => selectedIds.includes(participant.id))

  const toggleParticipant = (participantId: string) => {
    if (participantId === currentParticipantId) return
    setSelectedIds((current) => current.includes(participantId)
      ? current.filter((id) => id !== participantId)
      : [...current, participantId])
  }

  const submit = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const result = await onSave({
      clientRequestId: generateId(),
      scope,
      spaceId,
      currentParticipantId,
      amount,
      currency,
      description,
      category,
      occurredOn,
      participants: selectedParticipants.map((participant) => ({
        id: participant.id,
        displayName: participant.displayName,
        kind: participant.kind,
      })),
      payerAmounts,
      splitMode,
      exactShareAmounts,
    }, startedAtMs)
    if (result.ok) {
      onClose()
      return
    }
    setError(result.error ? friendlyErrorKey(result.error) : 'friendlyError.saveExpense')
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 sm:items-center sm:p-4">
      <div className="absolute inset-0" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--ms-surface)] p-5 shadow-2xl sm:rounded-[2rem]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="capture-title"
        tabIndex={-1}
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="ms-label">{contextLabel}</p>
            <h2 id="capture-title" className="mt-1 text-2xl font-extrabold">{t('expense.addTitle')}</h2>
          </div>
          <button className="ms-btn-ghost h-11 w-11 p-0" onClick={onClose} aria-label={t('common.close')}>×</button>
        </header>

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
                if (event.key === 'Enter' && scope === 'personal') void submit()
              }}
            />
          </div>
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('expense.currency')}
            <select className="ms-input mt-1 w-full" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('expense.date')}
            <input className="ms-input mt-1 w-full" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
          </label>
        </div>

        {scope !== 'personal' ? (
          <fieldset className="mt-4">
            <legend className="text-xs font-bold text-[var(--ms-text-secondary)]">{t('expenseCapture.splitWith')}</legend>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {participants.map((participant) => {
                const selected = selectedIds.includes(participant.id)
                return (
                  <button
                    type="button"
                    key={participant.id}
                    className={selected ? 'ms-btn-primary shrink-0 py-2' : 'ms-btn-ghost shrink-0 py-2'}
                    onClick={() => toggleParticipant(participant.id)}
                    aria-pressed={selected}
                  >
                    {participant.id === currentParticipantId ? t('common.you') : participant.displayName}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ) : null}

        <label className="mt-4 block text-xs font-bold text-[var(--ms-text-secondary)]">
          {t('quickAdd.note')} <span className="font-normal">({t('common.optional')})</span>
          <input
            className="ms-input mt-1 w-full"
            placeholder={t('quickAdd.notePlaceholder')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
            {t('expense.category')}
            <select className="ms-input mt-1 w-full" value={category} onChange={(event) => setCategory(event.target.value)}>
              {['Other', 'Food', 'Transport', 'Stay', 'Shopping', 'Activities'].map((item) => (
                <option key={item} value={item}>{t(categoryKey(item))}</option>
              ))}
            </select>
          </label>
          {scope !== 'personal' ? (
            <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expenseCapture.split')}
              <select className="ms-input mt-1 w-full" value={splitMode} onChange={(event) => setSplitMode(event.target.value as 'equal' | 'exact')}>
                <option value="equal">{t('expenseCapture.equally')}</option>
                <option value="exact">{t('expenseCapture.exact')}</option>
              </select>
            </label>
          ) : <div />}
        </div>

        {splitMode === 'exact' && scope !== 'personal' ? (
          <div className="mt-4 rounded-2xl bg-[var(--ms-bg-warm)] p-3">
            <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('expenseCapture.eachShare')}</p>
            <div className="mt-2 grid gap-2">
              {selectedParticipants.map((participant) => (
                <label key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{participant.id === currentParticipantId ? t('common.you') : participant.displayName}</span>
                  <input
                    className="ms-input h-10 w-32 text-right"
                    inputMode="decimal"
                    aria-label={t('expenseCapture.shareFor', {
                      name: participant.id === currentParticipantId ? t('common.you') : participant.displayName,
                    })}
                    placeholder="0.00"
                    value={exactShareAmounts[participant.id] ?? ''}
                    onChange={(event) => setExactShareAmounts((current) => ({ ...current, [participant.id]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {scope !== 'personal' ? (
          <div className="mt-3">
            <button type="button" className="ms-btn-ghost w-full text-sm" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? t('expenseCapture.hidePayers') : t('expenseCapture.multiplePayers')}
            </button>
            {showAdvanced ? (
              <div className="mt-2 rounded-2xl bg-[var(--ms-bg-warm)] p-3">
                <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('expenseCapture.amountPaid')}</p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">{t('expenseCapture.payerHelp')}</p>
                <div className="mt-2 grid gap-2">
                  {selectedParticipants.map((participant) => (
                    <label key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{participant.id === currentParticipantId ? t('common.you') : participant.displayName}</span>
                      <input
                        className="ms-input h-10 w-32 text-right"
                        inputMode="decimal"
                        aria-label={t('expenseCapture.paidBy', {
                          name: participant.id === currentParticipantId ? t('common.you') : participant.displayName,
                        })}
                        placeholder="0.00"
                        value={payerAmounts[participant.id] ?? ''}
                        onChange={(event) => setPayerAmounts((current) => ({ ...current, [participant.id]: event.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
            {t(error)}
          </p>
        ) : null}

        <button
          className="ms-btn-primary mt-5 h-12 w-full text-base"
          disabled={saving || amount.trim() === '' || selectedParticipants.length === 0}
          onClick={() => void submit()}
        >
          {saving ? t('common.saving') : t('quickAdd.save')}
        </button>
      </section>
    </div>
  )
}
