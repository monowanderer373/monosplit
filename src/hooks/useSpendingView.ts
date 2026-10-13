import { useEffect, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from './useAuth'
import { usePersonalLedger } from './usePersonalLedger'
import { useStore } from '../store/useStore'
import { localCalendarDate } from '../lib/homeView'
import { spendingFilter, spendingSnapshot, spendingQuery, type SpendingFilter } from '../lib/spendingView'
import { useRouteScroll } from './useRouteScroll'
import { useInsightsFx } from './useInsightsFx'
// History-only public rate references. Full reload starts from latest shared cache.
const returnSnapshots = new Map<string,string>()

export function useSpendingView() {
  const auth = useAuth()
  const ledger = usePersonalLedger()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const lang = useStore(state => state.lang)
  const hidden = useStore(state => state.homeUi.balanceHidden)
  const timezone = auth.authUser?.timezone ?? 'Asia/Kuala_Lumpur'
  const today = localCalendarDate(new Date(), timezone)
  const filter = spendingFilter(params, today)
  useEffect(() => {
    if (!params.has('currency')) return
    const clean = new URLSearchParams(params);clean.delete('currency')
    setParams(clean,{replace:true,state:location.state})
  },[params,setParams,location.state])
  const authenticated = Boolean(auth.authUser?.participantId && !auth.authUser.isAnonymous)
  const ready = authenticated && !auth.loading && ledger.expensesStatus === 'ready'
  const originals = useMemo(() => spendingSnapshot(ledger.rows, ledger.participantId, {month:filter.month,scope:filter.scope,currency:'',tab:'category'}, auth.authUser?.defaultCurrency ?? 'MYR'),
    [ledger.rows,ledger.participantId,filter.month,filter.scope,auth.authUser?.defaultCurrency])
  const returnKey = `${auth.authUser?.id}:${location.key}`
  const pinned = filter.fx ?? returnSnapshots.get(returnKey)
  const fx = useInsightsFx(authenticated && ready ? auth.authUser!.id : '', originals.currencies.some(c => c !== 'MYR'), pinned)
  const snapshot = useMemo(() => spendingSnapshot(ledger.rows, ledger.participantId, {month:filter.month,scope:filter.scope,currency:'',tab:'category'}, auth.authUser?.defaultCurrency ?? 'MYR',fx.snapshot),
    [ledger.rows,ledger.participantId,filter.month,filter.scope,auth.authUser?.defaultCurrency,fx.snapshot])
  const committed = { ...filter, ...(fx.snapshot.id ? {fx:fx.snapshot.id} : {}) }
  useRouteScroll(ready, auth.authUser?.id ?? '')
  const update = (patch: Partial<SpendingFilter>) => setParams(spendingQuery({ ...filter, ...patch }), { replace: true, state: { ...location.state, restoreScroll: window.scrollY } })
  const rememberFx = () => {
    if (fx.snapshot.id) returnSnapshots.set(returnKey,fx.snapshot.id)
    if (returnSnapshots.size > 100) returnSnapshots.delete(returnSnapshots.keys().next().value!)
  }
  const retryFx = () => { if (pinned) { returnSnapshots.delete(returnKey);update({fx:undefined}) } else void fx.retry() }
  return { auth, ledger, lang, hidden, timezone, today, filter: committed, snapshot, ready, authenticated, update, updatingFx:fx.updating,retryFx,rememberFx }
}
