import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { moneyOperation } from '../lib/moneyOperation'

export function useMoneyAction(identity:string,scope:string) {
  const epoch=useRef(0),active=useRef(false),lock=useRef(false)
  const context=`${identity}:${scope}`
  const [status,setStatus]=useState({context:'',busy:false,error:false})
  const invalidate=useCallback(()=>{active.current=false;epoch.current++;lock.current=false},[])
  useLayoutEffect(()=>{
    active.current=true;lock.current=false
    return invalidate
  },[identity,scope,invalidate])
  async function run(name:string,args:Record<string,unknown>,after:(result:unknown,guard:()=>void)=>Promise<void>|void){
    if(lock.current||!active.current)return
    lock.current=true;const token=++epoch.current
    const guard=()=>{if(!active.current||token!==epoch.current)throw new Error('notification_context_changed')}
    setStatus({context,busy:true,error:false})
    try {const result=await moneyOperation(name,args,identity,scope,guard);guard();await after(result,guard);guard()}
    catch {if(active.current&&token===epoch.current)setStatus({context,busy:true,error:true})}
    finally {if(active.current&&token===epoch.current){lock.current=false;setStatus(old=>old.context===context?{...old,busy:false}:old)}}
  }
  return {busy:status.context===context&&status.busy,error:status.context===context&&status.error,run}
}
