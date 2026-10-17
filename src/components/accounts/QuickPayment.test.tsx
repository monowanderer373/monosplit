// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import QuickPayment from './QuickPayment'
import { useStore } from '../../store/useStore'
import type { CurrencyAccount } from '../../lib/multicurrency'
vi.mock('../../lib/multicurrencyRepository',()=>({loadFundingMetadata:async()=>({anchors:[],bundles:[]})}))
const accounts:CurrencyAccount[]=[{id:'wise',parentAccountId:'wise',name:'Wise',currency:'MYR',accountType:'ewallet',accountClass:'asset',archived:false,openingStatus:'posted',entrySumMinor:10000,version:1,parentVersion:1,displayOrder:0,isDefault:true,openingBalanceAsOf:null}]
beforeEach(()=>useStore.setState({lang:'en',homeUi:{...useStore.getState().homeUi,balanceHidden:false}}))
afterEach(cleanup)
it('requires a new whole-payment confirmation after the accepted owner payment changes, retaining actual native input',async()=>{
 const onPlan=vi.fn(),props={accounts,parentId:'wise',currency:'VND',selfPaid:90000,identity:'owner',busy:false,onPlan}
 const {rerender}=render(<QuickPayment {...props}/> )
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'deferred'}),true))
 fireEvent.click(screen.getByRole('button',{name:'I know the deduction'}))
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'wise'}})
 const input=screen.getByRole('textbox') as HTMLInputElement
 fireEvent.change(input,{target:{value:'16.20'}})
 fireEvent.click(screen.getByRole('checkbox'))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({mode:'actual',covers_owner_payment:true,legs:[expect.objectContaining({amount_minor:1620})]}),true))
 rerender(<QuickPayment {...props} selfPaid={180000}/> )
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(undefined,false))
 expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
 expect(input.value).toBe('16.20')
 fireEvent.click(screen.getByRole('checkbox'))
 await waitFor(()=>expect(onPlan).toHaveBeenLastCalledWith(expect.objectContaining({covers_owner_payment:true}),true))
})
