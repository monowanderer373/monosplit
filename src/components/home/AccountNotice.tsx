import './notifications-a.css'
import QuickIcon from '../QuickIcon'
import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react'
import {useT} from '../../lib/i18n'
import {useStore} from '../../store/useStore'
import {formatDate} from '../../lib/locale'
import {noticeCalendarDate} from '../../lib/homeNotifications'
import {noticeRowAction,saveNoticeOrigin,takeNoticeOrigin,type NoticeOrigin} from '../../lib/notificationPresentation'
import type {HomeNotification} from '../../lib/homeNotifications'
export default function AccountNotice({identity,targetOpen=false,timezone='Asia/Kuala_Lumpur',notices=[],status='ready',unread=new Set<string>(),onAction,onRetry}: {identity?:string;targetOpen?:boolean;timezone?:string;notices?:readonly HomeNotification[];status?:'loading'|'ready'|'error';unread?:ReadonlySet<string>;onAction?:(notice:HomeNotification)=>void;onRetry?:()=>unknown}){
  const lang=useStore(s=>s.lang),t=useT(),[open,setOpen]=useState(false),[tab,setTab]=useState<'tasks'|'activity'>('tasks')
  const wrapper=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),id=useId()
  const restore=useRef<NoticeOrigin|null>(null)
  useEffect(()=>{
    if(!identity||targetOpen)return
    const origin=takeNoticeOrigin(identity)
    if(origin){restore.current=origin;setTab(origin.tab);setOpen(true)}
  },[identity,targetOpen])
  useLayoutEffect(()=>{
    if(!open||!restore.current||status!=='ready')return
    const origin=restore.current
    const frame=requestAnimationFrame(()=>{
      const list=panel.current?.querySelector<HTMLElement>('.home-notice-list');if(list)list.scrollTop=origin.scrollTop
      window.scrollTo({top:origin.pageScroll,behavior:'instant'})
      const row=[...panel.current?.querySelectorAll<HTMLElement>('[data-notice-id]')??[]].find(r=>r.dataset.noticeId===origin.rowId)
      ;(row??panel.current?.querySelector<HTMLElement>('[aria-selected="true"]')??trigger.current)?.focus({preventScroll:true})
      restore.current=null
    })
    return()=>cancelAnimationFrame(frame)
  },[open,tab,status,notices])
  const close=(restore=false)=>{setOpen(false);if(restore)trigger.current?.focus({preventScroll:true})}
  useLayoutEffect(()=>{
    if(!open||!panel.current||!wrapper.current)return
    const node=panel.current,anchor=wrapper.current
    const fit=()=>{
      const a=anchor.getBoundingClientRect(),viewport=window.visualViewport
      const width=viewport?.width??document.documentElement.clientWidth
      node.style.left=`${Math.max(16,Math.min(a.left,width-16-node.getBoundingClientRect().width))-a.left}px`
      const safe=parseFloat(getComputedStyle(node).getPropertyValue('--notice-safe-bottom'))||0
      node.style.maxHeight=`${Math.max(144,(viewport?.height??innerHeight)-a.bottom-20-safe)}px`
    }
    fit();const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(fit);observer?.observe(node);observer?.observe(anchor)
    window.addEventListener('resize',fit);window.visualViewport?.addEventListener('resize',fit)
    return()=>{observer?.disconnect();window.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('resize',fit)}
  },[open])
  useEffect(()=>{
    if(!open)return
    panel.current?.focus({preventScroll:true})
    const outside=(e:globalThis.PointerEvent|FocusEvent)=>{if(e.target instanceof Node&&!wrapper.current?.contains(e.target))setOpen(false)}
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus({preventScroll:true})}}
    document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);document.removeEventListener('keydown',escape)}
  },[open])
  const pending=notices.filter(n=>n.tab==='tasks').reduce((count,n)=>count+(n.taskCount??1),0),visible=notices.filter(n=>n.tab===tab)
  const countLabel=!notices.length&&status!=='ready'?t(status==='loading'?'home.loading':'home.unavailable'):t('notice.count',{count:pending})
  return <div className="home-notice-anchor" ref={wrapper}>
    <button ref={trigger} type="button" className="home-account-notice" data-testid="home-account-notice" aria-label={`${t('notice.title')} · ${countLabel}${unread.size?` · ${t('notice.unread')}`:''}`} title={t('notice.title')} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(v=>!v)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4M12 2v2"/></svg>
      {unread.size>0?<span className="home-account-notice-dot" aria-hidden="true"/>:null}
      {pending>0?<span className="home-notice-count" aria-hidden="true">{pending>99?'99+':pending}</span>:null}
    </button>
    {open?<section ref={panel} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} tabIndex={-1} className="home-notice-popover" data-testid="home-notice-popover">
      <header><h2 id={`${id}-title`}>{t('notice.title')}</h2><button type="button" className="home-icon-button" aria-label={t('home.close')} onClick={()=>close(true)}>×</button></header>
      <div role="tablist" aria-label={t('notice.title')} className="home-notice-tabs">{(['tasks','activity']as const).map(key=><button type="button" key={key} role="tab" id={`${id}-${key}`} aria-controls={`${id}-list`} aria-selected={tab===key} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setTab(key==='tasks'?'activity':'tasks');document.getElementById(`${id}-${key==='tasks'?'activity':'tasks'}`)?.focus()}}}>{t(key==='tasks'?'notice.tasks':'notice.activity')}{key==='tasks'&&(status==='ready'||notices.length>0)?<span> {pending}</span>:null}</button>)}</div>
      {status==='loading'?<p role="status" className="home-notice-message">{t('home.loading')}</p>:null}
      {status==='error'?<div role="alert" className="home-notice-message"><p>{t('notice.error')}</p><button type="button" className="home-notice-retry" onClick={()=>void onRetry?.()}>{t('common.retry')}</button></div>:null}
      <div role="tabpanel" id={`${id}-list`} aria-labelledby={`${id}-${tab}`} tabIndex={0} className="home-notice-list">
        {!visible.length&&status==='ready'?<p className="home-notice-message">{t(tab==='tasks'?'notice.noTasks':'notice.noActivity')}</p>:null}
        <ul>{visible.map(n=><li key={n.id}><button type="button" className="home-notice-row" data-notice-id={n.id} data-unread={unread.has(n.id)} aria-description={unread.has(n.id)?t('notice.unread'):undefined} onClick={()=>{if(identity)saveNoticeOrigin(identity,{tab,scrollTop:panel.current?.querySelector('.home-notice-list')?.scrollTop??0,rowId:n.id,pageScroll:window.scrollY});close();onAction?.(n)}}>
          <span className="home-notice-icon" aria-hidden="true"><QuickIcon name={n.tab==='activity'&&n.state==='completed'?'check':({Drinks:'Drink',transport:'Transport',Transportation:'Transport'}as Record<string,string>)[n.icon??'']??n.icon??'Bills'} size={21}/></span><span className="home-notice-copy"><span className="home-notice-headline"><strong>{n.fundingGroup?t('mc.verify.group',{account:n.relatedAccountName||t('mc.verify.unassigned'),count:n.taskCount??1}):n.ref.kind==='account'?t('noticeA.account.negative'):n.description||t(n.title)}</strong>{n.ref.kind!=='account'&&!n.fundingGroup?<span className="home-notice-action"> · {t(noticeRowAction(n))}</span>:null}{unread.has(n.id)?<span className="home-notice-new" aria-hidden="true">•</span>:null}</span><span className="home-notice-metadata">{n.date?<time dateTime={noticeCalendarDate(n.date,timezone)}>{formatDate(noticeCalendarDate(n.date,timezone),lang)}</time>:null}{n.date?<span aria-hidden="true"> · </span>:null}<span>{n.relatedAccountName||n.contextLabel||t(n.ref.kind==='funding'?'noticeA.funding.noAccount':n.scope.kind==='personal'?'home.chipPersonal':'home.chipDirect')}</span></span></span><span aria-hidden="true" className="home-notice-arrow">›</span>
        </button></li>)}</ul>
      </div>
    </section>:null}
  </div>
}
