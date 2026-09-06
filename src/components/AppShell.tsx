import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PersonalLedgerProvider } from '../hooks/usePersonalLedger'
import {
  UniversalQuickAddProvider,
  useUniversalQuickAdd,
} from '../hooks/useUniversalQuickAdd'
import { useT } from '../lib/i18n'
import { resolveRouteMoneyContext } from '../lib/moneyContext'
import { saveFeedbackLabel } from '../lib/universalQuickAdd'
import BottomNavigation from './BottomNavigation'
import GlobalMoneyActionHost from './GlobalMoneyActionHost'

function ShellContents() {
  const t = useT()
  const { authUser } = useAuth()
  const location = useLocation()
  const directQuickAddArmed = useRef(false)
  const quickAdd = useUniversalQuickAdd()

  const personalContext = useMemo(() => authUser?.participantId
    ? ({
        ref: { kind: 'personal' as const },
        currentParticipantId: authUser.participantId,
        availableParticipants: [{
          id: authUser.participantId,
          displayName: authUser.displayName ?? authUser.email ?? t('common.me'),
          kind: 'account' as const,
        }],
        defaultCurrency: authUser.defaultCurrency ?? 'MYR',
      })
    : null, [authUser, t])

  useEffect(() => {
    if (
      location.pathname !== '/quick-add'
      || quickAdd.action
      || !authUser?.participantId
      || authUser.isAnonymous
      || directQuickAddArmed.current
      || !personalContext
    ) return

    directQuickAddArmed.current = true
    quickAdd.open({
      entryPoint: 'global',
      context: personalContext,
      directDeepLink: true,
    })
  }, [
    authUser?.isAnonymous,
    authUser?.participantId,
    location.pathname,
    personalContext,
    quickAdd,
  ])

  const openGlobalAdd = useCallback(() => {
    const resolved = resolveRouteMoneyContext(location.pathname)
    if (resolved.kind === 'personal' && !authUser?.isAnonymous && personalContext) {
      quickAdd.open({ entryPoint: 'global', context: personalContext })
      return
    }
    if (resolved.kind === 'space-candidate') {
      quickAdd.open({
        entryPoint: 'global',
        spaceCandidateId: resolved.spaceId,
      })
      return
    }
    quickAdd.open({ entryPoint: 'global' })
  }, [
    authUser?.isAnonymous,
    location.pathname,
    personalContext,
    quickAdd,
  ])

  const showNavigation = Boolean(authUser?.participantId)

  return (
    <>
      <Outlet />
      {showNavigation ? <BottomNavigation onAdd={openGlobalAdd} /> : null}
      <GlobalMoneyActionHost />
      {quickAdd.feedback ? (
        <div
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[var(--ms-text)] px-4 py-3 text-sm font-bold text-[var(--ms-surface)] shadow-xl"
          role="status"
          onClick={quickAdd.clearFeedback}
        >
          {saveFeedbackLabel(quickAdd.feedback, t)}
        </div>
      ) : null}
    </>
  )
}

function IdentityQuickAddProvider({ children }: { children: ReactNode }) {
  const { authUser } = useAuth()
  const identityKey = authUser?.id ?? 'signed-out'
  return (
    <UniversalQuickAddProvider key={identityKey} identityKey={identityKey}>
      {children}
    </UniversalQuickAddProvider>
  )
}

export default function AppShell() {
  return (
    <PersonalLedgerProvider>
      <IdentityQuickAddProvider>
        <ShellContents />
      </IdentityQuickAddProvider>
    </PersonalLedgerProvider>
  )
}
