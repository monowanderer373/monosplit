import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import { usePersonalLedger } from '../hooks/usePersonalLedger'
import { useUniversalQuickAdd } from '../hooks/useUniversalQuickAdd'
import { useT } from '../lib/i18n'
import { contextRankSurfaceForPath } from '../lib/moneyContext'
import { recordProductEvent } from '../lib/productEvents'
import ContextGate from './ContextGate'
import UniversalQuickAddSheet from './UniversalQuickAddSheet'
import PaperSheet from './navigation/PaperSheet'

function LoadingAction({ onClose }: { onClose: () => void }) {
  const t = useT()
  const dialogRef = useAccessibleDialog<HTMLElement>(onClose)
  return (
    <PaperSheet label={t('contextGate.loading')} dialogRef={dialogRef} onClose={onClose}>
        <p className="text-sm font-bold text-[var(--ms-text-secondary)]">{t('contextGate.loading')}</p>
        <button className="ms-btn-ghost mt-4" onClick={onClose}>{t('common.close')}</button>
    </PaperSheet>
  )
}

export default function GlobalMoneyActionHost() {
  const location = useLocation()
  const { authUser } = useAuth()
  const ledger = usePersonalLedger()
  const quickAdd = useUniversalQuickAdd()
  const action = quickAdd.action
  const recordedStart = useRef<number | null>(null)

  useEffect(() => {
    if (!action || !authUser?.participantId || recordedStart.current === action.startedAtMs) return
    recordedStart.current = action.startedAtMs
    void recordProductEvent({
      participantId: authUser.participantId,
      eventName: 'quick_add_started',
      source: quickAdd.session?.captureSource ?? 'manual',
      metadata: {
        entry: action.step === 'capture' && action.directDeepLink
          ? new URLSearchParams(location.search).get('source') ?? 'deep-link'
          : quickAdd.session?.entryPoint ?? 'global',
      },
    })
  }, [
    action,
    authUser?.participantId,
    location.search,
    quickAdd.session?.captureSource,
    quickAdd.session?.entryPoint,
  ])

  if (!action || !authUser?.participantId) return null

  if (action.step === 'gate') {
    return (
      <ContextGate
        isAnonymous={Boolean(authUser.isAnonymous)}
        excludedSpaceId={action.excludedSpaceId}
        destination={contextRankSurfaceForPath(location.pathname)}
        expenses={ledger.expenses}
        resolving={quickAdd.resolving}
        contextError={quickAdd.contextError}
        onSelect={quickAdd.selectEntryContext}
        onClose={quickAdd.close}
      />
    )
  }

  if (action.step === 'switch-picker') {
    return (
      <ContextGate
        isAnonymous={Boolean(authUser.isAnonymous)}
        mode="switch"
        destination={contextRankSurfaceForPath(location.pathname)}
        expenses={ledger.expenses}
        resolving={quickAdd.resolving}
        contextError={quickAdd.contextError}
        pendingSwitch={quickAdd.pendingSwitch}
        onSelect={quickAdd.requestContextSwitch}
        onConfirmSwitch={quickAdd.confirmContextSwitch}
        onCancelSwitchWarning={quickAdd.cancelContextSwitchWarning}
        onClose={quickAdd.cancelPicker}
      />
    )
  }

  if (action.step === 'resolve-space' || action.step === 'resolve-person') {
    return <LoadingAction onClose={quickAdd.close} />
  }

  if (action.step === 'resolve-context') {
    return (
      <LoadingAction
        onClose={
          action.mode === 'switch'
            ? quickAdd.cancelPicker
            : quickAdd.close
        }
      />
    )
  }

  if (!quickAdd.session?.context) return <LoadingAction onClose={quickAdd.close} />

  return (
    <UniversalQuickAddSheet
      session={quickAdd.session}
      expenses={ledger.expenses}
      onUpdate={quickAdd.updateValues}
      onOpenContextPicker={quickAdd.openSwitchPicker}
      onClose={quickAdd.close}
      onSubmit={quickAdd.submit}
    />
  )
}
