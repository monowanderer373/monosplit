/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { moneyOperation, acknowledgeMoneyOperation } from './moneyOperation'
const mock=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./notificationRepository',()=>({notificationRpc:mock.rpc}))
const guard=()=>{}
beforeEach(()=>{sessionStorage.clear();mock.rpc.mockReset()})
describe('persistent opaque money request recovery',()=>{
 it('retains opaque metadata even after a structured rejection, fencing before a corrected new request',async()=>{
  mock.rpc.mockRejectedValueOnce({code:'P0001'})
  await expect(moneyOperation('record',{version:1},'owner','movement',guard)).rejects.toEqual({code:'P0001'})
  expect(sessionStorage.getItem('tt-money-operation:owner:movement')).not.toBeNull()
  mock.rpc.mockResolvedValueOnce({state:'not_posted'}).mockResolvedValueOnce({movement_id:'corrected'})
  await moneyOperation('record',{version:2},'owner','movement',guard)
  expect(mock.rpc.mock.calls[1][0]).toBe('reconcile_personal_money_operation')
  expect(mock.rpc.mock.calls[2][1]).toMatchObject({version:2})
 })
 it('reconciles a lost response under the original request before accepting a changed draft',async()=>{
  mock.rpc.mockRejectedValueOnce(new TypeError('network'))
  await expect(moneyOperation('record',{amount:150},'owner','movement',guard)).rejects.toThrow('network')
  const first=mock.rpc.mock.calls[0][1].request_id
  const stored=sessionStorage.getItem('tt-money-operation:owner:movement')!
  // UUIDs and hashes may contain the digits 150; assert the exact opaque schema.
  expect(JSON.parse(stored)).toEqual({fingerprint:expect.stringMatching(/^[0-9a-f]{64}$/),requestId:first})
  expect(first).toMatch(/^[0-9a-f-]{36}$/i)
  mock.rpc.mockResolvedValueOnce({state:'committed',result:{movement_id:'original'}})
  expect(await moneyOperation('record',{amount:152},'owner','movement',guard)).toEqual({movement_id:'original'})
  expect(mock.rpc.mock.calls[1].slice(0,2)).toEqual(['reconcile_personal_money_operation',{request_id:first}])
  expect(mock.rpc).toHaveBeenCalledTimes(2)
 })
 it('fences an absent original request before issuing a new changed command',async()=>{
  mock.rpc.mockRejectedValueOnce(new TypeError('network'))
  await expect(moneyOperation('record',{amount:150},'owner','movement',guard)).rejects.toThrow()
  const first=mock.rpc.mock.calls[0][1].request_id
  mock.rpc.mockResolvedValueOnce({state:'not_posted'}).mockResolvedValueOnce({movement_id:'new'})
  await moneyOperation('record',{amount:152},'owner','movement',guard)
  expect(mock.rpc.mock.calls[1][0]).toBe('reconcile_personal_money_operation')
  expect(mock.rpc.mock.calls[2][0]).toBe('record')
  expect(mock.rpc.mock.calls[2][1]).toMatchObject({amount:152})
  expect(mock.rpc.mock.calls[2][1].request_id).not.toBe(first)
 })
 it('checks a same-payload receipt and reuses the exact original request when still absent',async()=>{
  mock.rpc.mockRejectedValueOnce(new TypeError('network'))
  await expect(moneyOperation('record',{amount:150},'owner','movement',guard)).rejects.toThrow()
  const first=mock.rpc.mock.calls[0][1].request_id
  mock.rpc.mockResolvedValueOnce(null).mockResolvedValueOnce({movement_id:'original'})
  await moneyOperation('record',{amount:150},'owner','movement',guard)
  expect(mock.rpc.mock.calls[1].slice(0,2)).toEqual(['get_personal_money_operation',{request_id:first}])
  expect(mock.rpc.mock.calls[2][1].request_id).toBe(first)
 })
 it('allows a deliberately repeated identical movement after the earlier success was acknowledged',async()=>{
  mock.rpc.mockResolvedValue({movement_id:'first'})
  await moneyOperation('record',{amount:150},'owner','movement',guard)
  const first=mock.rpc.mock.calls[0][1].request_id
  acknowledgeMoneyOperation('owner','movement')
  expect(sessionStorage.getItem('tt-money-operation:owner:movement')).toBeNull()
  await moneyOperation('record',{amount:150},'owner','movement',guard)
  expect(mock.rpc.mock.calls[1][1].request_id).not.toBe(first)
  expect(mock.rpc.mock.calls[1][0]).toBe('record')
 })
 it('does not inspect another identity receipt or override the generated id with caller arguments',async()=>{
  mock.rpc.mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce({})
  await expect(moneyOperation('record',{amount:150},'owner','movement',guard)).rejects.toThrow()
  await moneyOperation('record',{amount:152,request_id:'injected'},'other','movement',guard)
  expect(mock.rpc.mock.calls[1][0]).toBe('record');expect(mock.rpc.mock.calls[1][1].request_id).not.toBe('injected')
 })
})
