import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { acknowledgeMoneyOperation, moneyOperation } from '../lib/moneyOperation'

type After=(result:unknown,guard:()=>void)=>Promise<void>|void
type Attempt={context:string;name:string;args:Record<string,unknown>;after:After}
export function useMoneyAction(identity:string,scope:string) {
  const epoch=useRef(0),active=useRef(false),lock=useRef(false),uncertain=useRef(false),attempt=useRef<Attempt|null>(null)
  const context=`${identity}:${scope}`
  const [status,setStatus]=useState({context:'',busy:false,error:false,uncertain:false})
  const invalidate=useCallback(()=>{active.current=false;epoch.current++;lock.current=false;uncertain.current=false},[])
  useLayoutEffect(()=>{active.current=true;lock.current=false;return invalidate},[identity,scope,invalidate])
  async function run(name:string,args:Record<string,unknown>,after:After){
    if(lock.current||!active.current)return
    // A lost response freezes the original command; edited fields cannot mint a second request.
    if(uncertain.current&&attempt.current?.context===context){
      name=attempt.current.name;args=attempt.current.args;after=attempt.current.after
    }
    const command=structuredClone(args)
    attempt.current={context,name,args:command,after}
    lock.current=true;const token=++epoch.current
    const guard=()=>{if(!active.current||token!==epoch.current)throw new Error('notification_context_changed')}
    setStatus({context,busy:true,error:false,uncertain:uncertain.current})
    let receiptReturned=false
    try {
      const result=await moneyOperation(name,command,identity,scope,guard)
      receiptReturned=true
      guard();await after(result,guard)
      // A successful refreshed callback may close/unmount its own dialog.
      acknowledgeMoneyOperation(identity,scope)
      guard()
      uncertain.current=false;attempt.current=null
      setStatus({context,busy:false,error:false,uncertain:false})
    }catch(cause){
      if(active.current&&token===epoch.current){
        const code=(cause as {code?:string})?.code
        uncertain.current=receiptReturned||!code||!(code==='P0001'||/^(22|23|40|42)/.test(code))
        setStatus({context,busy:false,error:true,uncertain:uncertain.current})
      }
    }finally{if(active.current&&token===epoch.current){lock.current=false;setStatus(old=>old.context===context?{...old,busy:false}:old)}}
  }
  const retryOriginal=()=>{const original=attempt.current;if(original?.context===context)void run(original.name,original.args,original.after)}
  const current=status.context===context
  return {busy:current&&(status.busy||status.uncertain),running:current&&status.busy,error:current&&status.error,uncertain:current&&status.uncertain,run,retryOriginal}
}
