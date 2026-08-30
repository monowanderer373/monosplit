import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CanonicalExpense } from '../types'
import type { LedgerExpenseDraft } from '../lib/compileExpense'
import {
  captureRepository,
  type CaptureTemplate,
  type RecurringDraft,
  type RecurringRule,
} from '../lib/captureRepository'
import {
  categoryKey,
  countKey,
  friendlyErrorKey,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatDate } from '../lib/locale'
import { useStore } from '../store/useStore'

export type CapturePreset = {
  source: NonNullable<LedgerExpenseDraft['captureSource']>
  values: Partial<Pick<LedgerExpenseDraft, 'amount' | 'currency' | 'description' | 'category' | 'occurredOn'>>
  clientRequestId?: string
  onSaved?: () => void | Promise<void>
}

type Props = {
  participantId: string
  timezone: string
  expenses: CanonicalExpense[]
  onOpen: (preset: CapturePreset) => void
}

function stringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

export default function CaptureLibrary({
  participantId,
  timezone,
  expenses,
  onOpen,
}: Props) {
  const t = useT()
  const lang = useStore((state) => state.lang)
  const [templates, setTemplates] = useState<CaptureTemplate[]>([])
  const [rules, setRules] = useState<RecurringRule[]>([])
  const [drafts, setDrafts] = useState<RecurringDraft[]>([])
  const [scheduleTemplateId, setScheduleTemplateId] = useState('')
  const [cadence, setCadence] = useState<'weekly' | 'monthly'>('monthly')
  const [nextDueOn, setNextDueOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [action, setAction] = useState('')
  const [error, setError] = useState<TranslationKey | ''>('')

  const refresh = useCallback(async () => {
    try {
      await captureRepository.generateDueDrafts()
      const [nextTemplates, nextRules, nextDrafts] = await Promise.all([
        captureRepository.listTemplates(),
        captureRepository.listRecurringRules(),
        captureRepository.listRecurringDrafts(),
      ])
      setTemplates(nextTemplates.filter((template) => template.ownerParticipantId === participantId))
      setRules(nextRules)
      setDrafts(nextDrafts)
      setError('')
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    }
  }, [participantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const recents = useMemo(() => {
    const seen = new Set<string>()
    return expenses
      .filter((expense) => expense.scope === 'personal' && expense.status === 'active')
      .filter((expense) => {
        const key = `${expense.description ?? ''}:${expense.category}:${expense.currency}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, 4)
  }, [expenses])

  const saveTemplate = async (expense: CanonicalExpense) => {
    if (action) return
    setAction(expense.id)
    setError('')
    try {
      await captureRepository.createTemplate({
        scope: 'personal',
        spaceId: null,
        label: expense.description ?? expense.category,
        description: expense.description,
        category: expense.category,
        currency: expense.currency,
        participantIds: [participantId],
        payerParticipantIds: [participantId],
      })
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const schedule = async () => {
    if (!scheduleTemplateId || action) return
    setAction('schedule')
    setError('')
    try {
      await captureRepository.createRecurringRule({
        templateId: scheduleTemplateId,
        cadence,
        localTime: '09:00',
        timezone,
        nextDueOn,
        endOn: null,
      })
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  const openRecurringDraft = (draft: RecurringDraft) => {
    onOpen({
      source: 'recurring',
      clientRequestId: draft.id,
      values: {
        amount: '',
        currency: stringField(draft.payload, 'currency'),
        description: stringField(draft.payload, 'description'),
        category: stringField(draft.payload, 'category'),
        occurredOn: draft.scheduledFor,
      },
      onSaved: async () => {
        await captureRepository.respondRecurringDraft(draft.id, 'accepted')
        await refresh()
      },
    })
  }

  const dismissDraft = async (draftId: string) => {
    if (action) return
    setAction(draftId)
    try {
      await captureRepository.respondRecurringDraft(draftId, 'dismissed')
      await refresh()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
    } finally {
      setAction('')
    }
  }

  if (recents.length === 0 && templates.length === 0 && drafts.length === 0) return null

  return (
    <section className="mx-auto mt-6 max-w-3xl">
      <div className="ms-card">
        <p className="ms-label">{t('library.label')}</p>

        {drafts.length > 0 ? (
          <div className="mt-3">
            <p className="text-sm font-extrabold">{t('library.due')}</p>
            <div className="mt-2 grid gap-2">
              {drafts.map((draft) => (
                <div key={draft.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--ms-bg-warm)] p-3">
                  <button className="min-h-11 min-w-0 flex-1 text-left text-sm font-bold" onClick={() => openRecurringDraft(draft)}>
                    {stringField(draft.payload, 'description')
                      ?? (stringField(draft.payload, 'category') ? t(categoryKey(stringField(draft.payload, 'category')!)) : t('library.recurringExpense'))} · {formatDate(draft.scheduledFor, lang)}
                  </button>
                  <button className="min-h-11 text-xs font-bold text-[var(--ms-text-muted)]" disabled={action === draft.id} onClick={() => void dismissDraft(draft.id)}>{t('library.dismiss')}</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {templates.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-extrabold">{t('library.templates')}</p>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  className="ms-btn-ghost shrink-0 py-2"
                  onClick={() => onOpen({
                    source: 'template',
                    values: {
                      amount: '',
                      currency: template.currency ?? undefined,
                      description: template.description ?? undefined,
                      category: template.category ?? undefined,
                    },
                  })}
                >
                  {template.category && template.label === template.category
                    ? t(categoryKey(template.category))
                    : template.label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <select
                className="ms-input h-10"
                value={scheduleTemplateId}
                aria-label={t('library.templateName')}
                onChange={(event) => setScheduleTemplateId(event.target.value)}
              >
                <option value="">{t('library.schedulePlaceholder')}</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
              </select>
              <select
                className="ms-input h-10"
                value={cadence}
                aria-label={t('library.cadence')}
                onChange={(event) => setCadence(event.target.value as 'weekly' | 'monthly')}
              >
                <option value="weekly">{t('library.weekly')}</option>
                <option value="monthly">{t('library.monthly')}</option>
              </select>
              <input
                className="ms-input h-10"
                type="date"
                value={nextDueOn}
                aria-label={t('library.nextDue')}
                onChange={(event) => setNextDueOn(event.target.value)}
              />
              <button className="ms-btn-ghost py-2" disabled={!scheduleTemplateId || action === 'schedule'} onClick={() => void schedule()}>{t('library.schedule')}</button>
            </div>
          </div>
        ) : null}

        {recents.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-extrabold">{t('library.recent')}</p>
            <div className="mt-2 grid gap-2">
              {recents.map((expense) => (
                <div key={expense.id} className="flex items-center gap-2">
                  <button
                    className="ms-btn-ghost min-w-0 flex-1 truncate py-2 text-left"
                    onClick={() => onOpen({
                      source: 'template',
                      values: {
                        amount: '',
                        currency: expense.currency,
                        description: expense.description ?? undefined,
                        category: expense.category,
                      },
                    })}
                  >
                    {t('library.amountBlank', { label: expense.description ?? t(categoryKey(expense.category)) })}
                  </button>
                  <button className="min-h-11 shrink-0 text-xs font-bold text-[var(--ms-accent)]" disabled={action === expense.id} onClick={() => void saveTemplate(expense)}>
                    {t('library.saveTemplate')}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rules.some((rule) => rule.active) ? (
          <div className="mt-4 border-t border-[var(--ms-border)] pt-3">
            <p className="text-xs font-bold text-[var(--ms-text-muted)]">
              {t(countKey('common.count.rule.one', 'common.count.rule.many', rules.filter((rule) => rule.active).length), {
                count: rules.filter((rule) => rule.active).length,
              })}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-[var(--ms-danger)]">{t(error)}</p> : null}
      </div>
    </section>
  )
}
