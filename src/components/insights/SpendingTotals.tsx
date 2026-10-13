import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { currencyExponent } from '../../lib/money'
import { exactAmount } from '../../lib/fx'
import { localeForLang } from '../../lib/locale'
import type { spendingSnapshot } from '../../lib/spendingView'

type Snapshot = ReturnType<typeof spendingSnapshot>
export default function SpendingTotals({ snapshot, updating, retry }: { snapshot: Snapshot; updating: boolean; retry: () => unknown }) {
  const t = useT(), hidden = useStore(s => s.homeUi.balanceHidden), lang = useStore(s => s.lang)
  const ref = useRef<HTMLDivElement>(null)
  const [now,setNow] = useState(() => Date.now())
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()),60_000); return () => clearInterval(timer) },[])
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const fit = () => root.querySelectorAll<HTMLElement>('.i-currency-row').forEach(row => {
      const amount = row.querySelector<HTMLElement>('.i-original-number')!
      const unit = row.querySelector<HTMLElement>('.i-currency-unit')!
      const range = document.createRange(); range.selectNodeContents(amount)
      const width = range.getBoundingClientRect().width
      const unitRange = document.createRange(); unitRange.selectNodeContents(unit)
      const unitWidth = Math.max(3*parseFloat(getComputedStyle(document.documentElement).fontSize),unitRange.getBoundingClientRect().width)
      row.dataset.stacked = String(width + unitWidth + 8 > row.clientWidth)
      const scroll = width > amount.clientWidth + 1
      amount.tabIndex = scroll ? 0 : -1
      amount.setAttribute('aria-label', hidden ? t('spending.hidden') : `${amount.textContent}${scroll ? ` · ${t('spending.scrollAmount')}` : ''}`)
      row.dataset.scroll = String(scroll)
    })
    fit()
    const ro = new ResizeObserver(fit); ro.observe(root)
    document.fonts?.addEventListener('loadingdone',fit)
    return () => { ro.disconnect();document.fonts?.removeEventListener('loadingdone',fit) }
  },[snapshot.totals,hidden,t])
  const foreign = snapshot.currencies.filter(c => c !== 'MYR')
  const available = foreign.flatMap(c => snapshot.fx.rates[c] ? [snapshot.fx.rates[c]] : [])
  const dates = [...new Set(available.map(r => r.rateDate))].sort()
  const older = available.some(r => now-Date.parse(r.rateDate+'T00:00:00Z') > 7*86400_000)
  const cached = snapshot.fx.status === 'cached' || available.some(r => now-Date.parse(r.fetchedAt)>86400_000)
  const formatDay = (day: string) => new Intl.DateTimeFormat(localeForLang(lang),{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'))
  const dateText = dates.length ? `${formatDay(dates[0])}${dates.length > 1 ? ` – ${formatDay(dates.at(-1)!)}` : ''}` : ''
  return <div ref={ref} className="i-totals-content" data-testid="spending-total">
    {snapshot.totals.map(total => <div key={total.currency} className={`i-currency-row ${snapshot.totals.length === 1 && total.currency === 'MYR' ? 'i-currency-row--single' : ''}`}>
      <span className="i-currency-unit">{snapshot.totals.length === 1 && total.currency === 'MYR' ? 'RM' : total.currency} </span>
      <span className="i-original-number tt-money-number" aria-label={hidden ? t('spending.hidden') : undefined}>{hidden ? '••••' : exactAmount(total.originalMinor,currencyExponent(total.currency),localeForLang(lang))}</span>
      {total.currency !== 'MYR' && snapshot.count > 0 ? <span className="i-equivalent">{total.equivalentMinor !== null ? <span aria-label={hidden ? t('spending.hidden') : undefined}>≈ RM {hidden ? '••••' : exactAmount(total.equivalentMinor,2,localeForLang(lang))}</span> : t(updating ? 'spending.fxUpdating' : 'spending.fxUnavailable')}</span> : null}
      <span className="i-scroll-help">{t('spending.scrollAmount')}</span>
    </div>)}
    {foreign.length ? <div className="i-fx-source" aria-live="polite">
      <p>{t('spending.fxRates')} <a className="i-provider-link" href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">Frankfurter</a>{dateText ? ` · ${dateText}` : ''}</p>
      <p>{t('spending.fxBasis')}</p>
      {updating || cached || older || snapshot.missingCurrencies.length ? <p role="status">{t(updating ? 'spending.fxUpdating' : older ? 'spending.fxOlder' : cached ? 'spending.fxCached' : 'spending.fxUnavailable')}</p> : null}
      {!updating && (cached || snapshot.missingCurrencies.length > 0) ? <button className="i-link" onClick={() => void retry()}>{t('common.retry')}</button> : null}
    </div> : null}
  </div>
}
