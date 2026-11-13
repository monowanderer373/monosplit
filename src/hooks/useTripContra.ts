import {useCallback,useEffect,useRef,useState} from 'react'
import {readTripContra,type ContraSnapshot} from '../lib/tripContra'

export type TripContraState={snapshot:ContraSnapshot|null;status:'idle'|'loading'|'ready'|'error';error:string;refresh:()=>void}

export function useTripContra({identity,actor,trip,enabled,sourceStamp='',mode='system',rate='',currency='MYR'}:{
  identity:string;actor:string;trip:string;enabled:boolean;sourceStamp?:string;mode?:'system'|'custom';rate?:string;currency?:string
}):TripContraState {
  const key=JSON.stringify([identity,actor,trip,mode,mode==='custom'?rate:'',currency,sourceStamp])
  const [state,setState]=useState<{key:string;value:ContraSnapshot|null;status:TripContraState['status'];error:string}>({key:'',value:null,status:'idle',error:''})
  const [reload,setReload]=useState(0),sequence=useRef(0)
  const refresh=useCallback(()=>setReload(n=>n+1),[])
  useEffect(()=>{
    if(!enabled)return
    let active=true;const seq=++sequence.current
    void Promise.resolve().then(()=>{
      if(active)setState(old=>({key,value:old.key===key?old.value:null,status:'loading',error:''}))
      return readTripContra(identity,actor,trip,mode,rate,currency)
    }).then(value=>{if(active&&seq===sequence.current)setState({key,value,status:'ready',error:''})},cause=>{
      if(active&&seq===sequence.current)setState({key,value:null,status:'error',error:cause instanceof Error?cause.message:'contra_read_failed'})
    })
    return()=>{active=false}
  },[key,identity,actor,trip,enabled,mode,rate,currency,reload])
  useEffect(()=>{
    if(!enabled)return
    const update=()=>refresh(),change=(event:Event)=>{if((event as CustomEvent).detail?.trip===trip)refresh()}
    const timer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},15000)
    window.addEventListener('focus',update);window.addEventListener('online',update);window.addEventListener('tt:creator-settlement-changed',change)
    return()=>{clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('online',update);window.removeEventListener('tt:creator-settlement-changed',change)}
  },[enabled,refresh,trip])
  const matches=state.key===key
  return {snapshot:enabled&&matches?state.value:null,status:!enabled?'idle':matches?state.status:'loading',error:matches?state.error:'',refresh}
}
