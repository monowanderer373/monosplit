import { useState, type ReactNode } from 'react'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'
import type { UniversalQuickAddValues } from '../lib/universalQuickAdd'
import { currencyExponent, equalMinorShares, parseMajorAmount } from '../lib/money'
import { calculateQuickAmount } from '../lib/quickCalculator'
import QuickIcon from './QuickIcon'
import './quick-add.css'

export type SplitValues = Pick<UniversalQuickAddValues, 'amount' | 'currency' | 'calculation' | 'selectedParticipantIds' | 'splitMode' | 'exactShareAmounts' | 'payerAmounts' | 'detailsExpanded' | 'items'>
export function QuickPanel({title,onClose,children}: {title:string;onClose:()=>void;children:ReactNode}) {
 const ref=useAccessibleDialog<HTMLElement>(onClose)
 return <div className="qa-overlay"><div className="qa-scrim" onClick={onClose} aria-hidden="true"/><section ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="qa-panel"><div className="qa-handle"/><header><h2>{title}</h2><button type="button" className="qa-icon-button" aria-label="Close panel" onClick={onClose}><QuickIcon name="close"/></button></header>{children}</section></div>
}
function major(minor:number,currency:string) {return (minor/10**currencyExponent(currency)).toFixed(currencyExponent(currency))}
function zeroOrMinor(raw:string,currency:string) {return !raw.trim() || /^0+(\.0*)?$/.test(raw.trim()) ? 0 : parseMajorAmount(raw,currency)}

export function SplitConfiguration({values,participants,currentParticipantId,label,accountLabel,zh,onUpdate,onApply,onChoosePeople,onRemove,allowSelectionChange=true,readOnly=false,requireFriend=false,allowEmptyTotal=false,busy=false}: {
 values:SplitValues; participants:{id:string;displayName:string}[]; currentParticipantId:string; label:string; accountLabel?:string; zh:boolean
 onUpdate:(patch:Partial<SplitValues>)=>void; onApply:()=>void; onChoosePeople?:()=>void; onRemove?:()=>void
 allowSelectionChange?:boolean; readOnly?:boolean; requireFriend?:boolean; allowEmptyTotal?:boolean; busy?:boolean
}) {
 const copy=(en:string,cn:string)=>zh?cn:en
 const [payerOpen,setPayerOpen]=useState(false)
 const [error,setError]=useState('')
 const computedAmount=(()=>{try{return calculateQuickAmount(values.calculation??values.amount,values.currency)}catch{return ''}})()
 const total=(()=>{try{return parseMajorAmount(computedAmount,values.currency)}catch{return 0}})()
 const money=(n:number)=>`${values.currency==='MYR'?'RM':values.currency} ${major(n,values.currency)}`
 const ordered=participants.filter(p=>values.selectedParticipantIds.includes(p.id)).sort((a,b)=>a.id===currentParticipantId?-1:b.id===currentParticipantId?1:0)
 let shares=new Map<string,number>()
 let invalid=false
 try { shares=values.splitMode==='equal'?equalMinorShares(total,ordered.map(p=>p.id)):new Map(ordered.map(p=>[p.id,zeroOrMinor(values.exactShareAmounts[p.id]??'',values.currency)])) } catch { invalid=true }
 const selfPaid=(()=>{try{return Object.values(values.payerAmounts).some(a=>a.trim())?zeroOrMinor(values.payerAmounts[currentParticipantId]??'',values.currency):total}catch{return 0}})()
 const selfShare=shares.get(currentParticipantId)??0
 const setExact=(id:string,raw:string)=>{
  const amounts={...values.exactShareAmounts,[id]:raw},last=ordered.at(-1)?.id
  if(last && last!==id && total>0){try{const assigned=ordered.filter(p=>p.id!==last).reduce((sum,p)=>sum+zeroOrMinor(amounts[p.id]??'',values.currency),0);if(assigned<=total)amounts[last]=major(total-assigned,values.currency)}catch{/* Retain invalid input for correction. */}}
  onUpdate({exactShareAmounts:amounts})
 }
 const apply=()=>{
  if(readOnly || (allowEmptyTotal && total===0)){onApply();return}
  let paidTotal=total
  try{if(Object.values(values.payerAmounts).some(v=>v.trim()))paidTotal=ordered.reduce((sum,p)=>sum+zeroOrMinor(values.payerAmounts[p.id]??'',values.currency),0)}catch{paidTotal=-1}
  if(requireFriend&&ordered.length<2){setError(copy('Select at least one friend for a shared expense.','共享账目至少需要选择一位朋友。'));return}
  if(invalid||total<=0||[...shares.values()].reduce((sum,n)=>sum+n,0)!==total||paidTotal!==total){setError(copy('Shares and payments must each add up to the total.','份额和付款金额都必须等于总金额。'));return}
  setError('');onApply()
 }
 return <>
 <div className="qa-split-context"><strong>{label}</strong>{onChoosePeople?<button className="qa-text-button" type="button" onClick={onChoosePeople}>{copy('Choose people','选择对象')}</button>:null}</div>
 <p className="qa-helper">{copy('Total amount','总金额')}</p><p className="qa-split-total">{money(total)}</p>
 <div className="qa-segment" inert={readOnly}><button type="button" aria-pressed={values.splitMode==='equal'&&!values.detailsExpanded} onClick={()=>onUpdate({splitMode:'equal',exactShareAmounts:{},detailsExpanded:false})}>{copy('Equally','平均')}</button><button type="button" aria-pressed={values.splitMode==='exact'&&!values.detailsExpanded} onClick={()=>onUpdate({splitMode:'exact',detailsExpanded:false})}>{copy('Amounts','指定金额')}</button><button type="button" aria-pressed={values.detailsExpanded} onClick={()=>onUpdate({detailsExpanded:!values.detailsExpanded})}>{copy('By item','按项目')}</button></div>
 <button type="button" className="qa-account-row" onClick={()=>setPayerOpen(v=>!v)}><QuickIcon name="wallet"/><span><strong>{Object.values(values.payerAmounts).some(v=>v.trim())?copy('Payment amounts','付款金额'):copy('Paid by You','由我付款')}</strong><small>{accountLabel??copy('Existing payment record','原有付款记录')}</small></span><span>›</span></button>
 {payerOpen?<div className="qa-stack">{ordered.map(p=><label className="qa-split-person" key={p.id}><span>{p.id===currentParticipantId?copy('You','我'):p.displayName}</span><input readOnly={readOnly} aria-label={copy(`Paid by ${p.displayName}`,`${p.displayName} 付款`)} type="text" inputMode="decimal" placeholder={p.id===currentParticipantId?computedAmount:'0'} value={values.payerAmounts[p.id]??''} onChange={e=>onUpdate({payerAmounts:{...values.payerAmounts,[p.id]:e.target.value}})}/></label>)}<button className="qa-text-button" type="button" disabled={readOnly} onClick={()=>onUpdate({payerAmounts:{}})}>{copy('Reset · I paid all','重置为我付全额')}</button></div>:null}
 {values.detailsExpanded?<QuickItems values={values} participants={ordered.map(p=>({id:p.id,name:p.displayName}))} onUpdate={onUpdate} zh={zh}/>:null}
 {participants.map(p=><div key={p.id} className="qa-split-person" data-selected={values.selectedParticipantIds.includes(p.id)}><label><input aria-label={p.id===currentParticipantId?copy('You','我'):p.displayName} type="checkbox" checked={values.selectedParticipantIds.includes(p.id)} disabled={readOnly || !allowSelectionChange || p.id===currentParticipantId} onChange={()=>onUpdate({selectedParticipantIds:values.selectedParticipantIds.includes(p.id)?values.selectedParticipantIds.filter(id=>id!==p.id):[...values.selectedParticipantIds,p.id],payerAmounts:{},exactShareAmounts:{},splitMode:'equal'})}/><span className="qa-avatar">{p.displayName.slice(0,1)}</span><span>{p.id===currentParticipantId?copy('You','我'):p.displayName}</span></label>{values.selectedParticipantIds.includes(p.id)?values.splitMode==='exact'?<input readOnly={readOnly} inputMode="decimal" aria-label={copy(`Share for ${p.displayName}`,`${p.displayName} 份额`)} value={values.exactShareAmounts[p.id]??''} placeholder="0.00" onChange={e=>setExact(p.id,e.target.value)}/>:<strong>{money(shares.get(p.id)??0)}</strong>:null}</div>)}
 <div className="qa-split-summary"><p><span>{copy('You pay','我支付')}</span><strong>{money(selfPaid)}</strong></p><p><span>{selfPaid>=selfShare?copy('To collect','待收回'):copy('You owe','我待付')}</span><strong>{money(Math.abs(selfPaid-selfShare))}</strong></p></div>

 <button type="button" className="qa-primary qa-panel-footer" disabled={busy} onClick={apply}>{readOnly?copy('Done','完成'):copy('Apply split','应用分摊')}</button>
 {onRemove&&!readOnly?<button type="button" className="qa-text-button" onClick={onRemove}>{copy('Remove split · personal expense','取消分摊 · 个人消费')}</button>:null}
 {error?<p role="alert" className="qa-error">{error}</p>:null}
 </>
}
function QuickItems({values,participants,onUpdate,zh}:{values:SplitValues;participants:{id:string;name:string}[];onUpdate:(patch:Partial<SplitValues>)=>void;zh:boolean}){
 const items=values.items??[]
 const [error,setError]=useState('')
 const patch=(next:NonNullable<UniversalQuickAddValues['items']>)=>onUpdate({items:next})
 const apply=()=>{try{
  const amounts:Record<string,number>=Object.fromEntries(participants.map(p=>[p.id,0]))
  let total=0
  if(!items.length)throw new Error()
  for(const item of items){const minor=parseMajorAmount(item.amount,values.currency);const ids=item.participantIds.filter(id=>participants.some(p=>p.id===id));const shares=equalMinorShares(minor,ids);total+=minor;for(const [id,n] of shares)amounts[id]+=n}
  const expected=parseMajorAmount(calculateQuickAmount(values.calculation??values.amount,values.currency),values.currency)
  if(total!==expected)throw new Error()
  onUpdate({splitMode:'exact',exactShareAmounts:Object.fromEntries(Object.entries(amounts).map(([id,n])=>[id,major(n,values.currency)])),detailsExpanded:false});setError('')
 }catch{setError(zh?'每个项目需要金额及成员，项目总额须等于消费总额。':'Each item needs an amount and people; item amounts must match the total.') }}
 return <div className="qa-items"><h3>{zh?'按项目分摊':'Split by item'}</h3>{items.map((item,i)=><div className="qa-item" key={item.id}><div className="qa-two-buttons"><input aria-label={`Item ${i+1} name`} placeholder={zh?'项目名称':'Item name'} value={item.name} onChange={e=>patch(items.map((r,j)=>j===i?{...r,name:e.target.value}:r))}/><input aria-label={`Item ${i+1} amount`} inputMode="decimal" placeholder="0.00" value={item.amount} onChange={e=>patch(items.map((r,j)=>j===i?{...r,amount:e.target.value}:r))}/><button type="button" aria-label={`Remove item ${i+1}`} onClick={()=>patch(items.filter((_,j)=>j!==i))}><QuickIcon name="close" size={16}/></button></div><div className="qa-item-people">{participants.map(p=><label key={p.id}><input type="checkbox" checked={item.participantIds.includes(p.id)} onChange={()=>patch(items.map((r,j)=>j===i?{...r,participantIds:r.participantIds.includes(p.id)?r.participantIds.filter(id=>id!==p.id):[...r.participantIds,p.id]}:r))}/>{p.name}</label>)}</div></div>)}<div className="qa-two-buttons"><button type="button" onClick={()=>patch([...items,{id:crypto.randomUUID(),name:'',amount:'',participantIds:participants.map(p=>p.id)}])}>{zh?'新增项目':'Add item'}</button><button type="button" className="qa-primary" onClick={apply}>{zh?'计算份额':'Calculate shares'}</button></div>{error?<p className="qa-error" role="alert">{error}</p>:null}</div>
}
