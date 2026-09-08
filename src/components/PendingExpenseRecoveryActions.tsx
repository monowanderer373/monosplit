import type { PendingLedgerCommand } from '../store/useStore'
import { useT } from '../lib/i18n'

export default function PendingExpenseRecoveryActions({
  item,
  onUndoAdd,
  onRetry,
  onDiscardFailed,
}: {
  item: PendingLedgerCommand
  onUndoAdd: (requestId: string) => boolean
  onRetry: (requestId: string) => Promise<void>
  onDiscardFailed: (requestId: string) => boolean
}) {
  const t = useT()
  const canUndoAdd = (
    item.status === 'pending'
    && item.attempts === 0
    && item.commitState === 'not_started'
  )

  if (canUndoAdd) {
    return (
      <button
        className="min-h-9 px-2 text-xs font-extrabold text-[var(--ms-danger)]"
        onClick={() => onUndoAdd(item.command.requestId)}
      >
        {t('ledger.undoAdd')}
      </button>
    )
  }

  if (item.status === 'retrying') {
    return (
      <span className="px-2 text-xs font-bold text-[var(--ms-text-muted)]">
        {t('ledger.syncInProgress')}
      </span>
    )
  }

  if (item.status !== 'rejected') return null

  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      <button
        className="min-h-9 px-2 text-xs font-extrabold text-[var(--ms-accent)]"
        onClick={() => void onRetry(item.command.requestId)}
      >
        {t('common.retry')}
      </button>
      {item.commitState === 'not_committed' ? (
        <button
          className="min-h-9 px-2 text-xs font-extrabold text-[var(--ms-danger)]"
          onClick={() => onDiscardFailed(item.command.requestId)}
        >
          {t('ledger.discardFailed')}
        </button>
      ) : (
        <span className="text-[10px] font-bold text-[var(--ms-text-muted)]">
          {t('ledger.outcomeUnknown')}
        </span>
      )}
    </span>
  )
}
