import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { currencyExponent } from '../../lib/money'
import { exactAmount } from '../../lib/fx'
import { localeForLang } from '../../lib/locale'
import type { spendingSnapshot } from '../../lib/spendingView'
import { fitReceipt } from './receiptLayout'

type Snapshot = ReturnType<typeof spendingSnapshot>
export default function SpendingTotals({ snapshot, updating, retry }: { snapshot: Snapshot; updating: boolean; retry: () => unknown }) {
  const t = useT(), hidden = useStore(s => s.homeUi.balanceHidden), lang = useStore(s => s.lang)
  const ref = useRef<HTMLDivElement>(null)
  const [now,setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),60_000); return () => clearInterval(timer) },[])
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const fit = () => fitReceipt(root, t('spending.scrollAmount'))
    fit()
    let frame = 0
    const schedule = () => { if (!frame) frame=requestAnimationFrame(() => {frame=0;fit()}) }
    let active = true
    const ro = new ResizeObserver(schedule); ro.observe(root)
    void document.fonts?.ready.then(() => { if (active) schedule() })
    document.fonts?.addEventListener('loadingdone',schedule)
    return () => { active=false;cancelAnimationFrame(frame);ro.disconnect();document.fonts?.removeEventListener('loadingdone',schedule) }
  },[snapshot.totals,hidden,t,updating,lang])
  const foreign = snapshot.currencies.filter(c => c !== 'MYR')
  const available = foreign.flatMap(c => snapshot.fx.rates[c] ? [snapshot.fx.rates[c]] : [])
  const dates = [...new Set(available.map(r => r.rateDate))].sort()
  const older = available.some(r => now-Date.parse(r.rateDate+'T00:00:00Z') > 7*86400_000)
  const cached = snapshot.fx.status === 'cached' || available.some(r => now-Date.parse(r.fetchedAt)>86400_000)
  const formatDay = (day: string) => new Intl.DateTimeFormat(localeForLang(lang),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'))
  const dateText = dates.length ? `${formatDay(dates[0])}${dates.length > 1 ? ` – ${formatDay(dates.at(-1)!)}` : ''}` : ''
  const status = updating ? 'spending.fxUpdating' : older ? 'spending.fxOlder' : cached ? 'spending.fxCached' : snapshot.missingCurrencies.length ? 'spending.fxUnavailable' : null
  return <div ref={ref} className="i-totals-content" data-testid="spending-total" data-has-fx={foreign.length > 0}>
    <div className="i-currency-list">
    {snapshot.totals.map(total => <div key={total.currency} className="i-currency-row">
      <span className="i-currency-unit">{total.currency} </span>
      <span className="i-original-number tt-money-number" aria-label={hidden ? t('spending.hidden') : undefined}>{hidden ? '••••' : exactAmount(total.originalMinor,currencyExponent(total.currency),localeForLang(lang))}</span>
      <span className="i-equivalent" aria-hidden={total.currency === 'MYR' || snapshot.count === 0 ? true : undefined} title={total.currency !== 'MYR' ? t('spending.fxBasis') : undefined}>
        <span className="i-equivalent-value">{total.currency !== 'MYR' && snapshot.count > 0 ? total.equivalentMinor !== null ? <span aria-label={hidden ? t('spending.hidden') : undefined}>≈ RM {hidden ? '••••' : exactAmount(total.equivalentMinor,2,localeForLang(lang))}</span> : <span aria-label={t(updating ? 'spending.fxUpdating' : 'spending.fxUnavailable')}>{t(updating ? 'spending.fxUpdatingInline' : 'spending.fxUnavailableInline')}</span> : ''}</span>
      </span>
    </div>)}
    </div>
    <span className="i-scroll-help">{t('spending.scrollAmount')}</span>
    {foreign.length ? <p className="i-fx-source" aria-live="polite" title={t('spending.fxBasis')}>
      {t('spending.fxRates')} <a className="i-provider-link" href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a>{dateText ? ` · ${dateText}` : ''}
      {status ? <> · <span role="status">{t(status)}</span></> : null}
      {!updating && (cached || snapshot.missingCurrencies.length > 0) ? <> · <button className="i-link i-fx-retry" onClick={() => void retry()}>{t('common.retry')}</button></> : null}
      <span className="i-sr-only"> · {t('spending.fxBasis')}</span>
    </p> : null}
  </div>
}
