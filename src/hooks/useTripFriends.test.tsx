// @vitest-environment jsdom
import {act,renderHook,cleanup}from'@testing-library/react'
import{afterEach,beforeEach,expect,it,vi}from'vitest'
import{useTripFriends}from'./useTripFriends'
const mocks=vi.hoisted(()=>({states:vi.fn(),list:vi.fn(),send:vi.fn(),respond:vi.fn(),clearCommand:vi.fn(),user:'a'}))
vi.mock('../lib/supabase',()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:mocks.user}}})},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel:vi.fn()}}))
vi.mock('../lib/tripFriendRequests',()=>({tripFriendRequests:mocks,friendRequestsChanged:()=>{}}))
beforeEach(()=>{vi.clearAllMocks();mocks.user='a';mocks.list.mockResolvedValue([]);mocks.states.mockResolvedValue([])})
afterEach(cleanup)
it('never paints a late previous-identity friendship snapshot',async()=>{
 let previous!:(value:unknown)=>void;mocks.states.mockImplementationOnce(()=>new Promise(resolve=>{previous=resolve})).mockResolvedValue([{participantId:'b-member',state:'available',requestId:null,version:null}]);const view=renderHook(({identity})=>useTripFriends(identity,'trip'),{initialProps:{identity:'a'}});await act(async()=>{});view.rerender({identity:'b'});await act(async()=>{});expect(view.result.current.states[0].participantId).toBe('b-member');await act(async()=>previous([{participantId:'private-old-member',state:'friend'}]));expect(view.result.current.states[0].participantId).toBe('b-member')
})
it('does not dispatch an old send after the identity changes during its authority read',async()=>{
 const state={participantId:'target',state:'available',requestId:null,version:null};mocks.states.mockResolvedValue([state]);const view=renderHook(({identity})=>useTripFriends(identity,'trip'),{initialProps:{identity:'a'}});await act(async()=>{});let release!:(value:unknown)=>void;mocks.states.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve}));let pending:Promise<unknown>;await act(async()=>{pending=view.result.current.send('target')});mocks.user='b';view.rerender({identity:'b'});await act(async()=>{});await act(async()=>{release([state]);await pending!});expect(mocks.send).not.toHaveBeenCalled()
})
