import { monthLabel } from '../lib/spendingView'
import { Link, useLocation } from 'react-router-dom'
import { useT } from '../lib/i18n'
import { useSpendingView } from '../hooks/useSpendingView'
import { spendingQuery, type SpendingTab } from '../lib/spendingView'
import InsightsFilters from '../components/insights/InsightsFilters'
import SpendingCharts from '../components/insights/SpendingCharts'
import { InsightIcon, InsightPage, SpendingCount, SpendingState } from '../components/insights/SpendingUI'
import SpendingTotals from '../components/insights/SpendingTotals'

export default function InsightsPage() {
  const t = useT()
  const location = useLocation()
  const { auth, ledger, lang, today, timezone, filter, snapshot, ready, authenticated, hidden, update, updatingFx,retryFx,rememberFx } = useSpendingView()
  if (auth.loading) return <InsightPage><SpendingState status="loading" /></InsightPage>
  if (auth.sessionError) return <InsightPage><SpendingState status="error" retry={auth.retrySession} /></InsightPage>
  if (!authenticated) return <InsightPage><p>{auth.authUser ? t('spending.unavailable') : t('ledger.privateTitle')}</p><Link className="i-link" to="/login">{t('common.signIn')}</Link></InsightPage>
  return <InsightPage>
    <header><h1 className="i-heading">{t('insights.title')}</h1><p className="i-subtitle">{t('spending.subtitle')}</p></header>
    <InsightsFilters filter={filter} timezone={timezone} lang={lang} update={update} initialMonthOpen={Boolean(location.state?.openSpendingMonth)} />
    {!ready ? <SpendingState status={ledger.expensesStatus === 'error' ? 'error' : 'loading'} retry={ledger.refresh} /> : <>
      <section className="i-card i-summary-ticket" aria-label={t('spending.total')}>
        <div className="i-ticket-top"><h2 className="i-ticket-title"><InsightIcon name="receipt" /><span>{t('spending.total')}</span></h2><span className="i-quiet-month">{monthLabel(filter.month, lang)}</span></div>
        <SpendingTotals snapshot={snapshot} updating={updatingFx} retry={retryFx} />
        <div className="i-ticket-footer"><span className="i-receipt-perforation" aria-hidden="true" /><span><span className="i-record-count"><SpendingCount count={snapshot.count} /></span><span className="i-share-basis">{t(filter.scope === 'personal' ? 'spending.personalBasis' : 'spending.basis')}</span></span><Link className="i-link" onClick={rememberFx} to={`/insights/records?${spendingQuery(filter)}`} state={{ fromInsights: true }}><span>{t('spending.viewRecords')}</span><InsightIcon name="arrow-right" /></Link></div>
      </section>
      <div className="i-analysis-tabs" role="tablist" aria-label={t('spending.views')} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
        const current = tabs.indexOf(event.target as HTMLButtonElement)
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowLeft' ? 2 : 1)) % 3
        event.preventDefault(); tabs[next].focus(); tabs[next].click()
      }}>{(['category', 'trend', 'ranking'] as SpendingTab[]).map(tab => <button key={tab} role="tab" id={`spending-${tab}`} className="i-analysis-tab" aria-selected={filter.tab === tab} aria-controls="spending-panel" tabIndex={filter.tab === tab ? 0 : -1} onClick={() => update({ tab })}><span className="i-tab-face">{t(tab === 'category' ? 'spending.categories' : `spending.${tab}`)}</span></button>)}</div>
      <section className="i-card i-chart-card" id="spending-panel" role="tabpanel" aria-labelledby={`spending-${filter.tab}`} tabIndex={0}>
        {!hidden && snapshot.missingCurrencies.length ? <p className="i-chart-context" role="status">{t('spending.fxPartial',{currencies:snapshot.missingCurrencies.join(', ')})}</p> : null}
        {hidden ? <p className="i-concealed" role="status">{t('spending.hidden')}</p> : snapshot.overflow ? <p role="status">{t('spending.fxOverflow')}</p> : snapshot.totalMinor ? <SpendingCharts snapshot={snapshot} tab={filter.tab} month={filter.month} today={today} hidden={hidden} /> : snapshot.missingCurrencies.length ? <p role="status">{t(hidden ? 'spending.hidden' : updatingFx ? 'spending.fxUpdating' : 'spending.fxUnavailable')}</p> : snapshot.records.some(r => r.personalSpendingMinor > 0) ? <p role="status">{t(hidden ? 'spending.hidden' : 'spending.fxBelowPrecision')}</p> : <SpendingState status={snapshot.count ? "zero-share" : "empty"} />}
      </section>
    </>}
  </InsightPage>
}
