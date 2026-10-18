// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import QuickPayment from './QuickPayment'
import { useQuickPayment } from '../../hooks/useQuickPayment'
import { useStore } from '../../store/useStore'
import type { FundingPlan, CurrencyAccount } from '../../lib/multicurrency'
const mocks=vi.hoisted(()=>({metadata:vi.fn()}))
vi.mock('../../lib/multicurrencyRepository',()=>({loadFundingMetadata:mocks.metadata}))
const accounts:CurrencyAccount[]=[{id:'wise',parentAccountId:'wise',name:'Wise',currency:'MYR',accountType:'ewallet',accountClass:'asset',archived:false,openingStatus:'posted',entrySumMinor:10000,version:1,parentVersion:1,displayOrder:0,isDefault:true,openingBalanceAsOf:null}]
beforeEach(()=>{mocks.metadata.mockReset();mocks.metadata.mockResolvedValue({anchors:[],bundles:[]});useStore.setState({lang:'en',homeUi:{...useStore.getState().homeUi,balanceHidden:false}})})
afterEach(cleanup)
function Harness(props:{draftKey?:string;accounts:CurrencyAccount[];parentId:string|null;currency:string;selfPaid:number;identity:string;busy:boolean;onPlan:(plan:FundingPlan|undefined,valid:boolean)=>void}){const payment=useQuickPayment(props);return <QuickPayment payment={payment} accounts={props.accounts} busy={props.busy}/>}
it('requires a new whole-payment confirmation after the accepted owner payment changes, retaining actual native input',async()=>{
 const onPlan=vi.fn(),props={accounts,parentId:'wise',currency:'VND',selfPaid:90000,identity:'owner',busy:false,onPlan}
 const {rerender}=render(<Harness {...props}/> )
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'deferred'}),true))
 fireEvent.click(screen.getByRole('button',{name:'Actual charge (optional)'}))
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'wise'}})
 const input=screen.getByRole('textbox') as HTMLInputElement
 fireEvent.change(input,{target:{value:'16.20'}})
 fireEvent.click(screen.getByRole('checkbox'))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'actual',covers_owner_payment:true,legs:[expect.objectContaining({amount_minor:1620})]}),true))
 rerender(<Harness {...props} selfPaid={180000}/> )
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(undefined,false))
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
 expect(input.value).toBe('16.20')
 fireEvent.click(screen.getByRole('checkbox'))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({covers_owner_payment:true}),true))
})

it('a new Save and next session never reuses a previous actual payment confirmation',async()=>{
 const onPlan=vi.fn(),props={accounts,parentId:'wise',currency:'MYR',selfPaid:900,identity:'owner',busy:false,onPlan,draftKey:'first'}
 const {rerender}=render(<Harness {...props}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Actual charge (optional)'}))
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'wise'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'9'}});fireEvent.click(screen.getByRole('checkbox'))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'actual',covers_owner_payment:true}),true))
 rerender(<Harness {...props} draftKey="second"/>)
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'deferred',legs:[],covers_owner_payment:false}),true))
 expect(screen.queryByRole('textbox')).toBeNull()
})

it('preserves native cash suggestion and uses only its real currency amount',async()=>{
 const onPlan=vi.fn()
 render(<Harness accounts={[{...accounts[0],accountType:'cash'}]} parentId="wise" currency="MYR" selfPaid={123456} identity="owner" busy={false} onPlan={onPlan}/>)
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'actual',covers_owner_payment:true,legs:[expect.objectContaining({account_id:'wise',amount_minor:123456})]}),true))
 expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('1,234.56')
})

it('blocks an unavailable funding capability instead of publishing a legacy debit or guessed plan',async()=>{
 mocks.metadata.mockRejectedValue(new Error('capability unavailable'));const onPlan=vi.fn()
 render(<Harness accounts={accounts} parentId="wise" currency="VND" selfPaid={90000} identity="owner" busy={false} onPlan={onPlan}/>)
 await screen.findByRole('alert');expect(onPlan).toHaveBeenLastCalledWith(undefined,false)
 expect(screen.queryByRole('textbox')).toBeNull()
})

it('privacy conceals the actual editor and blocks its plan without discarding the draft',async()=>{
 const onPlan=vi.fn(),props={accounts,parentId:'wise',currency:'VND',selfPaid:90000,identity:'owner',busy:false,onPlan}
 render(<Harness {...props}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Actual charge (optional)'}));fireEvent.change(screen.getByRole('combobox'),{target:{value:'wise'}});fireEvent.change(screen.getByRole('textbox'),{target:{value:'16.20'}});fireEvent.click(screen.getByRole('checkbox'))
 useStore.getState().setHomeUi({balanceHidden:true})
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(undefined,false));expect(screen.queryByRole('textbox')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Show amount to continue'}))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'actual',covers_owner_payment:true}),true));expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('16.20')
})
