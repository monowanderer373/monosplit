import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react'
import {createPortal} from 'react-dom'
import {useInRouterContext,useLocation,useNavigate} from 'react-router-dom'
import QuickIcon from './QuickIcon'
import {useAccessibleDialog} from '../hooks/useAccessibleDialog'
type Action=()=>void|boolean|Promise<void|boolean>
type Props={title:string;label:string;backLabel:string;onBack:Action;children:(finish:(action:Action)=>void)=>ReactNode}
type Navigation={popped:boolean;close:()=>void;restore:()=>void}
export default function QuickSplitPage(props:Props){return useInRouterContext()?<RoutedPage {...props}/>:<Page {...props}/>}
function RoutedPage(props:Props){
 const location=useLocation(),navigate=useNavigate(),initial=useState(location)[0],[entered,setEntered]=useState(false),pushed=useRef(false)
 const active=location.state?.quickSplitPage===true
 const push=()=>navigate(initial.pathname+initial.search+initial.hash,{state:{...initial.state,quickSplitPage:true}})
 useEffect(()=>{if(pushed.current)return;pushed.current=true;navigate(initial.pathname+initial.search+initial.hash,{state:{...initial.state,quickSplitPage:true}})},[navigate,initial]) // one child history entry, preserving the capture parent
 useEffect(()=>{if(active)queueMicrotask(()=>setEntered(true))},[active])
 return <Page {...props} navigation={{popped:entered&&!active,close:()=>navigate(-1),restore:push}}/>
}
function Page({title,label,backLabel,onBack,children,navigation}:Props&{navigation?:Navigation}){
 const [leaving,setLeaving]=useState(false),busy=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const latest=useRef({onBack,navigation});useLayoutEffect(()=>{latest.current={onBack,navigation}},[onBack,navigation])
 const finish=(action:Action)=>{
  if(busy.current)return;busy.current=true;setLeaving(true)
  const delay=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?0:250
  timer.current=setTimeout(()=>{void(async()=>{
   try{const ok=await action();if(ok===false){busy.current=false;setLeaving(false);if(latest.current.navigation?.popped)latest.current.navigation.restore();return}
    if(!latest.current.navigation?.popped)latest.current.navigation?.close()
   }catch{busy.current=false;setLeaving(false);if(latest.current.navigation?.popped)latest.current.navigation.restore()}
  })()},delay)
 }
 const dialog=useAccessibleDialog<HTMLElement>(()=>finish(latest.current.onBack))
 useEffect(()=>{if(navigation?.popped)finish(latest.current.onBack)},[navigation?.popped])
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
 useEffect(()=>{
  const viewport=window.visualViewport;let frame=0
  const resize=()=>{const node=dialog.current;if(!node)return;node.dataset.short=String((viewport?.height??window.innerHeight)<=520);node.style.setProperty('--split-height',`${viewport?.height??window.innerHeight}px`);node.style.setProperty('--split-top',`${viewport?.offsetTop??0}px`);const input=document.activeElement;if(input instanceof HTMLElement&&node.contains(input)&&input.matches('input,select')){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>input.scrollIntoView({block:'nearest'}))}}
  resize();viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);window.addEventListener('resize',resize)
  return()=>{cancelAnimationFrame(frame);viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);window.removeEventListener('resize',resize)}
 },[dialog])
 return createPortal(<div className="qa-backdrop qa-split-page-host"><div className="qa-main qa-stationery tt-qa-context qa-v3"><section ref={dialog} className="qa-panel qa-split-page-surface" data-leaving={leaving} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
 <header><button type="button" className="qa-icon-button" aria-label={backLabel} disabled={leaving} onClick={()=>finish(onBack)}><QuickIcon name="back" size={24}/></button><div><h2>{title}</h2><small>{label}</small></div></header><div className="qa-split-page-content" inert={leaving}><Content render={children} finish={finish}/></div>
 </section></div></div>,document.getElementById('root')??document.body)
}

function Content({render,finish}:{render:Props["children"];finish:(action:Action)=>void}){return render(finish)}
