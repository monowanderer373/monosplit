import {useEffect,useEffectEvent,useRef,useState}from'react'
import {useNavigate}from'react-router-dom'
import {loadCreatorNotices}from'../../lib/creatorSettlement'
import {creatorHomeNotice}from'../../hooks/useCreatorNotices'
import type{HomeNotification,NoticeRef}from'../../lib/homeNotifications'
import {useT}from'../../lib/i18n'
import NotificationSurface from'./NotificationSurface'
export default function CreatorNoticeTarget({identity,target,onViewed,onClose}:{identity:string;target:NoticeRef;onViewed:(notice:HomeNotification)=>void;onClose:()=>void}){
 const navigate=useNavigate(),t=useT(),focus=useRef<HTMLElement|null>(null),[reload,setReload]=useState(0),[state,setState]=useState<'loading'|'unavailable'|'retry'>('loading')
 const viewed=useEffectEvent(onViewed)
 useEffect(()=>{let active=true;void loadCreatorNotices(identity,target.id).then(feed=>{if(!active)return;const n=feed.notices.find(n=>n.id===target.id);if(!n){setState('unavailable');return}viewed(creatorHomeNotice(n));navigate('/space/'+n.tripId+'?tab=balances&creatorRecord='+n.recordId,{replace:true,state:{noticeBack:true}})},()=>{if(active)setState('retry')});return()=>{active=false}},[identity,target.id,navigate,reload])
 return <NotificationSurface page title={t('notice.title')} onClose={onClose} busy={false} returnFocus={focus} outcome={state}><p role={state==='retry'?'alert':'status'}>{t(state==='loading'?'notice.check':state==='retry'?'notice.retryInfo':'notice.unavailable')}</p>{state==='retry'?<button type="button" onClick={()=>{setState('loading');setReload(n=>n+1)}}>{t('notice.check')}</button>:null}</NotificationSurface>
}
