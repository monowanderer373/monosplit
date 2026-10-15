import {useEffect,useRef,type ReactNode,type RefObject} from 'react'
import QuickIcon from '../QuickIcon'
import {HomeSheet} from './HomeScreen'
import {useT} from '../../lib/i18n'
import './notifications-a.css'

export default function NotificationSurface({page,title,onClose,busy,returnFocus,children,outcome}:{outcome?:string;page:boolean;title:string;onClose:()=>void;busy:boolean;returnFocus:RefObject<HTMLElement|null>;children:ReactNode}){
 useEffect(()=>{
  if(page)return
  const fit=()=>{const node=document.querySelector<HTMLElement>('.notification-a-dialog-backdrop'),v=window.visualViewport;if(node&&v){node.style.top=`${v.offsetTop}px`;node.style.left=`${v.offsetLeft}px`;node.style.height=`${v.height}px`;node.style.width=`${v.width}px`;node.style.setProperty('--notice-viewport-height',`${v.height}px`)}}
  fit();window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit)
  return()=>{window.visualViewport?.removeEventListener('resize',fit);window.visualViewport?.removeEventListener('scroll',fit)}
 },[page])
 const state=!!outcome&&['completed','changed','retry','unavailable','login','loading','no-account'].includes(outcome)
 const heading=state?<><span className={`notification-a-state-icon is-${outcome}`}><QuickIcon name={outcome==='completed'?'check':outcome==='retry'?'refresh':outcome==='unavailable'||outcome==='login'?'lock':outcome==='no-account'?'wallet':'Bills'}/></span><span>{title}</span></>:title
 return page?<NotificationPage title={title} onClose={onClose} busy={busy}>{children}</NotificationPage>:<HomeSheet title={heading} testId="notification-target" presentation="dialog" className={state?"notification-a-dialog notification-a-state-dialog":"notification-a-dialog"} onClose={onClose} dismissible={!busy} returnFocusRef={returnFocus}>{children}</HomeSheet>
}
function NotificationPage({title,onClose,busy,children}:{title:string;onClose:()=>void;busy:boolean;children:ReactNode}){
 const t=useT(),heading=useRef<HTMLHeadingElement>(null)
 useEffect(()=>{const frame=requestAnimationFrame(()=>heading.current?.focus({preventScroll:true}));return()=>cancelAnimationFrame(frame)},[])
 return <main className="notification-a-page" data-testid="notification-target" aria-labelledby="notification-page-title"><div className="notification-a-page-inner"><button type="button" className="notification-a-back" disabled={busy} onClick={onClose}>← {t('notice.title')}</button><h1 ref={heading} tabIndex={-1} id="notification-page-title">{title}</h1>{children}</div></main>
}
