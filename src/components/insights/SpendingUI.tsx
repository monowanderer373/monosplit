import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { localeForLang } from '../../lib/locale'
import MoneyText from '../MoneyText'
import { useLayoutEffect,useRef,type ReactNode } from 'react'
import { exactAmount } from '../../lib/fx'
import { currencyExponent,formatMinorAmount } from '../../lib/money'
import './tokens.css'
import './insights.css'

export function InsightIcon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`i-icon ${className}`} aria-hidden="true"><use href={`/assets/insights/insights-icons.svg#${name}`} /></svg>
}
const categoryIcons: Record<string, string> = { Food: 'utensils', Drinks: 'coffee', Groceries: 'cart', Transportation: 'car', Flight: 'car', Accommodation: 'bed', Shopping: 'bag', Sightseeing: 'ticket', Activities: 'ticket' }
export function CategoryDisk({ category }: { category: string }) {
  const tone = ['Groceries', 'Shopping'].includes(category) ? 'sage' : ['Transportation', 'Flight', 'Accommodation'].includes(category) ? 'blue' : 'apricot'
  return <span className="i-record-icon" data-tone={tone}><InsightIcon name={categoryIcons[category] ?? 'receipt'} /></span>
}
export function SpendingMoney({ minor, currency, showCode = false }: { minor: number; currency: string; showCode?: boolean }) {
  const lang = useStore(state => state.lang)
  const hidden = useStore(state => state.homeUi.balanceHidden)
  const t = useT()
  const ref=useRef<HTMLSpanElement>(null)
  useLayoutEffect(()=>{
    const root=ref.current
    if (!root || typeof ResizeObserver==='undefined') return
    const fit=()=>{
      const number=root.querySelector<HTMLElement>('.tt-money-number')
      if (!number) return
      const scroll=number.scrollWidth>number.clientWidth+1
      // Rows already have an accessible action button; avoid nested tab stops.
      if (scroll && !root.closest('button')) number.tabIndex=0;else number.removeAttribute('tabindex')
      number.title=scroll?t('spending.scrollAmount'):''
      root.dataset.scroll=String(scroll)
    }
    let frame=0
    const queue=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;fit()})}
    fit();const ro=new ResizeObserver(queue);ro.observe(root)
    return()=>{cancelAnimationFrame(frame);ro.disconnect()}
  },[minor,currency,hidden,lang,t])
  return hidden ? <span aria-label={t('spending.hidden')}>••••</span> : <span ref={ref} className="i-money-raw" data-scroll-label={t('spending.scrollAmount')}>{showCode ? <><span className="tt-money-currency">{currency} </span><span className="tt-money-number">{exactAmount(BigInt(minor),currencyExponent(currency),localeForLang(lang))}</span></> : <MoneyText value={formatMinorAmount(minor,currency,localeForLang(lang))} />}</span>
}
export function SpendingCount({ count }: { count: number }) {
  const t = useT()
  return <>{t(count === 1 ? 'spending.countOne' : 'spending.countMany', { count })}</>
}
export function SpendingState({ status, retry, records = false, changeMonth }: { status: 'loading' | 'error' | 'empty' | 'zero-share'; retry?: () => unknown; records?: boolean; changeMonth?: () => unknown }) {
  const t = useT()
  if (status === 'loading') return <section className="i-state-card i-card" role="status" aria-busy="true" aria-label={t('spending.loading')}><div className="i-skeleton-list" aria-hidden="true">{[0, 1].map(index => <div key={index} className="i-skeleton-row"><span /><span /><span /></div>)}</div></section>
  return <section className="i-state-card i-card" role={status === 'error' ? 'alert' : 'status'}>
    <InsightIcon name={status === 'error' ? 'info' : 'receipt'} />
    <div><strong>{t(status === 'error' ? records ? 'spending.recordsError' : 'spending.error' : status === 'zero-share' ? 'spending.zeroShare' : records ? 'spending.recordsEmpty' : 'spending.empty')}</strong>
      {status === 'empty' || status === 'zero-share' ? <p>{t(status === 'zero-share' ? 'spending.zeroShareHelp' : 'spending.emptyHelp')}</p> : null}
      {status === 'empty' && changeMonth ? <button className="i-link i-state-action" onClick={() => void changeMonth()}><InsightIcon name="calendar" />{t('spending.changeMonth')}</button> : null}
      {records && status === 'error' ? <p>{t('spending.tryAgain')}</p> : null}
      {status === 'error' && retry ? <button className="i-link i-state-action" onClick={() => void retry()}>{t('common.retry')}</button> : null}
    </div>
  </section>
}
export function InsightPage({ children, records = false }: { children: ReactNode; records?: boolean }) {
  return <main className={`tt-insights ${records ? 'i-records-root' : ''}`}><div className={`i-page ${records ? 'i-records-page' : ''}`}>{children}</div></main>
}
