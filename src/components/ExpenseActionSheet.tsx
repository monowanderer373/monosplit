import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CanonicalExpense, GroupRole } from '../types'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { SELECTABLE_EXPENSE_CATEGORIES } from '../lib/categories'
import {
  deriveExpenseActionPolicy,
  financialFailureDisposition,
  type ExpenseAction,
} from '../lib/expenseActionPolicy'
import {
  expenseChangeRepository,
  type DirectExpenseChangeRequest,
  type ExpenseFinancialPayload,
} from '../lib/expenseChangeRepository'
import { rescaleMinorAmounts } from '../lib/expenseFinancialDraft'
import { generateId } from '../lib/id'
import {
  categoryKey,
  friendlyErrorKey,
  machineCode,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import {
  currencyExponent,
  formatMinorAmount,
  parseMajorAmount,
  reconcileMinorAmounts,
} from '../lib/money'
import { ledgerRepository } from '../lib/ledgerRepository'

type EditorMode =
  | 'menu'
  | 'metadata'
  | 'financial'
  | 'correction'
  | 'space_correction'
  | 'cancel'
  | 'request_cancellation'
  | 'view_request'

type Props = {
  expense: CanonicalExpense
  currentParticipantId: string
  spaceRole?: GroupRole | null
  pendingRequest?: DirectExpenseChangeRequest | null
  onCancelExpense?: (expenseId: string) => Promise<void>
  onRefresh: () => Promise<unknown>
}

export default function ExpenseActionSheet({
  expense,
  currentParticipantId,
  spaceRole = null,
  pendingRequest = null,
  onCancelExpense,
  onRefresh,
  statusNotice = '',
}: Props & { statusNotice?: string }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<EditorMode>('menu')
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failClosed, setFailClosed] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')
  const [message, setMessage] = useState<TranslationKey | ''>('')
  const [description, setDescription] = useState(expense.description ?? '')
  const [category, setCategory] = useState(expense.category)
  const [occurredOn, setOccurredOn] = useState(expense.occurredOn)
  const [total, setTotal] = useState(minorInput(expense.totalMinor, expense.currency))
  const [currency, setCurrency] = useState(expense.currency)
  const [paid, setPaid] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>({})
  const dialogRef = useAccessibleDialog<HTMLElement>(() => setOpen(false))
  const orderedParticipations = useMemo(
    () => [...expense.participations].sort((a, b) => a.order - b.order),
    [expense.participations],
  )
  const policy = useMemo(() => deriveExpenseActionPolicy({
    expense,
    currentParticipantId,
    spaceRole,
    pendingRequest,
  }), [currentParticipantId, expense, pendingRequest, spaceRole])

  const openSheet = () => {
    setDescription(expense.description ?? '')
    setCategory(expense.category)
    setOccurredOn(expense.occurredOn)
    setTotal(minorInput(expense.totalMinor, expense.currency))
    setCurrency(expense.currency)
    setPaid(amountInputs(expense, 'paid'))
    setShares(amountInputs(expense, 'share'))
    setReviewing(false)
    setMode('menu')
    setError('')
    setMessage('')
    setFailClosed(false)
    setOpen(true)
  }

  if (policy.actions.length === 0) return null

  const expenseName = expense.description ?? t(categoryKey(expense.category))
  const begin = (action: ExpenseAction) => {
    setError('')
    setMessage('')
    setReviewing(false)
    setMode(actionMode(action, expense.scope))
  }

  const changeTotal = (value: string) => {
    setTotal(value)
    try {
      const nextTotal = parseMajorAmount(value, currency)
      setPaid(rescaledInputs(expense, 'paid', nextTotal))
      setShares(rescaledInputs(expense, 'share', nextTotal))
    } catch {
      // Keep the user's partial input; validation runs before review/submit.
    }
  }

  const submitMetadata = async () => {
    await runMutation(async () => {
      await ledgerRepository.updateExpenseMetadata({
        expenseId: expense.id,
        expectedVersion: expense.version,
        description: description.trim() || null,
        category,
        occurredOn,
      })
    })
  }

  const buildPayload = (): ExpenseFinancialPayload => {
    const totalMinor = parseMajorAmount(total, currency)
    const participantIds = orderedParticipations.map((item) => item.participantId)
    const contributionAmounts = participantIds.map((id) => (
      parseNonnegativeMajor(paid[id] ?? '', currency)
    ))
    const shareAmounts = participantIds.map((id) => (
      parseNonnegativeMajor(shares[id] ?? '', currency)
    ))
    reconcileMinorAmounts(
      Object.fromEntries(participantIds.map((id, index) => [
        id,
        contributionAmounts[index],
      ])),
      totalMinor,
    )
    reconcileMinorAmounts(
      Object.fromEntries(participantIds.map((id, index) => [
        id,
        shareAmounts[index],
      ])),
      totalMinor,
    )
    return {
      totalMinor,
      currency: currency.toUpperCase(),
      description: description.trim() || null,
      category,
      occurredOn,
      participantIds,
      contributionAmounts,
      shareAmounts,
    }
  }

  const reviewFinancialChange = () => {
    try {
      buildPayload()
      setError('')
      if (mode === 'correction' || mode === 'space_correction') {
        setReviewing(true)
      } else {
        void submitFinancialChange()
      }
    } catch {
      setError('expenseAction.amountsMustReconcile')
    }
  }

  const submitFinancialChange = async () => {
    let payload: ExpenseFinancialPayload
    try {
      payload = buildPayload()
    } catch {
      setError('expenseAction.amountsMustReconcile')
      return
    }
    await runMutation(async () => {
      if (mode === 'financial') {
        await ledgerRepository.replaceExpenseFinancials({
          expenseId: expense.id,
          expectedVersion: expense.version,
          totalMinor: payload.totalMinor,
          currency: payload.currency,
          participantIds: payload.participantIds,
          contributionAmounts: payload.contributionAmounts,
          shareAmounts: payload.shareAmounts,
        })
      } else if (mode === 'correction') {
        await expenseChangeRepository.proposeDirectChange({
          requestId: generateId(),
          targetExpenseId: expense.id,
          expectedTargetVersion: expense.version,
          kind: 'correction',
          replacement: payload,
        })
      } else {
        await expenseChangeRepository.correctSpaceExpense({
          requestId: generateId(),
          targetExpenseId: expense.id,
          expectedVersion: expense.version,
          replacement: payload,
        })
      }
    })
  }

  const submitCancellation = async () => {
    await runMutation(async () => {
      if (mode === 'request_cancellation') {
        await expenseChangeRepository.proposeDirectChange({
          requestId: generateId(),
          targetExpenseId: expense.id,
          expectedTargetVersion: expense.version,
          kind: 'cancellation',
        })
      } else {
        if (onCancelExpense) await onCancelExpense(expense.id)
        else await ledgerRepository.voidExpense(expense.id, expense.version)
      }
    })
  }

  const runMutation = async (mutation: () => Promise<void>) => {
    if (saving || failClosed) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await mutation()
      await onRefresh()
      setOpen(false)
    } catch (cause) {
      const disposition = financialFailureDisposition(machineCode(cause))
      if (disposition === 'fail_closed') setFailClosed(true)
      if (disposition === 'refetch') {
        await onRefresh()
        setMessage('changeRequest.changedRefresh')
      }
      setError(friendlyErrorKey(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        className="ms-btn-ghost min-h-10 px-3 py-2 text-xs"
        aria-label={t('expenseAction.open', { name: expenseName })}
        onClick={openSheet}
      >
        •••
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/35 sm:items-center sm:p-4">
          <div className="absolute inset-0" aria-hidden="true" onClick={() => setOpen(false)} />
          <section
            ref={dialogRef}
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-[var(--ms-surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`expense-action-${expense.id}`}
            tabIndex={-1}
          >
            <header className="flex items-start justify-between gap-4">
              <div>
                <p className="ms-label">{t('expenseAction.actions')}</p>
                <h2 id={`expense-action-${expense.id}`} className="mt-1 text-2xl font-extrabold">
                  {expenseName}
                </h2>
              </div>
              <button
                className="ms-btn-ghost h-11 w-11 shrink-0 p-0"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </header>

            {message ? (
              <p className="mt-4 text-sm font-bold text-[var(--ms-info)]">{t(message)}</p>
            ) : null}
            {error ? (
              <p className="mt-4 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
                {t(error)}
              </p>
            ) : statusNotice ? (
              <p className="mt-4 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]" role="alert">
                {statusNotice}
              </p>
            ) : null}

            {mode === 'menu' ? (
              <div className="mt-5 grid w-full gap-3" data-testid="expense-action-menu">
                {policy.actions.map((action) => (
                  <button
                    key={action}
                    data-testid={`expense-action-${action}`}
                    className={`w-full whitespace-normal text-left ${action === 'cancel' || action === 'request_cancellation'
                      ? 'ms-btn-ghost text-[var(--ms-danger)]'
                      : 'ms-btn-ghost'}`}
                    disabled={failClosed}
                    onClick={() => begin(action)}
                  >
                    {t(actionLabel(action))}
                  </button>
                ))}
              </div>
            ) : null}

            {mode === 'metadata' ? (
              <MetadataFields
                description={description}
                category={category}
                occurredOn={occurredOn}
                onDescription={setDescription}
                onCategory={setCategory}
                onOccurredOn={setOccurredOn}
              />
            ) : null}

            {(mode === 'financial' || mode === 'correction' || mode === 'space_correction')
              && !reviewing ? (
                <div className="mt-5">
                  {mode !== 'financial' ? (
                    <div className="mb-4 rounded-2xl bg-[var(--ms-accent-bg)] p-3 text-sm">
                      <p className="font-bold">{t('expenseAction.currencyLocked')}</p>
                      <p className="mt-1 text-[var(--ms-text-secondary)]">
                        {t('expenseAction.cancelAndNew')}
                      </p>
                    </div>
                  ) : policy.financialEditRequiresReconfirmation ? (
                    <p className="mb-4 rounded-2xl bg-[var(--ms-info-bg)] p-3 text-sm font-bold text-[var(--ms-info)]">
                      {t('expenseAction.reconfirmWarning')}
                    </p>
                  ) : null}

                  {mode !== 'financial' ? (
                    <MetadataFields
                      description={description}
                      category={category}
                      occurredOn={occurredOn}
                      onDescription={setDescription}
                      onCategory={setCategory}
                      onOccurredOn={setOccurredOn}
                    />
                  ) : null}

                  <div className={mode !== 'financial' ? 'mt-4' : ''}>
                    <div className="grid grid-cols-[1fr_7rem] gap-3">
                      <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
                        {t('expenseAction.amount')}
                        <input
                          className="ms-input mt-1 w-full"
                          value={total}
                          inputMode="decimal"
                          onChange={(event) => changeTotal(event.target.value)}
                        />
                      </label>
                      <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
                        {t('expenseAction.currency')}
                        <input
                          className="ms-input mt-1 w-full"
                          value={currency}
                          readOnly={mode !== 'financial'}
                          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                        />
                      </label>
                    </div>

                    <p className="ms-label mt-5">{t('expenseAction.participantAmounts')}</p>
                    <div className="mt-2 grid gap-3">
                      {orderedParticipations.map((participation) => (
                        <div key={participation.id} className="rounded-2xl bg-[var(--ms-bg-warm)] p-3">
                          <p className="font-bold">{participation.nameSnapshot}</p>
                          <div className="mt-2 grid grid-cols-2 gap-3">
                            <label className="text-xs text-[var(--ms-text-secondary)]">
                              {t('expenseAction.paidBy', { name: participation.nameSnapshot })}
                              <input
                                className="ms-input mt-1 w-full"
                                inputMode="decimal"
                                aria-label={t('expenseAction.paidBy', { name: participation.nameSnapshot })}
                                value={paid[participation.participantId] ?? ''}
                                onChange={(event) => setPaid((current) => ({
                                  ...current,
                                  [participation.participantId]: event.target.value,
                                }))}
                              />
                            </label>
                            <label className="text-xs text-[var(--ms-text-secondary)]">
                              {t('expenseAction.shareFor', { name: participation.nameSnapshot })}
                              <input
                                className="ms-input mt-1 w-full"
                                inputMode="decimal"
                                aria-label={t('expenseAction.shareFor', { name: participation.nameSnapshot })}
                                value={shares[participation.participantId] ?? ''}
                                onChange={(event) => setShares((current) => ({
                                  ...current,
                                  [participation.participantId]: event.target.value,
                                }))}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

            {reviewing ? (
              <div className="mt-5">
                <p className="ms-label">{t('expenseAction.reviewCorrection')}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[var(--ms-bg-warm)] p-4">
                    <p className="text-xs font-bold text-[var(--ms-text-muted)]">{t('expenseAction.current')}</p>
                    <p className="mt-2 font-extrabold">{expenseName}</p>
                    <p className="mt-1 text-xl font-extrabold">
                      {formatMinorAmount(expense.totalMinor, expense.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--ms-border)] p-4">
                    <p className="text-xs font-bold text-[var(--ms-accent)]">
                      {t(mode === 'space_correction'
                        ? 'expenseAction.corrected'
                        : 'expenseAction.proposed')}
                    </p>
                    <p className="mt-2 font-extrabold">{description || t(categoryKey(category))}</p>
                    <p className="mt-1 text-xl font-extrabold">
                      {formatMinorAmount(parseMajorAmount(total, currency), currency)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--ms-text-secondary)]">
                  {t('expenseAction.unchangedPrincipals')}
                </p>
                {mode === 'correction' ? (
                  <p className="mt-2 text-sm font-bold">{t('expenseAction.noEffectUntilApproved')}</p>
                ) : null}
              </div>
            ) : null}

            {(mode === 'cancel' || mode === 'request_cancellation') ? (
              <div className="mt-5 rounded-2xl bg-[var(--ms-danger-bg)] p-4">
                <p className="font-extrabold">
                  {t(mode === 'cancel'
                    ? 'expenseAction.cancelExpense'
                    : 'expenseAction.requestCancellation')}
                </p>
                <p className="mt-2 text-sm text-[var(--ms-text-secondary)]">
                  {t(mode === 'cancel'
                    ? 'expenseAction.cancelHelp'
                    : 'expenseAction.cancellationRequestHelp')}
                </p>
              </div>
            ) : null}

            {mode === 'view_request' ? (
              <p className="mt-5 rounded-2xl bg-[var(--ms-info-bg)] p-4 text-sm font-bold text-[var(--ms-info)]">
                {t('expenseAction.requestFrozen')}
              </p>
            ) : null}

            {mode !== 'menu' ? (
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  className="ms-btn-ghost"
                  disabled={saving}
                  onClick={() => reviewing ? setReviewing(false) : setMode('menu')}
                >
                  {t('common.back')}
                </button>
                {mode === 'metadata' ? (
                  <button className="ms-btn-primary" disabled={saving || failClosed} onClick={() => void submitMetadata()}>
                    {saving ? t('expenseAction.saving') : t('expenseAction.saveDetails')}
                  </button>
                ) : mode === 'financial' || mode === 'correction' || mode === 'space_correction' ? (
                  <button
                    className="ms-btn-primary"
                    disabled={saving || failClosed}
                    onClick={() => reviewing ? void submitFinancialChange() : reviewFinancialChange()}
                  >
                    {saving
                      ? t('expenseAction.saving')
                      : reviewing
                        ? t(mode === 'space_correction'
                          ? 'expenseAction.submitSpaceCorrection'
                          : 'expenseAction.submitCorrection')
                        : mode === 'financial'
                          ? t('expenseAction.saveExpense')
                          : t('expenseAction.reviewCorrection')}
                  </button>
                ) : mode === 'cancel' || mode === 'request_cancellation' ? (
                  <button
                    className="ms-btn-primary"
                    disabled={saving || failClosed}
                    onClick={() => void submitCancellation()}
                  >
                    {saving
                      ? t('expenseAction.saving')
                      : t(mode === 'cancel'
                        ? 'expenseAction.confirmCancel'
                        : 'expenseAction.sendCancellationRequest')}
                  </button>
                ) : <span />}
              </div>
            ) : null}
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

function MetadataFields({
  description,
  category,
  occurredOn,
  onDescription,
  onCategory,
  onOccurredOn,
}: {
  description: string
  category: string
  occurredOn: string
  onDescription: (value: string) => void
  onCategory: (value: string) => void
  onOccurredOn: (value: string) => void
}) {
  const t = useT()
  return (
    <div className="mt-5 grid gap-4">
      <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
        {t('expenseAction.description')}
        <input
          className="ms-input mt-1 w-full"
          value={description}
          onChange={(event) => onDescription(event.target.value)}
        />
      </label>
      <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
        {t('expenseAction.category')}
        <select
          className="ms-input mt-1 w-full"
          value={category}
          onChange={(event) => onCategory(event.target.value)}
        >
          {SELECTABLE_EXPENSE_CATEGORIES.map((item) => (
            <option key={item} value={item}>{t(categoryKey(item))}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold text-[var(--ms-text-secondary)]">
        {t('expenseAction.date')}
        <input
          className="ms-input mt-1 w-full"
          type="date"
          value={occurredOn}
          onChange={(event) => onOccurredOn(event.target.value)}
        />
      </label>
    </div>
  )
}

function actionMode(action: ExpenseAction, scope: CanonicalExpense['scope']): EditorMode {
  if (action === 'edit_metadata') return 'metadata'
  if (action === 'edit_financials') return 'financial'
  if (action === 'propose_correction') {
    return scope === 'space' ? 'space_correction' : 'correction'
  }
  return action
}

function actionLabel(action: ExpenseAction): TranslationKey {
  const keys: Record<ExpenseAction, TranslationKey> = {
    edit_metadata: 'expenseAction.editDetails',
    edit_financials: 'expenseAction.editExpense',
    propose_correction: 'expenseAction.correctExpense',
    cancel: 'expenseAction.cancelExpense',
    request_cancellation: 'expenseAction.requestCancellation',
    view_request: 'expenseAction.viewRequest',
  }
  return keys[action]
}

function amountInputs(
  expense: CanonicalExpense,
  kind: 'paid' | 'share',
): Record<string, string> {
  return Object.fromEntries(expense.participations.map((participation) => {
    const source = kind === 'paid' ? expense.payerContributions : expense.shares
    const amount = source.find((item) => (
      item.expenseParticipationId === participation.id
    ))?.amountMinor ?? 0
    return [participation.participantId, minorInput(amount, expense.currency)]
  }))
}

function rescaledInputs(
  expense: CanonicalExpense,
  kind: 'paid' | 'share',
  nextTotalMinor: number,
): Record<string, string> {
  const ordered = [...expense.participations].sort((a, b) => a.order - b.order)
  const source = kind === 'paid' ? expense.payerContributions : expense.shares
  const amounts = ordered.map((participation) => source.find((item) => (
    item.expenseParticipationId === participation.id
  ))?.amountMinor ?? 0)
  const scaled = rescaleMinorAmounts(amounts, expense.totalMinor, nextTotalMinor)
  return Object.fromEntries(ordered.map((participation, index) => [
    participation.participantId,
    minorInput(scaled[index], expense.currency),
  ]))
}

function minorInput(amountMinor: number, currency: string): string {
  const exponent = currencyExponent(currency)
  return (amountMinor / 10 ** exponent).toFixed(exponent)
}

function parseNonnegativeMajor(value: string, currency: string): number {
  if (/^0+(?:\.0*)?$/.test(value.trim())) return 0
  return parseMajorAmount(value, currency)
}
