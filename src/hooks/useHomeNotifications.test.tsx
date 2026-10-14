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
