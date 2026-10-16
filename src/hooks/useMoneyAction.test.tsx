/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMoneyAction } from './useMoneyAction'
const mock=vi.hoisted(()=>({operation:vi.fn()}))
vi.mock('../lib/moneyOperation',()=>({moneyOperation:mock.operation,acknowledgeMoneyOperation:vi.fn()}))
afterEach(cleanup)
beforeEach(()=>{mock.operation.mockReset()})
describe('money command recovery and identity leases',()=>{
 it('treats a structured connection loss as uncertain rather than a rejected transaction',async()=>{
  const {result}=renderHook(()=>useMoneyAction('owner','movement'))
  mock.operation.mockRejectedValueOnce({code:'08006',message:'connection failure'})
  await act(async()=>{await result.current.run('record',{amount:150},()=>{})})
  expect(result.current.uncertain).toBe(true);expect(result.current.busy).toBe(true)
 })
 it('freezes a lost-response command and checks the original attempt even if a caller supplies an edited payload',async()=>{
  const first=vi.fn(),edited=vi.fn(),{result}=renderHook(()=>useMoneyAction('owner','movement'))
  mock.operation.mockRejectedValueOnce({code:'',message:'network unavailable'}).mockResolvedValueOnce({movement_id:'committed'})
  await act(async()=>{await result.current.run('record',{amount:150},first)})
  expect(result.current.uncertain).toBe(true);expect(result.current.busy).toBe(true)
  await act(async()=>{await result.current.run('record',{amount:152},edited)})
  expect(mock.operation.mock.calls[1][1]).toEqual({amount:150});expect(first).toHaveBeenCalledOnce();expect(edited).not.toHaveBeenCalled();expect(result.current.uncertain).toBe(false)
 })
 it('retains the original confirmed receipt when the required refresh fails with a structured server error',async()=>{
  const {result}=renderHook(()=>useMoneyAction('owner','movement')),after=vi.fn().mockRejectedValueOnce({code:'PGRST301'}).mockResolvedValueOnce(undefined)
  mock.operation.mockResolvedValue({movement_id:'committed'})
  await act(async()=>{await result.current.run('record',{amount:150},after)});expect(result.current.uncertain).toBe(true)
  await act(async()=>{await result.current.run('record',{amount:152},()=>{})});expect(mock.operation.mock.calls[1][1]).toEqual({amount:150});expect(result.current.error).toBe(false)
 })
 it('allows an explicitly rejected transaction to be corrected without treating it as an unknown commit',async()=>{
  const {result}=renderHook(()=>useMoneyAction('owner','balance'))
  mock.operation.mockRejectedValueOnce({code:'P0001',message:'version_conflict'}).mockResolvedValueOnce({anchor_id:'new'})
  await act(async()=>{await result.current.run('set',{version:1},()=>{})});expect(result.current.uncertain).toBe(false);expect(result.current.busy).toBe(false)
  await act(async()=>{await result.current.run('set',{version:2},()=>{})});expect(mock.operation.mock.calls[1][1]).toEqual({version:2})
 })
 it('suppresses a late completion callback after identity or target changes and exposes no stale busy state',async()=>{
  let resolve!:(value:unknown)=>void;mock.operation.mockImplementation(()=>new Promise(r=>{resolve=r}))
  const after=vi.fn(),{result,rerender}=renderHook(({identity,target})=>useMoneyAction(identity,target),{initialProps:{identity:'owner',target:'first'}})
  let pending!:Promise<void>;act(()=>{pending=result.current.run('record',{amount:150},after)})
  rerender({identity:'other',target:'second'});expect(result.current.busy).toBe(false)
  await act(async()=>{resolve({movement_id:'original'});await pending});expect(after).not.toHaveBeenCalled();expect(result.current.error).toBe(false)
 })
})
