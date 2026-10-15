import {useRef,useState} from 'react'
import {useT} from '../../lib/i18n'
import {formatMinorAmount,parseMajorAmount} from '../../lib/money'
import {useStore} from '../../store/useStore'
import {generateId} from '../../lib/id'
import type {CollectPaySnapshot} from '../../lib/collectPay'
import type {SettlementPayment,SettlementAllocation} from '../../lib/settlementRepository'
import type {collectPayService} from '../../lib/collectPayRepository'
import AmountInput from '../AmountInput'

/** Resume the existing payment's private cash authorization, never propose a second payment. */
export default function PaymentRecordRecovery({snapshot,payment,allocation,service,busy,mutate}:{snapshot:CollectPaySnapshot;payment:SettlementPayment;allocation:SettlementAllocation;service:typeof collectPayService;busy:boolean;mutate:(id:string,work:()=>Promise<unknown>)=>Promise<void>}){
 const t=useT(),hidden=useStore(s=>s.homeUi.balanceHidden),[accountId,setAccountId]=useState(''),[amount,setAmount]=useState(''),attempt=useRef<{fingerprint:string;requestId:string}|null>(null)
 const accounts=snapshot.accounts.filter(a=>a.accountClass==='asset'&&!a.archived),account=accounts.find(a=>a.id===accountId)
 const needsAmount=account?.currency!==payment.currency||snapshot.paymentIntents?.[payment.id]?.overpay==='gift'
 const valid=()=>{try{return !!account&&(!needsAmount||parseMajorAmount(amount,account.currency)>0)}catch{return false}}
 if(hidden)return null
 return <section className="cp-form" data-testid="payment-record-recovery"><h3>{t('noticeA.finishPaymentRecord')}</h3><p className="cp-help">{t('noticeA.finishPaymentHelp')}</p><label>{t('cp.paidFrom')}<select value={accountId} disabled={busy} onChange={event=>{setAccountId(event.target.value);setAmount('')}}><option value="">{t('cp.chooseAccount')}</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label>
  {account&&needsAmount?<label>{t('cp.cashAmount')} · {account.currency}<AmountInput value={amount} onValueChange={setAmount} disabled={busy} inputMode="decimal"/><small>{t('noticeA.funding.actualHelp')}</small></label>:account?<p>{formatMinorAmount(allocation.amountMinor,account.currency)}</p>:null}
  <button type="button" className="cp-primary" disabled={busy||!valid()} onClick={()=>void mutate(allocation.id,async()=>{
   const fresh=await service.load(snapshot.owner),current=fresh.payments.find(p=>p.id===payment.id),currentAllocation=current?.allocations.find(a=>a.id===allocation.id)
   if(!current||current.debtorParticipantId!==snapshot.owner||current.version!==payment.version||currentAllocation?.state!=='pending')throw new Error('version_conflict')
   if(fresh.cashLegs.some(l=>l.allocationId===allocation.id&&l.role==='payer'&&['pending','posted'].includes(l.status)))return
   const selected=fresh.accounts.find(a=>a.id===accountId&&a.accountClass==='asset'&&!a.archived)
   if(!selected||selected.currency!==account?.currency)throw new Error('settlement_cash_account_invalid')
   const actual=needsAmount?parseMajorAmount(amount,selected.currency):allocation.amountMinor
   const fingerprint=JSON.stringify([allocation.id,selected.id,selected.currency,actual])
   if(attempt.current?.fingerprint!==fingerprint)attempt.current={fingerprint,requestId:generateId()}
   await service.repository.authorize({requestId:attempt.current.requestId,allocationId:allocation.id,role:'payer',accountId:selected.id,cashMinor:actual})
  })}>{t('noticeA.finishPaymentRecord')}</button></section>
}
