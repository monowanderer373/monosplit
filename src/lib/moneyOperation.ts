import { notificationRpc } from './notificationRepository'
import { generateId } from './id'

const storageKey=(identity:string,scope:string)=>`tt-money-operation:${identity}:${scope}`
/** Only opaque recovery metadata is persisted: never financial payloads or read results. */
export function acknowledgeMoneyOperation(identity:string,scope:string){
  try{sessionStorage.removeItem(storageKey(identity,scope))}catch{/* Original target/request guards remain server-authoritative. */}
}
export async function moneyOperation(name:string,args:Record<string,unknown>,identity:string,scope:string,guard:()=>void) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({name,args})))
  guard()
  const fingerprint=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')
  const key=storageKey(identity,scope)
  let requestId=generateId(),retry=false
  let old:{fingerprint:string;requestId:string}|null=null
  try{
    const value=JSON.parse(sessionStorage.getItem(key)??'null')
    if(typeof value?.fingerprint==='string'&&typeof value.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(value.requestId))old=value
  }catch{/* A current mounted action also retains its frozen original command. */}
  guard()
  if(old&&old.fingerprint!==fingerprint){
    // A reloaded/closed form may have lost its draft, but cannot silently replace an
    // unresolved request. The server lock either returns its committed receipt or
    // fences it before a delayed original HTTP request can post financial facts.
    const recovery=await notificationRpc('reconcile_personal_money_operation',{request_id:old.requestId},identity,guard) as {state?:string;result?:unknown}
    guard()
    if(recovery?.state==='committed')return recovery.result
    if(recovery?.state!=='not_posted')throw new Error('money_result_unconfirmed')
  }else if(old){requestId=old.requestId;retry=true}
  if(retry){
    const result=await notificationRpc('get_personal_money_operation',{request_id:requestId},identity,guard)
    guard()
    if((result as {operation_not_posted?:boolean}|null)?.operation_not_posted)requestId=generateId()
    else if(result)return result
  }
  // Require recoverable opaque metadata before dispatching a new financial write.
  sessionStorage.setItem(key,JSON.stringify({fingerprint,requestId}))
  guard()
  const result=await notificationRpc(name,{...args,request_id:requestId},identity,guard)
  guard()
  return result
}
