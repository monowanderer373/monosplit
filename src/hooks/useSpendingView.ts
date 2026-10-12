import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from './useAuth'
import { usePersonalLedger } from './usePersonalLedger'
import { useStore } from '../store/useStore'
import { localCalendarDate } from '../lib/homeView'
import { spendingFilter, spendingSnapshot, spendingQuery, type SpendingFilter } from '../lib/spendingView'
import { useRouteScroll } from './useRouteScroll'

export function useSpendingView() {
  const auth = useAuth()
  const ledger = usePersonalLedger()
  const [params, setParams] = useSearchParams()
  const lang = useStore(state => state.lang)
  const hidden = useStore(state => state.homeUi.balanceHidden)
  const timezone = auth.authUser?.timezone ?? 'Asia/Kuala_Lumpur'
  const today = localCalendarDate(new Date(), timezone)
  const filter = spendingFilter(params, today)
  const snapshot = useMemo(() => spendingSnapshot(ledger.rows, ledger.participantId, { month: filter.month, scope: filter.scope, currency: filter.currency, tab: 'category' }, auth.authUser?.defaultCurrency ?? 'MYR'),
    [ledger.rows, ledger.participantId, filter.month, filter.scope, filter.currency, auth.authUser?.defaultCurrency]) // tab is presentation only
  const committed = { ...filter, currency: snapshot.currency }
  const authenticated = Boolean(auth.authUser?.participantId && !auth.authUser.isAnonymous)
  const ready = authenticated && !auth.loading && ledger.expensesStatus === 'ready'
  useRouteScroll(ready, auth.authUser?.id ?? '')
  const update = (patch: Partial<SpendingFilter>) => setParams(spendingQuery({ ...committed, ...patch }), { replace: true, state: { restoreScroll: window.scrollY } })
  return { auth, ledger, lang, hidden, timezone, today, filter: committed, snapshot, ready, authenticated, update }
}
