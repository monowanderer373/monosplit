import {tripItemMinorShares} from '../lib/tripSplit'
import { groupAmount } from '../lib/amountDisplay'
import AmountInput from './AmountInput'
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
function major(minor:number,currency:string) {const factor=10n**BigInt(currencyExponent(currency)), n=BigInt(minor);return `${n/factor}${currencyExponent(currency)?'.'+(n%factor).toString().padStart(currencyExponent(currency),'0'):''}`}
function zeroOrMinor(raw:string,currency:string) {return !raw.trim() || /^0+(\.0*)?$/.test(raw.trim()) ? 0 : parseMajorAmount(raw,currency)}

export function SplitConfiguration({values,participants,currentParticipantId,label,accountLabel,zh,onUpdate,onApply,onChoosePeople,onRemove,allowSelectionChange=true,readOnly=false,requireFriend=false,allowEmptyTotal=false,busy=false,compact=false,trip=false,unavailableIds=[],preserveOrder=false}: {
 values:SplitValues; participants:{id:string;displayName:string}[]; currentParticipantId:string; label:string; accountLabel?:string; zh:boolean
 onUpdate:(patch:Partial<SplitValues>)=>void; onApply:()=>void; onChoosePeople?:()=>void; onRemove?:()=>void
 allowSelectionChange?:boolean; readOnly?:boolean; requireFriend?:boolean; allowEmptyTotal?:boolean; busy?:boolean; compact?:boolean; trip?:boolean; unavailableIds?:string[]; preserveOrder?:boolean
}) {
 const copy=(en:string,cn:string)=>zh?cn:en
 const [payerOpen,setPayerOpen]=useState(false)
 const [error,setError]=useState('')
 const update=(patch:Partial<SplitValues>)=>{setError('');onUpdate(patch)}
 const [pendingConsumers,setPendingConsumers]=useState<string[]|null>(null)
 const computedAmount=(()=>{try{return calculateQuickAmount(values.calculation??values.amount,values.currency)}catch{return ''}})()
 const total=(()=>{try{return parseMajorAmount(computedAmount,values.currency)}catch{return 0}})()
 const money=(n:number)=>`${values.currency==='MYR'?'RM':values.currency} ${groupAmount(major(n,values.currency))}`
 const ordered=participants.filter(p=>values.selectedParticipantIds.includes(p.id)).sort((a,b)=>preserveOrder?0:a.id===currentParticipantId?-1:b.id===currentParticipantId?1:0)
 let shares=new Map<string,number>()
 let invalid=false
 try { shares=values.splitMode==='equal'?equalMinorShares(total,ordered.map(p=>p.id)):new Map(ordered.map(p=>[p.id,zeroOrMinor(values.exactShareAmounts[p.id]??'',values.currency)]))
  if(trip&&values.detailsExpanded){shares=tripItemMinorShares(total,values.currency,ordered.map(p=>p.id),values.items??[]);invalid=values.splitMode!=='exact'||ordered.some(p=>zeroOrMinor(values.exactShareAmounts[p.id]??'',values.currency)!==shares.get(p.id))}
 } catch { invalid=true }
 const payerPeople=trip?participants:ordered
 const changeConsumers=(ids:string[])=>{
  const removed=values.selectedParticipantIds.filter(id=>!ids.includes(id))
  if(trip&&removed.some(id=>(shares.get(id)??0)>0||values.items?.some(item=>item.participantIds.includes(id)))){setPendingConsumers(ids);return}
  update(trip?{selectedParticipantIds:ids}:{selectedParticipantIds:ids,payerAmounts:{},exactShareAmounts:{},splitMode:'equal'})
 }
 const confirmConsumers=()=>{if(pendingConsumers){update({selectedParticipantIds:pendingConsumers});setPendingConsumers(null)}}
 const selfPaid=(()=>{try{return Object.values(values.payerAmounts).some(a=>a.trim())?zeroOrMinor(values.payerAmounts[currentParticipantId]??'',values.currency):total}catch{return 0}})()
 const selfShare=shares.get(currentParticipantId)??0
 const setExact=(id:string,raw:string)=>{
  const amounts={...values.exactShareAmounts,[id]:raw},last=ordered.at(-1)?.id
  if(last && last!==id && total>0){try{const assigned=ordered.filter(p=>p.id!==last).reduce((sum,p)=>sum+zeroOrMinor(amounts[p.id]??'',values.currency),0);if(assigned<=total)amounts[last]=major(total-assigned,values.currency)}catch{/* Retain invalid input for correction. */}}
  update({exactShareAmounts:amounts})
 }
 const apply=()=>{
  if(readOnly){onApply();return}
  if(trip&&(!ordered.length||unavailableIds.some(id=>values.selectedParticipantIds.includes(id)))){setError(copy('Choose at least one current Trip consumer. Historical members cannot be used for a new correction.','请至少选择一名当前行程消费成员；已离开成员不能用于新的更正。'));return}
  if(allowEmptyTotal && total===0){onApply();return}
  let paidTotal=total
  try{if(Object.values(values.payerAmounts).some(v=>v.trim()))paidTotal=payerPeople.reduce((sum,p)=>sum+zeroOrMinor(values.payerAmounts[p.id]??'',values.currency),0)}catch{paidTotal=-1}
  if(requireFriend&&ordered.length<2){setError(copy('Select at least one friend for a shared expense.','共享账目至少需要选择一位朋友。'));return}
  if(trip&&values.detailsExpanded&&invalid){setError(copy('Calculate item shares again before applying.','应用前请重新计算项目份额。'));return}
  if(invalid||total<=0||[...shares.values()].reduce((sum,n)=>sum+n,0)!==total||paidTotal!==total){setError(copy('Shares and payments must each add up to the total.','份额和付款金额都必须等于总金额。'));return}
  setError('');onApply()
 }
 const payerControl=(<button type="button" className="qa-account-row" aria-label={Object.values(values.payerAmounts).some(v=>v.trim())?copy('Payment amounts','付款金额'):copy('Paid by You','由我付款')} onClick={()=>setPayerOpen(v=>!v)}><QuickIcon name="wallet"/><span><strong>{Object.values(values.payerAmounts).some(v=>v.trim())?copy('Payment amounts','付款金额'):copy('Paid by You','由我付款')}</strong><small>{trip?money(total):accountLabel??copy('Existing payment record','原有付款记录')}</small></span><span>›</span></button>)
 return <div className="qa-split-editor" data-compact={compact} data-trip={trip}><div className="qa-split-header">
 {trip?<p className="qa-trip-context">{label}</p>:null}
 {compact?<div className="qa-total-row"><div><small>{copy('TOTAL EXPENSE','消费总额')}</small><strong>{money(total)}</strong></div><div><span>{copy(`${ordered.length} people`,`${ordered.length} 人`)}</span>{onChoosePeople?<button className="qa-text-button" type="button" onClick={onChoosePeople}>{copy(trip?'Change ledger':'Edit people',trip?'切换账本':'选择对象')}</button>:<small>{label}</small>}</div></div>:<><div className="qa-split-context"><strong>{label}</strong>{onChoosePeople?<button className="qa-text-button" type="button" onClick={onChoosePeople}>{copy('Choose people','选择对象')}</button>:null}</div><p className="qa-helper">{copy('Total amount','总金额')}</p><p className="qa-split-total">{money(total)}</p></>}
 {trip?payerControl:null}
 <div className="qa-segment" inert={readOnly}><button type="button" aria-pressed={values.splitMode==='equal'&&!values.detailsExpanded} onClick={()=>update({splitMode:'equal',exactShareAmounts:{},detailsExpanded:false})}>{copy('Equally','平均')}</button><button type="button" aria-pressed={values.splitMode==='exact'&&!values.detailsExpanded} onClick={()=>update({splitMode:'exact',detailsExpanded:false})}>{copy('Amounts','指定金额')}</button><button type="button" aria-pressed={values.detailsExpanded} onClick={()=>update({detailsExpanded:!values.detailsExpanded})}>{copy('By item','按项目')}</button></div>
 </div><div className="qa-split-body">
 {!trip?payerControl:null}
 {payerOpen?<div className="qa-stack">{payerPeople.map(p=><label className="qa-split-person" key={p.id}><span>{p.id===currentParticipantId?copy('You','我'):p.displayName}</span><AmountInput readOnly={readOnly} aria-label={copy(`Paid by ${p.displayName}`,`${p.displayName} 付款`)} inputMode="decimal" placeholder={p.id===currentParticipantId?computedAmount:'0'} value={values.payerAmounts[p.id]??''} onValueChange={raw =>update({payerAmounts:{...values.payerAmounts,[p.id]:raw}})}/></label>)}<button className="qa-text-button" type="button" disabled={readOnly} onClick={()=>update({payerAmounts:{}})}>{copy('Reset · I paid all','重置为我付全额')}</button></div>:null}
 {values.detailsExpanded?<div inert={readOnly}><QuickItems values={values} participants={ordered.map(p=>({id:p.id,name:p.displayName}))} onUpdate={update} zh={zh} strict={trip} keepOpen={compact}/></div>:null}
 {trip?<div className="qa-trip-select"><span>{copy(`${ordered.length} / ${participants.filter(p=>!unavailableIds.includes(p.id)).length} selected`,`已选 ${ordered.length} / ${participants.filter(p=>!unavailableIds.includes(p.id)).length} 人`)}</span><button type="button" className="qa-text-button" disabled={readOnly||busy||!allowSelectionChange} onClick={()=>changeConsumers(ordered.length===participants.filter(p=>!unavailableIds.includes(p.id)).length?[currentParticipantId]:participants.filter(p=>!unavailableIds.includes(p.id)).map(p=>p.id))}>{ordered.length===participants.filter(p=>!unavailableIds.includes(p.id)).length?copy('Only me','仅自己'):copy('Select all','全选')}</button></div>:null}
 {pendingConsumers?<div className="qa-consumer-warning" role="alert"><p>{copy('Consumption shares will change. Payments and previous records stay unchanged. Review exact amounts and items before applying.','消费份额将改变，付款与旧账保持不变。应用前请核对指定金额和项目。')}</p><button type="button" onClick={()=>setPendingConsumers(null)}>{copy('Cancel','取消')}</button><button type="button" onClick={confirmConsumers}>{copy('Change consumers','修改消费对象')}</button></div>:null}
 {participants.map(p=><div key={p.id} className="qa-split-person" data-selected={values.selectedParticipantIds.includes(p.id)}><label><input aria-label={p.id===currentParticipantId?copy('You','我'):p.displayName} type="checkbox" checked={values.selectedParticipantIds.includes(p.id)} disabled={readOnly || !allowSelectionChange || (!trip&&p.id===currentParticipantId) || unavailableIds.includes(p.id)} onChange={()=>changeConsumers(values.selectedParticipantIds.includes(p.id)?values.selectedParticipantIds.filter(id=>id!==p.id):[...values.selectedParticipantIds,p.id])}/><span className="qa-avatar">{p.displayName.slice(0,1)}</span><span>{p.id===currentParticipantId?copy('You','我'):p.displayName}{unavailableIds.includes(p.id)?<small>{copy('Left Trip','已离开 Trip')}</small>:null}</span></label>{values.selectedParticipantIds.includes(p.id)?values.splitMode==='exact'&&(!compact||!values.detailsExpanded)?<AmountInput readOnly={readOnly} inputMode="decimal" aria-label={copy(`Share for ${p.displayName}`,`${p.displayName} 份额`)} value={values.exactShareAmounts[p.id]??''} placeholder="0.00" onValueChange={raw =>setExact(p.id,raw)}/>:<strong>{money(shares.get(p.id)??0)}</strong>:null}</div>)}
 </div><footer className="qa-split-footer">
 <div className="qa-split-summary">{trip?<p><span>{copy('Your share','你的消费')}</span><strong>{money(selfShare)}</strong></p>:null}<p><span>{copy('You pay','我支付')}</span><strong>{money(selfPaid)}</strong></p><p><span>{selfPaid>=selfShare?copy('To collect','待收回'):copy('You owe','我待付')}</span><strong>{money(Math.abs(selfPaid-selfShare))}</strong></p></div>

 <button type="button" className="qa-primary qa-panel-footer" disabled={busy||(!readOnly&&trip&&!ordered.length)} onClick={apply}>{readOnly?copy('Done','完成'):copy('Apply split','应用分摊')}</button>
 {onRemove&&!readOnly?<button type="button" className="qa-text-button" onClick={onRemove}>{copy('Remove split · personal expense','取消分摊 · 个人消费')}</button>:null}
 {error?<p role="alert" className="qa-error">{error}</p>:null}
 </footer></div>
}
function QuickItems({values,participants,onUpdate,zh,keepOpen=false,strict=false}:{values:SplitValues;participants:{id:string;name:string}[];onUpdate:(patch:Partial<SplitValues>)=>void;zh:boolean;keepOpen?:boolean;strict?:boolean}){
 const items=values.items??[]
 const [error,setError]=useState('')
 const patch=(next:NonNullable<UniversalQuickAddValues['items']>)=>onUpdate({items:next})
 const apply=()=>{try{
  const amounts:Record<string,number>=Object.fromEntries(participants.map(p=>[p.id,0]))
  let total=0
  if(!items.length)throw new Error()
  for(const item of items){if(strict&&item.participantIds.some(id=>!participants.some(p=>p.id===id)))throw new Error();const minor=parseMajorAmount(item.amount,values.currency);const ids=item.participantIds.filter(id=>participants.some(p=>p.id===id));const shares=equalMinorShares(minor,ids);total+=minor;for(const [id,n] of shares)amounts[id]+=n}
  const expected=parseMajorAmount(calculateQuickAmount(values.calculation??values.amount,values.currency),values.currency)
  if(total!==expected)throw new Error()
  onUpdate({splitMode:'exact',exactShareAmounts:Object.fromEntries(Object.entries(amounts).map(([id,n])=>[id,major(n,values.currency)])),detailsExpanded:keepOpen});setError('')
 }catch{setError(zh?'每个项目需要金额及成员，项目总额须等于消费总额。':'Each item needs an amount and people; item amounts must match the total.') }}
 return <div className="qa-items"><h3>{zh?'按项目分摊':'Split by item'}</h3>{strict&&items.some(item=>item.participantIds.some(id=>!participants.some(p=>p.id===id)))?<div role="alert"><p>{zh?'部分项目仍分配给已取消的消费对象，请核对。':'Some item assignments refer to unselected consumers. Review them before applying.'}</p><button type="button" onClick={()=>patch(items.map(item=>({...item,participantIds:item.participantIds.filter(id=>participants.some(p=>p.id===id))}))) }>{zh?'移除未选对象的项目分配':'Remove unselected item assignments'}</button></div>:null}{items.map((item,i)=><div className="qa-item" key={item.id}><div className="qa-two-buttons"><input aria-label={`Item ${i+1} name`} placeholder={zh?'项目名称':'Item name'} value={item.name} onChange={e=>patch(items.map((r,j)=>j===i?{...r,name:e.target.value}:r))}/><AmountInput aria-label={`Item ${i+1} amount`} inputMode="decimal" placeholder="0.00" value={item.amount} onValueChange={raw =>patch(items.map((r,j)=>j===i?{...r,amount:raw}:r))}/><button type="button" aria-label={`Remove item ${i+1}`} onClick={()=>patch(items.filter((_,j)=>j!==i))}><QuickIcon name="close" size={16}/></button></div><div className="qa-item-people">{participants.map(p=><label key={p.id}><input type="checkbox" aria-label={strict?(zh?`项目 ${i+1}：${p.name}`:`Item ${i+1}: ${p.name}`):undefined} checked={item.participantIds.includes(p.id)} onChange={()=>patch(items.map((r,j)=>j===i?{...r,participantIds:r.participantIds.includes(p.id)?r.participantIds.filter(id=>id!==p.id):[...r.participantIds,p.id]}:r))}/>{p.name}</label>)}</div></div>)}<div className="qa-two-buttons"><button type="button" onClick={()=>patch([...items,{id:crypto.randomUUID(),name:'',amount:'',participantIds:participants.map(p=>p.id)}])}>{zh?'新增项目':'Add item'}</button><button type="button" className="qa-primary" onClick={apply}>{zh?'计算份额':'Calculate shares'}</button></div>{error?<p className="qa-error" role="alert">{error}</p>:null}</div>
}
