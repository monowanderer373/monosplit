import { useT } from '../../lib/i18n'
import { useStore } from '../../store/useStore'
import { formatMinorAmount } from '../../lib/money'
import { localeForLang } from '../../lib/locale'
import MoneyText from '../MoneyText'
import type { ReactNode } from 'react'
import './tokens.css'
import './insights.css'

export function InsightIcon({ name, className = '' }: { name: string; className?: string }) {
  return <svg className={`i-icon ${className}`} aria-hidden="true"><use href={`/assets/insights/insights-icons.svg#${name}`} /></svg>
}
export function SpendingMoney({ minor, currency }: { minor: number; currency: string }) {
  const lang = useStore(state => state.lang)
  const hidden = useStore(state => state.homeUi.balanceHidden)
  const t = useT()
  return hidden ? <span aria-label={t('spending.hidden')}>••••</span> : <MoneyText value={formatMinorAmount(minor, currency, localeForLang(lang))} />
}
export function SpendingCount({ count }: { count: number }) {
  const t = useT()
  return <>{t(count === 1 ? 'spending.countOne' : 'spending.countMany', { count })}</>
}
export function SpendingState({ status, retry }: { status: 'loading' | 'error' | 'empty'; retry?: () => unknown }) {
  const t = useT()
  return <section className="i-state-card i-card" role={status === 'error' ? 'alert' : 'status'}>
    <InsightIcon name={status === 'error' ? 'info' : 'receipt'} />
    <div><strong>{t(status === 'loading' ? 'spending.loading' : status === 'error' ? 'spending.error' : 'spending.empty')}</strong>
      {status === 'empty' ? <p>{t('spending.emptyHelp')}</p> : null}
      {status === 'error' && retry ? <button className="i-link" onClick={() => void retry()}>{t('common.retry')}</button> : null}
    </div>
  </section>
}
export function InsightPage({ children, records = false }: { children: ReactNode; records?: boolean }) {
  return <main className={`tt-insights ${records ? 'i-records-root' : ''}`}><div className={`i-page ${records ? 'i-records-page' : ''}`}>{children}</div></main>
}
