import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PersonalLedgerProvider } from '../hooks/usePersonalLedger'
import {
  UniversalQuickAddProvider,
  useUniversalQuickAdd,
} from '../hooks/useUniversalQuickAdd'
import { useT } from '../lib/i18n'
import { useStore } from '../store/useStore'
import { resolveRouteMoneyContext } from '../lib/moneyContext'
import { saveFeedbackLabel } from '../lib/universalQuickAdd'
import BottomNavigation from './BottomNavigation'
import GlobalMoneyAction from './GlobalMoneyAction'
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
    if (location.pathname !== '/quick-add') {
      directQuickAddArmed.current = false
      return
    }
    if (
      quickAdd.action
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

  const homeMode = useStore((state) => state.homeUi.mode)
  const travelHome = location.pathname === '/' && homeMode === 'travel'
  const pageTarget = quickAdd.pageTarget?.pathname === location.pathname ? quickAdd.pageTarget : null
  const targetPending = travelHome && !pageTarget?.ready

  const openGlobalAdd = useCallback(() => {
    if (targetPending) return
    const resolved = travelHome && pageTarget ? pageTarget.target : resolveRouteMoneyContext(location.pathname)
    if (resolved.kind === 'personal' && !authUser?.isAnonymous && personalContext) {
      quickAdd.open({ entryPoint: 'global', context: personalContext, followPageContext: true })
      return
    }
    if (resolved.kind === 'space-candidate') {
      quickAdd.open({
        entryPoint: 'global',
        spaceCandidateId: resolved.spaceId,
        followPageContext: true,
      })
      return
    }
    if (resolved.kind === 'person-candidate') {
      quickAdd.open({
        entryPoint: 'global',
        personCandidateId: resolved.personId,
        followPageContext: true,
      })
      return
    }
    quickAdd.open({ entryPoint: 'global', context: personalContext, followPageContext: true })
  }, [
    authUser?.isAnonymous,
    location.pathname,
    personalContext,
    quickAdd,
    targetPending,
    travelHome,
    pageTarget,
  ])

  const showNavigation = Boolean(authUser?.participantId) && !location.pathname.startsWith('/travel/trip/')
  const place = (location.pathname === '/' && homeMode === 'travel') || location.pathname.startsWith('/travel/') ? 'bali' : 'home'
  useEffect(() => {
    document.documentElement.dataset.place = place
  }, [place])

  return (
    <>
      <Outlet />
      {showNavigation ? (
        <>
          <BottomNavigation />
        </>
      ) : null}
      {authUser?.participantId ? <GlobalMoneyAction onAdd={openGlobalAdd} composerOpen={Boolean(quickAdd.action)} disabled={targetPending} standalone={!showNavigation} /> : null}
      <GlobalMoneyActionHost />
      {quickAdd.feedback ? (
        <div
          className="fixed bottom-24 left-1/2 z-[120] -translate-x-1/2 rounded-full bg-[var(--ms-text)] px-4 py-3 text-sm font-bold text-[var(--ms-surface)] shadow-xl"
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
