/** @vitest-environment jsdom */
import {act,cleanup,renderHook,waitFor} from '@testing-library/react'
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {useHomeNotifications} from './useHomeNotifications'
import {loadNotificationSnapshot} from '../lib/notificationRepository'
import {noticeSnapshot} from '../test/notificationFixtures'
vi.mock('../lib/notificationRepository',()=>({loadNotificationSnapshot:vi.fn()}))
vi.mock('../lib/supabase',()=>({supabase:null}))
const load=vi.mocked(loadNotificationSnapshot),outbox:never[]=[]
beforeEach(()=>{vi.resetAllMocks();localStorage.clear()});afterEach(cleanup)
describe('identity and authority boundary for notifications',()=>{
 it('acknowledges a tray snapshot without completing tasks, persists on this device and keeps new versions unread',async()=>{
  let snapshot=noticeSnapshot();load.mockImplementation(async()=>structuredClone(snapshot))
  const hook=renderHook(()=>useHomeNotifications('id-one','owner',outbox,'same'));await waitFor(()=>expect(hook.result.current.status).toBe('ready'))
  const tasks=hook.result.current.notices.filter(n=>n.tab==='tasks').map(n=>n.id)
  act(()=>hook.result.current.markViewed(hook.result.current.notices))
  expect(hook.result.current.unread.size).toBe(0)
  expect(hook.result.current.notices.filter(n=>n.tab==='tasks').map(n=>n.id)).toEqual(tasks)
  hook.unmount()
  const again=renderHook(({identity})=>useHomeNotifications(identity,'owner',outbox,'same'),{initialProps:{identity:'id-one'}})
  await waitFor(()=>expect(again.result.current.status).toBe('ready'));expect(again.result.current.unread.size).toBe(0)
  snapshot=structuredClone(snapshot);snapshot.funding[0].version++
  await act(async()=>{await again.result.current.refresh()})
  expect(again.result.current.unread.has('funding:fund-1')).toBe(true)
  expect(again.result.current.unread.has('funding:fund-2')).toBe(false)
  again.rerender({identity:'id-two'});expect(again.result.current.unread.size).toBe(again.result.current.notices.length)
 })
 it('clears the visible unread state even if device storage rejects a write',async()=>{
  load.mockResolvedValue(noticeSnapshot())
  const hook=renderHook(()=>useHomeNotifications('id-one','owner',outbox,'same'));await waitFor(()=>expect(hook.result.current.status).toBe('ready'))
  const blocked=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked')})
  try{act(()=>hook.result.current.markViewed(hook.result.current.notices));expect(hook.result.current.unread.size).toBe(0);expect(hook.result.current.notices.filter(n=>n.tab==='tasks')).toHaveLength(2)}finally{blocked.mockRestore()}
 })
 it('keeps an unchanged authoritative snapshot stable without hiding real account changes',async()=>{
  let snapshot=noticeSnapshot();load.mockImplementation(async()=>structuredClone(snapshot))
  const hook=renderHook(()=>useHomeNotifications('identity','owner',outbox,'same'));await waitFor(()=>expect(hook.result.current.status).toBe('ready'))
  const initial=hook.result.current.contextRevision
  await act(async()=>{await hook.result.current.refresh()});expect(hook.result.current.contextRevision).toBe(initial)
  snapshot=structuredClone(snapshot);snapshot.accounts[0].archived=true
  await act(async()=>{await hook.result.current.refresh()});expect(hook.result.current.contextRevision).toBeGreaterThan(initial)
  expect(hook.result.current.notices.some(n=>n.ref.kind==='account'&&n.ref.id===snapshot.accounts[0].id)).toBe(false)
 })
 it('rejects a slow old identity response even after a new identity has loaded',async()=>{
  let finishOld!:(s:ReturnType<typeof noticeSnapshot>)=>void
  load.mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve}))
  const next={...noticeSnapshot(),owner:'other',funding:[],accounts:[],expenses:[]};load.mockResolvedValueOnce(next)
  const hook=renderHook(({owner,identity})=>useHomeNotifications(identity,owner,outbox,'same'),{initialProps:{owner:'owner',identity:'id-one'}})
  hook.rerender({owner:'other',identity:'id-two'});await waitFor(()=>expect(hook.result.current.status).toBe('ready'));await act(async()=>finishOld(noticeSnapshot()));expect(hook.result.current.notices).toEqual([])
 })
 it('keeps read state independent from completion and query failures, then adopts only fresh completed authority',async()=>{
  let snapshot=noticeSnapshot();load.mockImplementation(async()=>structuredClone(snapshot))
  const hook=renderHook(()=>useHomeNotifications('id-one','owner',outbox,'same'));await waitFor(()=>expect(hook.result.current.status).toBe('ready'))
  const task=hook.result.current.notices.find(n=>n.id==='funding:fund-1')!;act(()=>hook.result.current.markRead(task));expect(hook.result.current.unread.has(task.id)).toBe(false);expect(hook.result.current.notices.filter(n=>n.tab==='tasks')).toHaveLength(2)
  load.mockRejectedValueOnce(new Error('offline'));await act(async()=>{await hook.result.current.refresh()});expect(hook.result.current.status).toBe('error');expect(hook.result.current.notices.filter(n=>n.tab==='tasks')).toHaveLength(2)
  snapshot=noticeSnapshot();snapshot.funding[0]={...snapshot.funding[0],status:'posted',version:2};await act(async()=>{await hook.result.current.refresh()});expect(hook.result.current.status).toBe('ready');expect(hook.result.current.notices.filter(n=>n.tab==='tasks')).toHaveLength(1);expect(hook.result.current.notices.find(n=>n.id===task.id)).toMatchObject({state:'completed',version:'2'});expect(hook.result.current.unread.has(task.id)).toBe(true)
 })
})
