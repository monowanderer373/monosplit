import { useState } from 'react'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { friendlyErrorKey, useT, type TranslationKey } from '../lib/i18n'

export default function ExpenseRecoveryNotices() {
  const t = useT()
  const ledger = usePersonalLedger()
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<TranslationKey | ''>('')

  const restoreCancellation = async () => {
    if (restoring) return
    setRestoring(true)
    setError('')
    try {
      await ledger.restoreOwnerLocalCancellation()
    } catch (cause) {
      setError(friendlyErrorKey(cause))
      ledger.clearRestoreCandidate()
      await ledger.refresh()
    } finally {
      setRestoring(false)
    }
  }

  if (!ledger.discardUndo && !ledger.restoreCandidate && !error) return null

  return (
    <section
      className="mx-auto mt-4 max-w-3xl rounded-2xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-4"
      aria-live="polite"
    >
      {ledger.discardUndo ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold">{t('ledger.discardedBeforeSync')}</p>
          <button
            className="ms-btn-ghost shrink-0 py-2 text-sm"
            onClick={() => void ledger.undoLocalDiscard()}
          >
            {t('common.undo')}
          </button>
        </div>
      ) : null}
      {ledger.restoreCandidate ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold">
            {t('ledger.ownerLocalCancelled', {
              name: ledger.restoreCandidate.description ?? t('ledger.expense'),
            })}
          </p>
          <button
            className="ms-btn-ghost shrink-0 py-2 text-sm"
            disabled={restoring}
            onClick={() => void restoreCancellation()}
          >
            {restoring ? t('ledger.restoring') : t('ledger.undoCancellation')}
          </button>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm font-bold text-[var(--ms-danger)]">{t(error)}</p>
      ) : null}
    </section>
  )
}
