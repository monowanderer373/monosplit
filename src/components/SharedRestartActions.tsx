import {useRef,useState} from 'react'
import type {CanonicalExpense} from '../types'
import {useStore} from '../store/useStore'
import {formatMinorAmount} from '../lib/money'
import {sharedRestartRpc} from '../lib/sharedRestartRepository'
export default function SharedRestartActions({expense,owner,onRefresh,reviewOnly=false}:{expense:CanonicalExpense;owner:string;onRefresh:()=>Promise<unknown>;reviewOnly?:boolean}){
 const lang=useStore(s=>s.lang),hidden=useStore(s=>s.homeUi.balanceHidden),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState(reviewOnly),lock=useRef(false),attempt=useRef<Record<string,string>>({})
 const c=(en:string,zh:string)=>lang==='zh'?zh:en,state=expense.sharedRestart
 if(!state||!state.ownerIds.length)return null
 const pending=state.retags.filter(r=>r.recipientId===owner&&r.state==='pending')
 const eligible=state.edges.filter(e=>e.recipientId!==owner&&[e.debtorId,e.creditorId].includes(owner)&&e.remainingMinor>0&&e.effectiveMinor===0&&!state.retags.some(r=>r.edgeId===e.id&&['pending','accepted'].includes(r.state)))
 const ownActive=state.edges.some(e=>[e.debtorId,e.creditorId].includes(owner)&&e.effectiveMinor>0)
 const mine=state.ownerIds.includes(owner)
 const run=async(work:()=>Promise<unknown>)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await work();await onRefresh();setReview(false)}catch{setError(c('Could not confirm the result. Refresh before retrying.','尚未确认结果，请刷新后再重试。'))}finally{lock.current=false;setBusy(false)}}
 return <section className="shared-restart-actions" data-testid="shared-restart-actions">
  {!reviewOnly?<p className="home-meta">{ownActive?c('Split restored · Original bill retained','分账已恢复 · 原票据保留'):c('Previous split cleared · Original bill retained','旧分账已清除 · 原票据保留')}</p>:null}
  {pending.length>0&&!review?<button type="button" className="ms-btn-ghost" disabled={busy} onClick={()=>setReview(true)}>{c('Review tagged split','审核重新 tag 的分账')}</button>:null}
  {review&&pending.map(r=>{const e=state.edges.find(e=>e.id===r.edgeId);if(!e)return null;return <div className="notification-a-panel" key={r.id}>
   <p>{expense.description??expense.category}</p><p>{c(e.debtorId===owner?'You owe':'You are owed',e.debtorId===owner?'你需支付':'你应收取')} <strong>{hidden?'••••':formatMinorAmount(e.remainingMinor,expense.currency)}</strong></p>
   <p className="home-meta">{c('Only the unpaid amount is restored. This does not record another purchase or deduct money.','只恢复未付金额，不会再记一次支出或扣款。')}</p>
   {hidden?<button type="button" className="ms-btn-ghost" onClick={()=>useStore.getState().setHomeUi({balanceHidden:false})}>{c('Show amounts','显示金额')}</button>:<div className="notification-a-actions">
    <button type="button" className="ms-btn-primary" disabled={busy} onClick={()=>void run(()=>sharedRestartRpc('respond_shared_split_retag',{target_request_id:r.id,response:'accepted',expected_expense_version:expense.version}))}>{c('Accept split','接受分账')}</button>
    <button type="button" className="ms-btn-ghost" disabled={busy} onClick={()=>void run(()=>sharedRestartRpc('respond_shared_split_retag',{target_request_id:r.id,response:'declined',expected_expense_version:expense.version}))}>{c('Decline','拒绝')}</button>
   </div>}
  </div>})}
  {!reviewOnly?eligible.map(e=><button type="button" className="ms-btn-ghost" disabled={busy||hidden} key={e.id} onClick={()=>void run(()=>{const id=attempt.current[e.id+':'+expense.version]??=crypto.randomUUID();return sharedRestartRpc('request_shared_split_retag',{request_id:id,target_edge_id:e.id,target_expense_id:expense.id,expected_expense_version:expense.version})})}>{c('Tag again','重新 tag')} · {hidden?'••••':formatMinorAmount(e.remainingMinor,expense.currency)}</button>):null}
  {!reviewOnly&&!mine&&!ownActive&&pending.length===0?<button type="button" className="ms-btn-ghost" disabled={busy} onClick={()=>void run(()=>sharedRestartRpc('dismiss_shared_restart_bill',{target_expense_id:expense.id}))}>{c('Remove from my records','从我的记录移除')}</button>:null}
  {error?<p role="alert">{error}<button type="button" className="ms-btn-ghost" disabled={busy} onClick={()=>void onRefresh()}>{c('Refresh','刷新')}</button></p>:null}
 </section>
}
