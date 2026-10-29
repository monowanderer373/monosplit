// @vitest-environment jsdom
import{cleanup,render,screen,waitFor}from'@testing-library/react'
import{afterEach,beforeEach,expect,it,vi}from'vitest'
import{useSettlements}from'./useSettlements'
import{tripLedgerPayment}from'../test/tripLedgerFixtures'
const mocks=vi.hoisted(()=>({list:vi.fn()}));vi.mock('../lib/settlementRepository',()=>({settlementRepository:{listSettlements:mocks.list}}));vi.mock('../lib/supabase',()=>({supabase:null}))
function Harness({identity}:{identity:string}){const state=useSettlements(true,identity);return <div>{state.loading?'Loading':state.error?'Failed':state.settlements.map(p=>p.id).join(',')}</div>}
beforeEach(()=>{vi.clearAllMocks()});afterEach(cleanup)
it('rejects late reads from another identity and hides old facts while the new identity loads',async()=>{let old!:(data:ReturnType<typeof tripLedgerPayment>[])=>void;mocks.list.mockImplementationOnce(()=>new Promise(resolve=>{old=resolve})).mockResolvedValueOnce([]);const view=render(<Harness identity="A"/>);await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(1));view.rerender(<Harness identity="B"/>);await waitFor(()=>expect(screen.queryByText('Loading')).toBeNull());old([tripLedgerPayment()]);await waitFor(()=>expect(view.container.textContent).toBe(''))})
it('exposes a failed initial read rather than presenting a confirmed empty list',async()=>{mocks.list.mockRejectedValueOnce(new Error('network'));render(<Harness identity="A"/>);await screen.findByText('Failed');expect(screen.queryByText('Loading')).toBeNull()})
