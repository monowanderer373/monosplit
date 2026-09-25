import { useMemo, useRef, useState } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import type { CanonicalExpense } from '../types'
import { CURRENCIES } from '../lib/currency'
import {
  categoryKey,
  friendlyErrorKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import {
  suggestCategoryForDescription,
  suggestQuickAddDescriptions,
} from '../lib/quickAddSuggestions'
import type {
  UniversalQuickAddSession,
  UniversalQuickAddValues,
} from '../lib/universalQuickAdd'
import { applySuggestedCategory } from '../lib/universalQuickAdd'
import PaperSheet from './navigation/PaperSheet'

type Props = {
  session: UniversalQuickAddSession
  expenses: CanonicalExpense[]
  onUpdate: (patch: Partial<UniversalQuickAddValues>) => void
  onOpenContextPicker: () => void
  onClose: () => void
  onSubmit: () => Promise<{ ok: boolean; error?: string }>
}

const CATEGORIES = [
  'Other',
  'Food',
  'Transport',
  'Stay',
  'Shopping',
  'Activities',
]

export default function UniversalQuickAddSheet({
  session,
  expenses,
  onUpdate,
  onOpenContextPicker,
  onClose,
  onSubmit,
}: Props) {
  const t = useT()
  const amountRef = useRef<HTMLInputElement>(null)
  const dialogRef = useAccessibleDialog<HTMLElement>(onClose, amountRef)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')
  const context = session.context
  const values = session.values

  const selectedParticipants = useMemo(
    () => context?.availableParticipants.filter((participant) =>
      values.selectedParticipantIds.includes(participant.id),
    ) ?? [],
    [context, values.selectedParticipantIds],
  )
  const suggestions = useMemo(
    () => context
      ? suggestQuickAddDescriptions({
          expenses,
          context: context.ref,
        })
      : [],
    [context, expenses],
  )
  const contextLabel =
    !context || context.ref.kind === 'personal'
      ? t('common.personal')
      : context.ref.displayName
  const scope =
    context?.ref.kind === 'personal'
      ? 'personal'
      : context?.ref.kind === 'person'
        ? 'direct'
        : 'space'
  const simplePayerId =
    Object.entries(values.payerAmounts).find(([, amount]) => amount.trim())?.[0]
    ?? context?.currentParticipantId

  const updateDescription = (description: string) => {
    let categoryValues = values
    if (
      context
      && (!values.category || values.category === 'Other')
    ) {
      const suggestedCategory = suggestCategoryForDescription({
        expenses,
        context: context.ref,
        description,
      })
      categoryValues = applySuggestedCategory(values, suggestedCategory)
    }
    onUpdate({
      description,
      category: categoryValues.category,
      categorySource: categoryValues.categorySource,
    })
  }

  const chooseSuggestion = (description: string, category: string) => {
    onUpdate({
      description,
      category: category || values.category || 'Other',
      categorySource: 'SUGGESTED',
    })
  }

  const toggleParticipant = (participantId: string) => {
    if (!context || participantId === context.currentParticipantId) return
    const selected = values.selectedParticipantIds.includes(participantId)
    const payerAmounts = { ...values.payerAmounts }
    const exactShareAmounts = { ...values.exactShareAmounts }
    if (selected) {
      delete payerAmounts[participantId]
      delete exactShareAmounts[participantId]
    }
    onUpdate({
      selectedParticipantIds: selected
        ? values.selectedParticipantIds.filter((id) => id !== participantId)
        : [...values.selectedParticipantIds, participantId],
      payerAmounts,
      exactShareAmounts,
    })
  }

  const setSimplePayer = (participantId: string) => {
    if (!context || participantId === context.currentParticipantId) {
      onUpdate({ payerAmounts: {} })
      return
    }
    onUpdate({ payerAmounts: { [participantId]: values.amount } })
  }

  const submit = async () => {
    if (saving) return
    setSaving(true)
    setError('')
    const result = await onSubmit()
    if (!result.ok) {
      setError(
        result.error === 'recurring_pending'
          ? 'quickAdd.recurringPending'
          : result.error
            ? friendlyErrorKey(result.error)
            : 'friendlyError.saveExpense',
      )
      setSaving(false)
    }
  }

  return (
    <PaperSheet labelledBy="universal-quick-add-title" dialogRef={dialogRef} onClose={onClose}>
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {session.contextPolicy === 'switchable' ? (
              <button
                type="button"
                className="ms-btn-ghost min-h-10 py-2 text-left text-sm"
                onClick={onOpenContextPicker}
                aria-label={t('quickAdd.changeContext', { context: contextLabel })}
              >
                {contextLabel} <span aria-hidden="true">⌄</span>
              </button>
            ) : (
              <p className="ms-label">{contextLabel} · {t('quickAdd.contextLocked')}</p>
            )}
            <h2 id="universal-quick-add-title" className="mt-1 text-2xl font-extrabold">
              {t(scope === 'personal' ? 'quickAdd.title' : 'expense.addTitle')}
            </h2>
          </div>
          <button className="ms-btn-ghost h-11 w-11 p-0" onClick={onClose} aria-label={t('common.close')}>×</button>
        </header>

        <label className="block">
          <span className="sr-only">{t('expense.amount')}</span>
          <div className="tt-sheet-amount">
            <span className="text-sm font-bold text-[var(--ms-text-secondary)]">{values.currency}</span>
            <input
              ref={amountRef}
              className="min-w-0 flex-1 bg-transparent text-right text-4xl font-extrabold tracking-tight outline-none"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={values.amount}
              onChange={(event) => {
                const amount = event.target.value
                const payerAmounts =
                  simplePayerId && simplePayerId !== context?.currentParticipantId
                    ? { [simplePayerId]: amount }
                    : values.payerAmounts
                onUpdate({ amount, payerAmounts })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submit()
              }}
            />
          </div>
        </label>

        <label className="mt-4 block text-xs font-bold text-[var(--ms-text-secondary)]">
          {t('expense.description')}
          <input
            className="ms-input mt-1 w-full"
            placeholder={t('quickAdd.notePlaceholder')}
            value={values.description}
            onChange={(event) => updateDescription(event.target.value)}
          />
        </label>

        {suggestions.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-bold text-[var(--ms-text-muted)]">{t('quickAdd.suggestions')}</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion.description}
                  className="ms-btn-ghost shrink-0 py-2 text-sm"
                  onClick={() => chooseSuggestion(suggestion.description, suggestion.category)}
                >
                  {suggestion.description}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {scope !== 'personal' ? (
          <>
            <fieldset className="mt-4">
              <legend className="text-xs font-bold text-[var(--ms-text-secondary)]">{t('expenseCapture.splitWith')}</legend>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {context?.availableParticipants.map((participant) => {
                  const selected = values.selectedParticipantIds.includes(participant.id)
                  return (
                    <button
                      type="button"
                      key={participant.id}
                      className={selected ? 'ms-btn-primary shrink-0 py-2' : 'ms-btn-ghost shrink-0 py-2'}
                      onClick={() => toggleParticipant(participant.id)}
                      aria-pressed={selected}
                    >
                      {participant.id === context.currentParticipantId
                        ? t('common.you')
                        : participant.displayName}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <label className="mt-3 block text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expense.paidBy')}
              <select
                className="ms-input mt-1 w-full"
                value={simplePayerId}
                onChange={(event) => setSimplePayer(event.target.value)}
              >
                {selectedParticipants.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.id === context?.currentParticipantId
                      ? t('common.you')
                      : participant.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-xs font-bold text-[var(--ms-text-secondary)]">
              {t('expenseCapture.split')}
              <select
                className="ms-input mt-1 w-full"
                value={values.splitMode}
                onChange={(event) => onUpdate({
                  splitMode: event.target.value as 'equal' | 'exact',
                })}
              >
                <option value="equal">{t('expenseCapture.equally')}</option>
                <option value="exact">{t('expenseCapture.exact')}</option>
              </select>
            </label>

            {values.splitMode === 'exact' ? (
              <div className="mt-3 rounded-2xl bg-[var(--ms-bg-warm)] p-3">
                <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('expenseCapture.eachShare')}</p>
                <div className="mt-2 grid gap-2">
                  {selectedParticipants.map((participant) => (
                    <label key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{participant.id === context?.currentParticipantId ? t('common.you') : participant.displayName}</span>
                      <input
                        className="ms-input h-10 w-32 text-right"
                        inputMode="decimal"
                        aria-label={t('expenseCapture.shareFor', {
                          name: participant.id === context?.currentParticipantId ? t('common.you') : participant.displayName,
                        })}
                        placeholder="0.00"
                        value={values.exactShareAmounts[participant.id] ?? ''}
                        onChange={(event) => onUpdate({
                          exactShareAmounts: {
                            ...values.exactShareAmounts,
                            [participant.id]: event.target.value,
                          },
                        })}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className={`mt-4 grid gap-2 ${scope === 'personal' ? '' : 'grid-cols-2'}`}>
          <button
            type="button"
            className="ms-btn-ghost w-full text-sm"
            onClick={() => onUpdate({ detailsExpanded: !values.detailsExpanded })}
            aria-expanded={values.detailsExpanded}
          >
            {values.detailsExpanded ? t('quickAdd.hideDetails') : t('quickAdd.moreDetails')}
          </button>
          {scope !== 'personal' ? (
            <button
              type="button"
              className="ms-btn-ghost w-full text-sm"
              onClick={() => onUpdate({ detailsExpanded: true })}
            >
              {t('expenseCapture.multiplePayers')}
            </button>
          ) : null}
        </div>

        {values.detailsExpanded ? (
          <div className="mt-3 rounded-2xl bg-[var(--ms-bg-warm)] p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
                {t('expense.currency')}
                <select className="ms-input mt-1 w-full" value={values.currency} onChange={(event) => onUpdate({ currency: event.target.value })}>
                  {CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
                {t('expense.date')}
                <input className="ms-input mt-1 w-full" type="date" value={values.occurredOn} onChange={(event) => onUpdate({ occurredOn: event.target.value })} />
              </label>
              <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
                {t('expense.category')}
                <select
                  className="ms-input mt-1 w-full"
                  value={values.category || 'Other'}
                  onChange={(event) => {
                    onUpdate({
                      category: event.target.value,
                      categorySource: 'USER',
                    })
                  }}
                >
                  {CATEGORIES.map((item) => <option key={item} value={item}>{t(categoryKey(item))}</option>)}
                </select>
              </label>
            </div>

            {scope !== 'personal' ? (
              <div className="mt-3">
                <p className="text-xs font-extrabold text-[var(--ms-text-secondary)]">{t('expenseCapture.amountPaid')}</p>
                <div className="mt-2 grid gap-2">
                  {selectedParticipants.map((participant) => (
                    <label key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{participant.id === context?.currentParticipantId ? t('common.you') : participant.displayName}</span>
                      <input
                        className="ms-input h-10 w-32 text-right"
                        inputMode="decimal"
                        aria-label={t('expenseCapture.paidBy', {
                          name: participant.id === context?.currentParticipantId ? t('common.you') : participant.displayName,
                        })}
                        placeholder="0.00"
                        value={values.payerAmounts[participant.id] ?? ''}
                        onChange={(event) => onUpdate({
                          payerAmounts: {
                            ...values.payerAmounts,
                            [participant.id]: event.target.value,
                          },
                        })}
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
          disabled={
            saving
            || values.amount.trim() === ''
            || selectedParticipants.length === 0
          }
          onClick={() => void submit()}
        >
          {saving ? t('common.saving') : t('quickAdd.save')}
        </button>
    </PaperSheet>
  )
}
