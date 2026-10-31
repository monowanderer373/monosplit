import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
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
import {pendingTripEdit} from '../lib/tripEditorRecovery'
import {useAccessibleDialog} from '../hooks/useAccessibleDialog'
const RestoredTripExpenseEditor=lazy(()=>import('./travel/UnifiedTripExpenseEditor').then(module=>({default:module.RestoredTripExpenseEditor})))

function RecoveringTripEditor(){
 const t=useT(),ref=useAccessibleDialog<HTMLElement>(()=>{});
 useLayoutEffect(()=>{const overflow=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=overflow}},[]);
 return <section ref={ref} role="dialog" aria-modal="true" aria-label={t('common.loading')} tabIndex={-1} style={{position:'fixed',inset:0,zIndex:300,background:'#f7f5ef',display:'grid',placeItems:'center'}}><p role="status">{t('common.loading')}</p></section>
}
function ShellContents() {
  const t = useT()
  const { authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const inspectedInitialOverlay = useRef(false)
  const [restoringEditor,setRestoringEditor]=useState<{owner:string;id:string}|null>(null)
  useEffect(() => {
    if (inspectedInitialOverlay.current || !authUser?.participantId) return
    let live=true
    queueMicrotask(()=>{
      if(!live||inspectedInitialOverlay.current)return
      inspectedInitialOverlay.current=true
      const marker=location.state?.routeOverlay
      if(typeof marker!=='string'||!marker.startsWith('trip-expense-editor:'))return
      const id=marker.slice('trip-expense-editor:'.length)
      try{
        if(/^[0-9a-f-]{36}$/i.test(id)&&pendingTripEdit(authUser.participantId!,id)){
          setRestoringEditor({owner:authUser.participantId!,id});return
        }
      }catch{/* Invalid recovery metadata never authorizes a financial mutation. */}
      // No opaque in-flight command exists; unsaved amounts/notes were never
      // persisted. Retire only this editor's marker and keep route provenance.
      const state={...location.state};delete state.routeOverlay
      navigate(location.pathname+location.search,{replace:true,state})
    })
    return()=>{live=false}
  },[location,navigate,authUser?.participantId])
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
  const membersPage = /^\/space\/[^/]+\/members\/?$/.test(location.pathname)
  const spacePage = /^(?:\/space\/[^/]+|\/travel\/trip\/[^/]+)\/?$/.test(location.pathname)
  const contextualPage = travelHome || membersPage || /^\/travel\/trip\/[^/]+\/?$/.test(location.pathname) || spacePage && !!pageTarget
  const targetPending = contextualPage && !pageTarget?.ready

  const openGlobalAdd = useCallback(() => {
    if (targetPending) return
    const resolved = contextualPage && pageTarget ? pageTarget.target : resolveRouteMoneyContext(location.pathname)
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
    contextualPage,
    pageTarget,
  ])

  const tripDatesPage = /^\/travel\/trip\/[^/]+\/dates\/?$/.test(location.pathname)
  const profileSubpage = location.pathname.startsWith('/profile/')
  const recordsPage = location.pathname === '/insights/records'
  const showNavigation = Boolean(authUser?.participantId) && !tripDatesPage && !recordsPage && !profileSubpage
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
      {authUser?.participantId && !recordsPage && !profileSubpage && !tripDatesPage ? <GlobalMoneyAction onAdd={openGlobalAdd} composerOpen={Boolean(quickAdd.action)} disabled={targetPending} standalone={!showNavigation} /> : null}
      <GlobalMoneyActionHost />
      {restoringEditor&&restoringEditor.owner===authUser?.participantId?<Suspense fallback={<RecoveringTripEditor/>}><RestoredTripExpenseEditor key={restoringEditor.owner+':'+restoringEditor.id} expenseId={restoringEditor.id} onExit={()=>setRestoringEditor(null)}/></Suspense>:null}
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
