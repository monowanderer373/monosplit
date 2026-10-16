import { notificationRpc } from './notificationRepository'
import { generateId } from './id'

/** Retry the same command, never a second debit. Storage contains opaque metadata only. */
export async function moneyOperation(name:string,args:Record<string,unknown>,identity:string,scope:string,guard:()=>void) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({name,args})))
  guard()
  const fingerprint=Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')
  const key=`tt-money-operation:${identity}:${scope}`
  let requestId=generateId(),retry=false
  try {
    const old=JSON.parse(sessionStorage.getItem(key)??'null')
    if(old?.fingerprint===fingerprint&&typeof old.requestId==='string'&&/^[0-9a-f-]{36}$/i.test(old.requestId)){requestId=old.requestId;retry=true}
    sessionStorage.setItem(key,JSON.stringify({fingerprint,requestId}))
  } catch { /* The server still enforces request and target uniqueness. */ }
  guard()
  if(retry){
    const result=await notificationRpc('get_personal_money_operation',{request_id:requestId},identity,guard)
    guard()
    if(result)return result
  }
  const result=await notificationRpc(name,{request_id:requestId,...args},identity,guard)
  guard()
  return result
}
