import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { unavailableFx, validateFx, type FxSnapshot } from '../lib/fx'

// Public rate metadata only. Deduplicate StrictMode, tabs and route transitions.
const requests = new Map<string, { promise: Promise<FxSnapshot>; expires: number }>()
export function useInsightsFx(identity: string, needed: boolean, pinned?: string) {
  const key = `${identity}:${pinned ?? 'latest'}`
  const [result, setResult] = useState<{ key: string; snapshot: FxSnapshot; updating: boolean }>({ key:'', snapshot:unavailableFx, updating:false })
  const load = useCallback(async () => {
    if (!identity || !needed || !supabase) return
    await Promise.resolve()
    setResult(old => ({ key, snapshot:old.key === key ? old.snapshot : unavailableFx, updating:true }))
    let request = requests.get(key)
    if (!request || request.expires < Date.now()) {
      const promise = Promise.resolve(supabase.rpc('insights_fx_snapshot',{ p_snapshot_id:pinned ?? null })).then(({data,error}) => {
        if (error) throw error
        return validateFx(data)
      })
      request = { promise, expires:Date.now()+60_000 }
      requests.set(key,request)
      promise.then(snapshot => {
        if (snapshot.id) requests.set(`${identity}:${snapshot.id}`,{promise:Promise.resolve(snapshot),expires:Date.now()+24*3600_000})
      }, () => { /* A short client cooldown also applies on network failure. */ })
    }
    try { return await request.promise } catch { return null }
  },[identity,needed,key,pinned])
  useEffect(() => {
    let active = true
    void Promise.resolve().then(load).then(snapshot => {
      if (!active) return
      setResult(old => old.key === key ? {key,snapshot:snapshot ?? {...old.snapshot,status:old.snapshot.id ? 'cached' : 'unavailable'},updating:false} : old)
    }).finally(() => { if (active) setResult(old => old.key === key ? {...old,updating:false} : old) })
    return () => { active=false }
  },[load,key])
  const retry = async () => {
    const snapshot = await load()
    setResult(old => old.key === key ? {key,snapshot:snapshot ?? {...old.snapshot,status:old.snapshot.id ? 'cached' : 'unavailable'},updating:false} : old)
  }
  const matching = result.key === key
  return { snapshot:needed && matching ? result.snapshot : unavailableFx, updating:needed && (!matching || result.updating), retry }
}
