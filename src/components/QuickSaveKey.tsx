import {useEffect,useRef,useState} from 'react'
import QuickIcon from './QuickIcon'

/** One submission gesture; release after a hold must never become another save. */
export default function QuickSaveKey({disabled,canContinue,zh,onSave}:{disabled:boolean;canContinue:boolean;zh:boolean;onSave:(next:boolean)=>void}) {
 const saveRef=useRef(onSave)
 useEffect(()=>{saveRef.current=onSave},[onSave])
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const consumed=useRef(false)
 useEffect(()=>{if(disabled&&timer.current){clearTimeout(timer.current);timer.current=null;consumed.current=true}},[disabled])
 const [holding,setHolding]=useState(false)
 const [options,setOptions]=useState(false)
 const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setHolding(false)}
 useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[])
 useEffect(()=>{const clear=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;consumed.current=true;setHolding(false)};window.addEventListener('blur',clear);return()=>window.removeEventListener('blur',clear)},[])
 return <><button type="button" className={`qa-save-key${holding&&!disabled?' is-holding':''}`} disabled={disabled} aria-label={zh?'保存并收起':'Save and close'} aria-describedby="qa-save-help"
 onPointerDown={e=>{if(disabled||e.button!==0)return;consumed.current=false;if(!canContinue)return;e.currentTarget.setPointerCapture(e.pointerId);setHolding(true);timer.current=setTimeout(()=>{timer.current=null;consumed.current=true;setHolding(false);saveRef.current(true)},1000)}}
 onPointerMove={e=>{const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){cancel();consumed.current=true}}}
 onPointerCancel={()=>{cancel();consumed.current=true}} onPointerUp={cancel}
 onClick={e=>{cancel();if(consumed.current&&e.detail!==0){consumed.current=false;return}saveRef.current(false)}}>
 <QuickIcon name="check"/><span>{zh?'保存':'Save'}</span></button>
 <div className="qa-save-options"><span id="qa-save-help">{canContinue?(zh?'长按保存并继续':'Hold to save & next'):(zh?'保存这笔消费':'Save this expense')}</span>{canContinue?<><button type="button" aria-label={zh?'保存选项':'Save options'} aria-expanded={options} disabled={disabled} onClick={()=>setOptions(v=>!v)}>⋯</button>{options?<button type="button" className="qa-next-option" disabled={disabled} onClick={()=>{setOptions(false);saveRef.current(true)}}>{zh?'保存并继续':'Save & next'}</button>:null}</>:null}</div></>
}
