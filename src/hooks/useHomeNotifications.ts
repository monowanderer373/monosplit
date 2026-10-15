import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
import {buildHomeNotifications,type HomeNotification,type NoticeSnapshot} from '../lib/homeNotifications'
import {loadNotificationSnapshot} from '../lib/notificationRepository'
import type {PendingLedgerCommand} from '../store/useStore'
const prefix='tt-notification-read:'
function read(identity:string|null):Record<string,string>{try{const v=identity?JSON.parse(localStorage.getItem(prefix+identity)??'{}'):{};return v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).filter((entry):entry is [string,string]=>entry[0].length<150&&typeof entry[1]==='string')):{}}catch{return {}}}
export function markNotificationRead(identity:string,notice:Pick<HomeNotification,'id'|'version'>){
  try{const next={...read(identity),[notice.id]:notice.version};localStorage.setItem(prefix+identity,JSON.stringify(Object.fromEntries(Object.entries(next).slice(-500))))}catch{/* Storage unavailable must not block navigation. */}
}
export function useHomeNotifications(identity:string|null,owner:string|null,outbox:readonly PendingLedgerCommand[],refreshKey:string){
  const [result,setResult]=useState<{owner:string|null;data:NoticeSnapshot|null;status:'loading'|'ready'|'error';revision:number}>({owner:null,data:null,status:'loading',revision:0})
  const [,setReadEpoch]=useState(0)
  const generation=useRef(0)
  const current=useRef(owner)
  // eslint-disable-next-line react-hooks/refs -- synchronous identity gate, same as useHomeData
  current.current=owner
  const invalidate=useCallback(()=>{generation.current++},[])
  const refresh=useCallback(async()=>{
    if(!owner)return
    const token=++generation.current
    try{const next=await loadNotificationSnapshot(owner);if(token===generation.current&&current.current===owner)setResult({owner,data:next,status:'ready',revision:token})}
    catch{if(token===generation.current&&current.current===owner)setResult(old=>({owner,data:old.owner===owner?old.data:null,status:'error',revision:token}))}
  },[owner])
  useEffect(()=>{
    let timer:ReturnType<typeof setTimeout>|undefined
    const schedule=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>void refresh(),100)}
    void refresh()
    const visible=()=>{if(document.visibilityState==='visible')schedule()}
    window.addEventListener('focus',schedule);window.addEventListener('online',schedule);window.addEventListener('tt:accounts-changed',schedule);document.addEventListener('visibilitychange',visible)
    const poll=setInterval(visible,60_000)
    let channel=owner&&supabase?supabase.channel(`home-notices:${owner}:${Date.now()}`):null
    for(const table of ['personal_funding_intents','personal_account_entries','personal_recurring_occurrences','personal_installments','expense_participations','direct_expense_change_approvals','settlement_allocations','settlement_payment_requests'])channel=channel?.on('postgres_changes',{event:'*',schema:'public',table},schedule)??null
    channel?.subscribe()
    return()=>{invalidate();if(timer)clearTimeout(timer);clearInterval(poll);window.removeEventListener('focus',schedule);window.removeEventListener('online',schedule);window.removeEventListener('tt:accounts-changed',schedule);document.removeEventListener('visibilitychange',visible);if(channel&&supabase)void supabase.removeChannel(channel)}
  },[owner,refresh,refreshKey,invalidate])
  const data=result.owner===owner?result.data:null
  const notices=useMemo(()=>data?buildHomeNotifications(data,outbox):[],[data,outbox])
  const reads=read(identity)
  const markRead=useCallback((notice:HomeNotification)=>{if(identity){markNotificationRead(identity,notice);setReadEpoch(n=>n+1)}},[identity])
  return {notices,contextRevision:result.owner===owner?result.revision:0,status:result.owner===owner?result.status:'loading' as const,unread:new Set(notices.filter(n=>reads[n.id]!==n.version).map(n=>n.id)),markRead,refresh}
}
