import { useCallback, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { pendingFundingGroups, type HomeNotification } from '../lib/homeNotifications'
import { loadNotificationSnapshot } from '../lib/notificationRepository'
import { noticeDestination } from '../lib/notificationPresentation'

/** Resolve 0/1/N from current authority; dismissing or switching identity invalidates late reads. */
export function useOpenHomeNotice(owner:string|null,identity:string|null,routeKey:string){
 const navigate=useNavigate(),epoch=useRef(0)
 const invalidate=useCallback(()=>{epoch.current++},[])
 useLayoutEffect(()=>invalidate,[owner,identity,routeKey,invalidate])
 return useCallback(async(notice:HomeNotification)=>{
  if(!notice.fundingGroup||!owner){navigate(noticeDestination(notice.ref),{state:{noticeBack:true}});return}
  const token=++epoch.current,parentId=notice.fundingGroup.parentId,list=`/accounts/verify?account=${parentId??'unassigned'}`
  try{
   const fresh=await loadNotificationSnapshot(owner)
   if(token!==epoch.current)return
   const current=pendingFundingGroups(fresh).find(g=>g.parentId===parentId)
   navigate(current?.intentIds.length===1?noticeDestination({kind:'funding',id:current.intentIds[0]}):list,{state:{noticeBack:true}})
  }catch{if(token===epoch.current)navigate(list,{state:{noticeBack:true}})}
 },[owner,navigate])
}
