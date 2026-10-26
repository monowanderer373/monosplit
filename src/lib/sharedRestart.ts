import type {CanonicalExpense} from '../types'
export type RestartEdge={canRequest?:boolean;id:string;debtorId:string;creditorId:string;recipientId:string;remainingMinor:number;effectiveMinor:number}
export type SplitRetag={id:string;edgeId:string;requesterId:string;recipientId:string;state:'pending'|'accepted'|'declined'|'superseded';expenseVersion:number;createdAt:string}
export type SharedRestartState={ownerIds:string[];hiddenForViewer:boolean;edges:RestartEdge[];retags:SplitRetag[]}
const minor=(v:unknown)=>{if(typeof v!=='number'&&(typeof v!=='string'||!/^\d+$/.test(v)))throw new Error('invalid_shared_restart_state');const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new Error('invalid_shared_restart_state');return n}
export function parseSharedRestart(value:unknown):SharedRestartState|undefined{
 if(value==null)return undefined
 const v=value as Record<string,unknown>
 if(!Array.isArray(v.owner_ids)||!v.owner_ids.every(x=>typeof x==='string')||typeof v.hidden_for_viewer!=='boolean'||!Array.isArray(v.edges)||!Array.isArray(v.retags))throw new Error('invalid_shared_restart_state')
 return{ownerIds:v.owner_ids,hiddenForViewer:v.hidden_for_viewer,edges:v.edges.map(x=>{
  if(!x||typeof x!=='object')throw new Error('invalid_shared_restart_state');const e=x as Record<string,unknown>
  for(const key of['id','debtor_id','creditor_id','recipient_id'])if(typeof e[key]!=='string')throw new Error('invalid_shared_restart_state')
  if(e.can_request!==undefined&&typeof e.can_request!=='boolean')throw new Error('invalid_shared_restart_state')
  return{canRequest:e.can_request as boolean|undefined,id:e.id as string,debtorId:e.debtor_id as string,creditorId:e.creditor_id as string,recipientId:e.recipient_id as string,remainingMinor:minor(e.remaining_minor),effectiveMinor:minor(e.effective_minor)}
 }),retags:v.retags.map(x=>{
  const r=x as Record<string,unknown>
  if(!r||!['pending','accepted','declined','superseded'].includes(String(r.state))||!['id','edge_id','requester_id','recipient_id','created_at'].every(k=>typeof r[k]==='string')||!Number.isSafeInteger(r.expense_version))throw new Error('invalid_shared_restart_state')
  return{id:r.id as string,edgeId:r.edge_id as string,requesterId:r.requester_id as string,recipientId:r.recipient_id as string,state:r.state as SplitRetag['state'],expenseVersion:r.expense_version as number,createdAt:r.created_at as string}
 })}
}
export const visibleSharedExpense=(expense:CanonicalExpense)=>!expense.sharedRestart?.hiddenForViewer
export function currentSharedObligation(expense:CanonicalExpense,debtor:string,creditor:string,original:number){
 const edge=expense.sharedRestart?.edges.find(e=>e.debtorId===debtor&&e.creditorId===creditor)
 return edge?Math.min(original,edge.effectiveMinor):expense.sharedRestart?.ownerIds.some(id=>id===debtor||id===creditor)?0:original
}
