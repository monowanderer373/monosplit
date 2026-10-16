import { useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pendingFundingGroups, type HomeNotification } from '../lib/homeNotifications'
import { loadNotificationSnapshot } from '../lib/notificationRepository'
import { noticeDestination, takeNoticeOrigin } from '../lib/notificationPresentation'

/** Resolve 0/1/N from current authority; dismissing or switching identity invalidates late reads. */
export function useOpenHomeNotice(owner:string|null,identity:string|null,routeKey:string){
 const navigate=useNavigate(),epoch=useRef(0),pending=useRef(false)
 const invalidate=useCallback(()=>{epoch.current++;pending.current=false},[])
 const cancel=useCallback(()=>{if(pending.current&&identity)takeNoticeOrigin(identity);invalidate()},[identity,invalidate])
 useLayoutEffect(()=>invalidate,[owner,identity,routeKey,invalidate])
 const open=useCallback(async(notice:HomeNotification)=>{
  const token=++epoch.current;pending.current=false
  if(!notice.fundingGroup||!owner){navigate(noticeDestination(notice.ref),{state:{noticeBack:true}});return}
  pending.current=true
  const parentId=notice.fundingGroup.parentId,list=`/accounts/verify?account=${parentId??'unassigned'}`
  try{
   const fresh=await loadNotificationSnapshot(owner)
   if(token!==epoch.current)return
   pending.current=false
   const current=pendingFundingGroups(fresh).find(g=>g.parentId===parentId)
   navigate(current?.intentIds.length===1?noticeDestination({kind:'funding',id:current.intentIds[0]}):list,{state:{noticeBack:true}})
  }catch{if(token===epoch.current){pending.current=false;navigate(list,{state:{noticeBack:true}})}}
 },[owner,navigate])
 return {open,cancel}
}
