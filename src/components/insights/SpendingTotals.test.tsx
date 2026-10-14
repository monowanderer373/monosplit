// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import SpendingTotals from './SpendingTotals'
import { spendingSnapshot } from '../../lib/spendingView'
import { derivePersonalLedgerRows } from '../../lib/ledgerSummary'
import { spendingExpense } from '../../test/spendingFixtures'
import { useStore } from '../../store/useStore'
import type { FxSnapshot } from '../../lib/fx'
const rates: FxSnapshot = { id:'20000000-0000-4000-8000-000000000014',status:'fresh',fetchedAt:'2026-10-14T09:00:00Z',rates:Object.fromEntries([['CNY','2'],['VND','6250']].map(([currency,denominator])=>[currency,{currency,numerator:'1',denominator,quote:'MYR',direction:'MYR-per-foreign',rateDate:'2026-10-13',fetchedAt:'2026-10-14T09:00:00Z',provider:'Frankfurter'}])) }
function snapshot(fx=rates, onlyMyr=false) {
  const expenses=[spendingExpense('myr',34600),...onlyMyr?[]:[spendingExpense('cny',1500,'personal',{currency:'CNY'}),spendingExpense('vnd',90000,'personal',{currency:'VND'})]]
  return spendingSnapshot(derivePersonalLedgerRows(expenses,'you'),'you',{month:'2026-10',scope:'all',currency:'',tab:'category'},'MYR',fx)
}
beforeEach(()=>{vi.setSystemTime(new Date('2026-10-14T10:00:00Z'));useStore.setState({lang:'en',homeUi:{...useStore.getState().homeUi,balanceHidden:false}})})
afterEach(()=>{cleanup();vi.useRealTimers()})
it('shows one healthy source paragraph with accessible basis, all currencies, and a reserved MYR equivalent slot',()=>{
 const {container}=render(<SpendingTotals snapshot={snapshot()} updating={false} retry={()=>{}} />)
 expect(container.querySelectorAll('.i-fx-source')).toHaveLength(1)
 expect(container.querySelectorAll('.i-fx-source p')).toHaveLength(0)
 expect(container.querySelector('.i-fx-source')?.textContent).toMatch(/^Rates: Frankfurter · 13 Oct 2026/)
 expect(screen.getByRole('link',{name:'Frankfurter'}).getAttribute('href')).toBe('https://frankfurter.dev/')
 expect(container.querySelector('.i-fx-source')?.getAttribute('title')).toBe('Latest reference rates · Estimated')
 expect(container.querySelector('.i-sr-only')?.textContent).toContain('Latest reference rates · Estimated')
 expect(container.querySelectorAll('.i-currency-row')).toHaveLength(3)
 expect(container.querySelectorAll('.i-equivalent')).toHaveLength(3)
 expect(container.querySelector('.i-equivalent[aria-hidden="true"]')?.textContent).toBe('')
 expect(screen.getByText('90,000')).toBeTruthy()
})
it('keeps cached/unavailable states and Retry inline without dropping original facts or showing RM zero',()=>{
 const retry=vi.fn(),fx={...rates,status:'cached' as const,rates:{CNY:rates.rates.CNY}}
 const {container}=render(<SpendingTotals snapshot={snapshot(fx)} updating={false} retry={retry} />)
 expect(container.querySelector('.i-fx-source [role="status"]')?.textContent).toBe('Cached rates')
 expect(screen.getByLabelText('Estimate unavailable').textContent).toBe('Unavailable')
 expect(screen.getByText('90,000')).toBeTruthy()
 expect(screen.getByText('≈ RM 7.50')).toBeTruthy()
 expect(container.textContent).not.toContain('≈ RM 0')
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));expect(retry).toHaveBeenCalledOnce()
})
it('uses a real rate-date range and suppresses the entire FX source for MYR only',()=>{
 const fx={...rates,rates:{...rates.rates,VND:{...rates.rates.VND,rateDate:'2026-10-12'}}}
 const view=render(<SpendingTotals snapshot={snapshot(fx)} updating={false} retry={()=>{}} />)
 expect(view.container.querySelector('.i-fx-source')?.textContent).toContain('12 Oct 2026 – 13 Oct 2026')
 view.rerender(<SpendingTotals snapshot={snapshot(rates,true)} updating={false} retry={()=>{}} />)
 expect(view.container.querySelector('.i-fx-source')).toBeNull()
 expect(view.container.querySelector('.i-equivalent')?.textContent).toBe('')
})
it('masks original and estimated amounts including accessible labels and titles',()=>{
 useStore.setState({homeUi:{...useStore.getState().homeUi,balanceHidden:true}})
 const {container}=render(<SpendingTotals snapshot={snapshot()} updating={false} retry={()=>{}} />)
 expect(container.textContent).not.toMatch(/346\.00|15\.00|90,000|7\.50|14\.40/)
 expect([...container.querySelectorAll('[aria-label],[title]')].map(e=>e.getAttribute('aria-label')+' '+e.getAttribute('title')).join(' ')).not.toMatch(/346\.00|15\.00|90,000|7\.50|14\.40/)
 expect(container.querySelectorAll('[aria-label="Amounts hidden"]')).toHaveLength(5)
})
