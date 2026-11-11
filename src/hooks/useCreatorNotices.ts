import {useEffect,useState}from'react'
import {supabase}from'../lib/supabase'
import {loadCreatorNotices,type CreatorNotice,type CreatorNoticeFeed}from'../lib/creatorSettlement'
import {noticeKey,type HomeNotification}from'../lib/homeNotifications'
export function creatorHomeNotice(n:CreatorNotice):HomeNotification{
 const ref={kind:'creator' as const,id:n.id}
 return{id:noticeKey(ref),ref,intent:'view-current',source:'shared-ledger',version:String(n.version),tab:n.pending?'tasks':'activity',state:n.pending?'pending':n.kind==='creator_reversed'?'changed':'completed',title:n.kind==='creator_recorded'?'notice.creatorRecorded':n.kind==='creator_reversed'?'notice.creatorReversed':n.kind==='correction_requested'?'notice.creatorCorrection':'notice.creatorResolved',titleValues:{name:n.actorName},action:'notice.view',description:'',date:n.date,contextLabel:n.tripName,icon:'bank',scope:{kind:'space',spaceId:n.tripId}}
}
const empty:CreatorNoticeFeed={notices:[],managedPaymentIds:[]}
export function useCreatorNotices(identity:string|null,owner:string|null,refreshKey:string){
 const key=identity+':'+owner,[state,setState]=useState<{key:string;feed:CreatorNoticeFeed}>({key:'',feed:empty})
 useEffect(()=>{if(!identity||!owner)return;let active=true,sequence=0
  const load=()=>{const current=++sequence;void loadCreatorNotices(identity).then(feed=>{if(active&&current===sequence)setState({key,feed})},()=>{/* Preserve an already authorized feed during a temporary outage. Navigation rechecks each record. */})}
  const visible=()=>{if(document.visibilityState==='visible')load()};load();const interval=setInterval(visible,60000)
  window.addEventListener('focus',visible);window.addEventListener('online',visible);window.addEventListener('tt:creator-settlement-changed',visible)
  const channel=supabase?.channel('creator-notices:'+owner+':'+Date.now()).on('postgres_changes',{event:'*',schema:'public',table:'creator_settlement_notices',filter:'recipient_id=eq.'+owner},visible).subscribe()
  return()=>{active=false;clearInterval(interval);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);window.removeEventListener('tt:creator-settlement-changed',visible);if(channel&&supabase)void supabase.removeChannel(channel)}
 },[identity,owner,key,refreshKey])
 const feed=state.key===key?state.feed:empty
 return{notices:feed.notices.map(creatorHomeNotice),managedPaymentIds:feed.managedPaymentIds}
}
