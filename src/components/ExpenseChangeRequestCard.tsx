import { useMemo, useState } from 'react'
import type { CanonicalExpense } from '../types'
import {
  expenseChangeRepository,
  type DirectExpenseChangeRequest,
} from '../lib/expenseChangeRepository'
import {
  deriveDirectChangeHistoryState,
  deriveDirectChangePresentation,
} from '../lib/expenseChangePresentation'
import {
  financialFailureDisposition,
} from '../lib/expenseActionPolicy'
import {
  friendlyErrorKey,
  machineCode,
  useT,
  type TranslationKey,
} from '../lib/i18n'
import { formatMinorAmount } from '../lib/money'

type Props = {
  request: DirectExpenseChangeRequest
  targetExpense: CanonicalExpense
  replacementExpense: CanonicalExpense | null
  currentParticipantId: string
  onRefresh: () => Promise<unknown>
}

export default function ExpenseChangeRequestCard({
  request,
  targetExpense,
  replacementExpense,
  currentParticipantId,
  onRefresh,
}: Props) {
  const t = useT()
  const [action, setAction] = useState('')
  const [error, setError] = useState<TranslationKey | ''>('')
  const [message, setMessage] = useState<TranslationKey | ''>('')
  const [failClosed, setFailClosed] = useState(false)
  const presentation = useMemo(() => deriveDirectChangePresentation({
    request,
    targetExpense,
    replacementExpense,
    currentParticipantId,
  }), [currentParticipantId, replacementExpense, request, targetExpense])
  const historyState = deriveDirectChangeHistoryState(request)

  const respond = async (response: 'accepted' | 'declined') => {
    if (action || failClosed) return
    setAction(response)
    setError('')
    setMessage('')
    try {
      await expenseChangeRepository.respondToDirectChange({
        requestId: request.id,
        response,
        expectedRequestVersion: request.version,
      })
      await onRefresh()
    } catch (cause) {
      await handleFailure(cause)
    } finally {
      setAction('')
    }
  }

  const withdraw = async () => {
    if (action || failClosed) return
    setAction('withdraw')
    setError('')
    setMessage('')
    try {
      await expenseChangeRepository.cancelDirectChange(request.id, request.version)
      await onRefresh()
    } catch (cause) {
      await handleFailure(cause)
    } finally {
      setAction('')
    }
  }

  const handleFailure = async (cause: unknown) => {
    const disposition = financialFailureDisposition(machineCode(cause))
    if (disposition === 'fail_closed') setFailClosed(true)
    if (disposition === 'refetch') {
      await onRefresh()
      setMessage('changeRequest.changedRefresh')
    }
    setError(friendlyErrorKey(cause))
  }

  const pending = request.state === 'pending'
  const currentAmount = presentation.currentExpense
    ? formatMinorAmount(
      presentation.currentExpense.totalMinor,
      presentation.currentExpense.currency,
    )
    : null
  const proposalAmount = presentation.proposedExpense
    ? formatMinorAmount(
      presentation.proposedExpense.totalMinor,
      presentation.proposedExpense.currency,
    )
    : null

  return (
    <article
      className="ms-card-hero"
      data-testid={`expense-change-${request.clientRequestId}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="ms-label">{t('changeRequest.label')}</p>
          <h3 className="mt-1 font-extrabold">
            {t(changeHistoryTitleKey(historyState))}
          </h3>
        </div>
        <span className="rounded-full bg-[var(--ms-info-bg)] px-2 py-1 text-xs font-bold text-[var(--ms-info)]">
          {t(request.state === 'pending'
            ? 'changeRequest.statusPending'
            : request.state === 'declined'
              ? 'changeRequest.statusDeclined'
              : request.state === 'cancelled'
                ? 'changeRequest.statusWithdrawn'
                : request.kind === 'correction'
                  ? 'changeRequest.statusCorrected'
                  : 'changeRequest.statusCancelled')}
        </span>
      </div>

      {!pending ? (
        <p className="mt-3 font-extrabold">
          {replacementExpense?.description
            ?? targetExpense.description
            ?? targetExpense.category}
        </p>
      ) : null}

      {pending ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-[var(--ms-bg-warm)] p-3">
            <p className="text-xs font-bold text-[var(--ms-text-muted)]">
              {t('changeRequest.currentExpense')}
            </p>
            <p className="mt-1 font-extrabold">
              {targetExpense.description ?? targetExpense.category}
            </p>
            <p className="mt-1 text-lg font-extrabold">
              {formatMinorAmount(targetExpense.totalMinor, targetExpense.currency)}
            </p>
          </div>
          {presentation.proposedExpense ? (
            <div className="rounded-2xl border border-[var(--ms-accent)]/30 bg-[var(--ms-surface)] p-3">
              <p className="text-xs font-bold text-[var(--ms-accent)]">
                {t('expenseAction.proposed')}
              </p>
              <p className="mt-1 font-extrabold">
                {presentation.proposedExpense.description
                  ?? presentation.proposedExpense.category}
              </p>
              <p className="mt-1 text-lg font-extrabold">{proposalAmount}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--ms-danger)]/20 bg-[var(--ms-surface)] p-3 text-sm">
              {t('expenseAction.cancellationRequestHelp')}
            </div>
          )}
        </div>
      ) : null}

      {pending && currentAmount ? (
        <p className="mt-3 text-sm font-bold text-[var(--ms-text-secondary)]">
          {t('changeRequest.currentStillApplies', { amount: currentAmount })}
        </p>
      ) : null}

      {pending ? (
        <p className="mt-2 text-xs text-[var(--ms-text-muted)]">
          {presentation.hasCompleteApprovalProgress
            ? t('changeRequest.approvalProgress', {
              approved: presentation.approvedCount,
              total: presentation.visibleApprovalCount,
            })
            : t('changeRequest.waitingAll')}
        </p>
      ) : request.state === 'authoritative' && request.kind === 'correction' ? (
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-xl bg-[var(--ms-bg-warm)] p-3">
            {t('changeRequest.superseded')} · {formatMinorAmount(
              targetExpense.totalMinor,
              targetExpense.currency,
            )}
          </p>
          {replacementExpense ? (
            <p className="rounded-xl bg-[var(--ms-success-bg)] p-3 font-bold text-[var(--ms-success)]">
              {t('changeRequest.currentReplacement')} · {formatMinorAmount(
                replacementExpense.totalMinor,
                replacementExpense.currency,
              )}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          {request.kind === 'correction' && replacementExpense ? (
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <p className="rounded-xl bg-[var(--ms-bg-warm)] p-3 font-bold">
                {t('changeRequest.currentExpense')} · {formatMinorAmount(
                  targetExpense.totalMinor,
                  targetExpense.currency,
                )}
              </p>
              <p className="rounded-xl border border-[var(--ms-border)] p-3">
                {t('expenseAction.proposed')} · {formatMinorAmount(
                  replacementExpense.totalMinor,
                  replacementExpense.currency,
                )}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-[var(--ms-text-secondary)]">
            {t(changeHistoryHelpKey(historyState))}
          </p>
        </>
      )}

      {message ? (
        <p className="mt-3 text-sm font-bold text-[var(--ms-info)]">{t(message)}</p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-xl bg-[var(--ms-danger-bg)] px-3 py-2 text-sm text-[var(--ms-danger)]">
          {t(error)}
        </p>
      ) : null}

      {presentation.canRespond && !failClosed ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            className="ms-btn-ghost"
            disabled={Boolean(action)}
            onClick={() => void respond('declined')}
          >
            {t(request.kind === 'correction'
              ? 'changeRequest.declineCorrection'
              : 'changeRequest.declineCancellation')}
          </button>
          <button
            className="ms-btn-primary"
            disabled={Boolean(action)}
            onClick={() => void respond('accepted')}
          >
            {t(request.kind === 'correction'
              ? 'changeRequest.acceptCorrection'
              : 'changeRequest.approveCancellation')}
          </button>
        </div>
      ) : null}

      {presentation.canWithdraw && !failClosed ? (
        <button
          className="ms-btn-ghost mt-4 w-full"
          disabled={Boolean(action)}
          onClick={() => void withdraw()}
        >
          {t(request.kind === 'correction'
            ? 'changeRequest.withdrawCorrection'
            : 'changeRequest.withdrawCancellation')}
        </button>
      ) : null}
    </article>
  )
}

function changeHistoryTitleKey(
  state: ReturnType<typeof deriveDirectChangeHistoryState>,
) {
  const keys = {
    correction_proposed: 'changeRequest.correctionProposed',
    correction_approved: 'changeRequest.correctionApproved',
    correction_declined: 'changeRequest.correctionDeclined',
    correction_withdrawn: 'changeRequest.correctionWithdrawn',
    cancellation_requested: 'changeRequest.cancellationRequested',
    expense_cancelled: 'changeRequest.expenseCancelled',
    cancellation_declined: 'changeRequest.cancellationDeclined',
    cancellation_withdrawn: 'changeRequest.cancellationWithdrawn',
  } as const
  return keys[state]
}

function changeHistoryHelpKey(
  state: ReturnType<typeof deriveDirectChangeHistoryState>,
) {
  const keys = {
    correction_proposed: 'changeRequest.currentStillApplies',
    correction_approved: 'changeRequest.corrected',
    correction_declined: 'changeRequest.correctionDeclinedHelp',
    correction_withdrawn: 'changeRequest.correctionWithdrawnHelp',
    cancellation_requested: 'expenseAction.cancellationRequestHelp',
    expense_cancelled: 'changeRequest.cancelled',
    cancellation_declined: 'changeRequest.cancellationDeclinedHelp',
    cancellation_withdrawn: 'changeRequest.cancellationWithdrawnHelp',
  } as const
  return keys[state]
}
