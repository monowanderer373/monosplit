import { useId } from 'react'
import { useT } from '../../lib/i18n'
import type { CurrencyAccount } from '../../lib/multicurrency'
import type { QuickPaymentState } from '../../hooks/useQuickPayment'
import FundingSources from './FundingSources'
import { useStore } from '../../store/useStore'

/** Only the account panel presents funding details. Its draft lives with Quick Add. */
export default function QuickPayment({payment,accounts,busy}:{payment:QuickPaymentState;accounts:CurrencyAccount[];busy:boolean}){
 const t=useT(),zh=useStore(s=>s.lang)==='zh',setHomeUi=useStore(s=>s.setHomeUi),id=useId()
 if(payment.offline&&!payment.anchors)return <p>{t('mc.offlineDraft')}</p>
 if(payment.hidden)return <section className="ttmc-module"><p>{t('notice.hiddenReview')}</p><button type="button" onClick={()=>setHomeUi({balanceHidden:false})}>{t('mc.common.reveal')}</button></section>
 return <section className="ttmc-module qa-payment-details">
  {payment.failed?<div role="alert"><p>{t('mc.capability')}</p><button type="button" disabled={busy} onClick={payment.retry}>{t('common.retry')}</button></div>:!payment.anchors?<p role="status">{t('mc.state.loading')}</p>:<>
   <button type="button" className="qa-payment-toggle" aria-expanded={payment.mode==='actual'} aria-controls={id} disabled={busy} onClick={()=>payment.setMode(payment.mode==='actual'?'deferred':'actual')}>
    <span>{zh?'实际扣款（可选）':'Actual charge (optional)'}</span><span aria-hidden="true">{payment.mode==='actual'?'−':'+'}</span>
   </button>
   {payment.mode==='deferred'?<p>{t('mc.funding.beforeSave')}</p>:<div id={id} className="qa-payment-fields">
    <FundingSources accounts={accounts} anchors={payment.anchors} sources={payment.sources} onChange={payment.changeSources} busy={busy}/>
    <label className="ttmc-check"><input type="checkbox" checked={payment.accepted} disabled={busy} onChange={e=>payment.cover(e.target.checked)}/>{t('mc.coversPayment')}</label>
   </div>}
  </>}
 </section>
}
