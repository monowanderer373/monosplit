import { useState, useSyncExternalStore } from 'react'
import type { SettlementIntent } from '../lib/settlementIntent'
import type { TranslationKey } from '../lib/i18n'
type Draft = { amounts: Record<string,string>; intents: Record<string,SettlementIntent|undefined>; expanded: string; action: string; error: TranslationKey|'' }
function createDraft() {
  let value:Draft={amounts:{},intents:{},expanded:'',action:'',error:''}
  const listeners=new Set<()=>void>(), attempts=new Map<string,string>()
  return { get:()=>value, subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener)}},
    set:(patch:Partial<Draft>)=>{value={...value,...patch};listeners.forEach(listener=>listener())},
    attempts }
}
const drafts=new Map<string,ReturnType<typeof createDraft>>()
let owner=''
/** Memory only. Shared across Trip views; never stores server facts or another identity's draft. */
function cachedDraft(key:string){const identity=key.split(':')[0];if(owner!==identity){drafts.clear();owner=identity}if(!drafts.has(key))drafts.set(key,createDraft());return drafts.get(key)!}
export function useSettlementDraft(key?:string) {
  const [local]=useState(createDraft)
  const store=key?cachedDraft(key):local
  const value=useSyncExternalStore(store.subscribe,store.get,store.get)
  return {value,...store}
}
