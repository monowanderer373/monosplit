import {beforeEach,describe,it,expect,vi} from 'vitest'
const mock=vi.hoisted(()=>({session:vi.fn(),rpc:vi.fn(),header:vi.fn()}))
vi.mock('./supabase',()=>({supabase:{auth:{getSession:mock.session},rpc:mock.rpc}}))
import {notificationRpc} from './notificationRepository'
beforeEach(()=>{vi.resetAllMocks();mock.rpc.mockReturnValue({setHeader:mock.header});mock.header.mockResolvedValue({data:{state:'posted'},error:null})})
describe('normal authenticated notification command boundary',()=>{
 it('rejects a changed identity before dispatch and does not use a newer actor for an old task',async()=>{
  mock.session.mockResolvedValue({data:{session:{user:{id:'other'},access_token:'test-normal-other-token'}},error:null})
  await expect(notificationRpc('complete_pending_funding',{},'original',()=>{})).rejects.toThrow('notification_context_changed');expect(mock.rpc).not.toHaveBeenCalled()
 })
 it('checks the target lease after session lookup and freezes the intended normal identity for dispatch',async()=>{
  mock.session.mockResolvedValue({data:{session:{user:{id:'original'},access_token:'test-normal-original-token'}},error:null})
  const guard=vi.fn();await notificationRpc('complete_pending_funding',{target_funding_intent_id:'owned'},'original',guard);expect(guard).toHaveBeenCalledTimes(1);expect(mock.header).toHaveBeenCalledWith('Authorization','Bearer test-normal-original-token')
  mock.rpc.mockClear();await expect(notificationRpc('complete_pending_funding',{},'original',()=>{throw new Error('stale')})).rejects.toThrow('stale');expect(mock.rpc).not.toHaveBeenCalled()
 })
})
