import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { setup, apiExpense, capture } from './fixtures/insightsUi'
import { receiptRecords, receiptFx } from './fixtures/paperReceipt'
import { autoFxRecords, autoFxSnapshot } from './fixtures/autoFx'
import { spendingExpense } from '../src/test/spendingFixtures'
import type { FxSnapshot } from '../src/lib/fx'

const path='test-results/insights-ui'
async function part(id:string,locator:Locator){await mkdir(path,{recursive:true});await expect(locator).toBeVisible();await locator.screenshot({path:`${path}/part-${id}.png`,animations:'disabled'})}
async function open(page:Page,hidden=false){await setup(page,receiptRecords,200,hidden);await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));await page.route('**/rpc/insights_fx_snapshot',route=>route.fulfill({json:receiptFx}));await page.goto('/insights?month=2026-10');await expect(page.getByTestId('spending-total')).toContainText(hidden?'••••':'≈ RM 9.16',{timeout:15_000})}

test('B real component evidence: filters, month/year drafts, scope, chart and Records (intercepted UI)',async({page})=>{
 test.setTimeout(90_000)
 await page.setViewportSize({width:390,height:844});await open(page)
 await part('F01',page.locator('.i-filter-row'));await part('F02',page.getByRole('button',{name:'Month: Oct 2026'}));await part('F03',page.getByRole('button',{name:'Scope: All spending'}))
 await part('S16',page.locator('.i-summary-ticket'));await part('S03',page.locator('.i-summary-ticket .i-currency-row').last());await part('S04',page.locator('.i-fx-source'));await part('S06',page.locator('.i-ticket-footer'));await part('S07',page.locator('.i-ticket-title .i-icon'));await part('S08',page.locator('.i-quiet-month'));await part('S09',page.locator('.i-ticket-top'));await part('S10',page.locator('.i-summary-ticket .i-currency-row').nth(1));await part('S11',page.getByRole('link',{name:'View records'}));await part('S17',page.locator('.i-receipt-perforation'));await part('S19',page.locator('.i-ticket-top'))
 await page.getByRole('button',{name:'Month: Oct 2026'}).click();await expect(page.getByRole('button',{name:'October 2026',exact:true})).toBeFocused()
 await part('F04',page.getByRole('button',{name:'Month: Oct 2026'}));await part('F06',page.getByRole('dialog',{name:'Month',exact:true}));await part('F09',page.locator('.i-year-row'));await part('F10',page.getByRole('button',{name:'September 2026',exact:true}));await part('F11',page.getByRole('button',{name:'October 2026',exact:true}));await part('F14',page.getByRole('button',{name:'This month',exact:true}))
 await page.getByRole('button',{name:'Choose year: 2026'}).click();await part('F07',page.getByRole('dialog',{name:'Month',exact:true}));await part('F12',page.getByRole('button',{name:'2025',exact:true}));await part('F13',page.getByRole('button',{name:'2026',exact:true}))
 await page.getByRole('button',{name:'2025',exact:true}).click();await expect(page.getByRole('button',{name:'Month: Oct 2026'})).toBeVisible();expect(new URL(page.url()).searchParams.get('month')).toBe('2026-10');await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Month: Oct 2026'})).toBeFocused()
 await page.getByRole('button',{name:'Scope: All spending'}).click();await part('F05',page.getByRole('button',{name:'Scope: All spending'}));await part('F08',page.getByRole('dialog',{name:'Scope',exact:true}));for(const [id,name] of [['F15','All spending'],['F16','Personal'],['F17','Shared']])await part(id,page.getByRole('dialog',{name:'Scope',exact:true}).getByRole('button',{name,exact:true}));await page.keyboard.press('Escape')
 await part('T01',page.locator('.i-analysis-tabs'));await part('T02',page.locator('.i-chart-card'));await part('T03',page.locator('.i-legend-name').first());await part('T04',page.locator('.i-legend-row').first());await page.getByRole('tab',{name:'Ranking',exact:true}).click();await part('T05',page.locator('.i-ranking-row').first());await expect(page.locator('.i-ranking-row').first()).toContainText('149.38')
 await page.getByRole('link',{name:'View records',exact:true}).click();await expect(page.getByRole('heading',{name:'Spending records',exact:true})).toBeVisible();await part('R01',page.locator('.i-records-heading'));await part('R02',page.locator('.i-records-summary'));await part('R03',page.locator('.i-date-heading').first());await part('R04',page.getByRole('button',{name:'Edit Morning coffee',exact:true}));await part('R05',page.getByRole('button',{name:'Edit Lunch with friends',exact:true}));await part('R06',page.locator('.i-date-group').first());await part('R07',page.locator('.i-record-row').nth(1));await part('R08',page.getByRole('button',{name:'Edit Vietnam lunch',exact:true}).first())
 await page.getByRole('button',{name:'Insights',exact:true}).click();await expect(page.getByRole('tab',{name:'Ranking',exact:true})).toHaveAttribute('aria-selected','true')
 await page.setViewportSize({width:320,height:844});await page.addStyleTag({content:'html{font-size:200% !important}'});await expect(page.locator('.i-filter-row')).toHaveAttribute('data-layout','single');await part('F18',page.locator('.i-filter-row'))
})

test('B component evidence: single/two/foreign, updating/cached/unavailable, privacy and data states',async({page,context})=>{
 test.setTimeout(90_000)
 await page.setViewportSize({width:390,height:844});await setup(page,receiptRecords);await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'))
 let records=autoFxRecords.filter(r=>r.currency==='MYR'),fx:FxSnapshot=receiptFx,blocked=false,release:()=>void=()=>{}
 let gate=Promise.resolve()
 await page.route('**/rest/v1/expenses*',route=>route.fulfill({json:records.map(apiExpense)}))
 await page.route('**/rpc/insights_fx_snapshot',async route=>{if(blocked)await gate;return route.fulfill({json:fx})})
 await page.goto('/insights?month=2026-10');await expect(page.getByTestId('spending-total')).toContainText('346.00',{timeout:15_000});await part('S01',page.locator('.i-summary-ticket'));await expect(page.locator('.i-summary-ticket')).toHaveJSProperty('clientHeight',192)
 records=autoFxRecords.filter(r=>r.currency!=='USD');fx={...autoFxSnapshot,fetchedAt:receiptFx.fetchedAt,rates:{VND:{...autoFxSnapshot.rates.VND,fetchedAt:receiptFx.fetchedAt!}}};await page.reload();await expect(page.getByTestId('spending-total')).toContainText('≈ RM 200.00');await part('S02',page.locator('.i-summary-ticket'))
 records=receiptRecords.filter(r=>r.currency==='CNY');fx=receiptFx;await page.reload();await expect(page.getByTestId('spending-total')).toContainText('≈ RM 9.16');await part('S18',page.locator('.i-summary-ticket'))
 records=receiptRecords;fx={...receiptFx,status:'cached',rates:Object.fromEntries(Object.entries(receiptFx.rates).map(([code,r])=>[code,{...r,rateDate:'2026-10-10'}]))};await page.reload();await expect(page.locator('.i-fx-source [role=status]')).toHaveText('Cached rates');await part('S05',page.locator('.i-fx-source'));await part('S13',page.locator('.i-summary-ticket'))
 fx={...receiptFx,id:null,rates:{},status:'unavailable'};await page.reload();await expect(page.locator('.i-fx-source [role=status]')).toHaveText('Estimate unavailable');await expect(page.getByTestId('spending-total')).not.toContainText('≈ RM 0');await part('S14',page.locator('.i-summary-ticket'))
 blocked=true;gate=new Promise(resolve=>{release=resolve});fx=receiptFx;await page.reload();await expect(page.locator('.i-fx-source [role=status]')).toHaveText('Updating estimate…');try{await part('S12',page.locator('.i-summary-ticket'))}finally{blocked=false;release()};await expect(page.getByTestId('spending-total')).toContainText('≈ RM 9.16')
 const hidden=await context.newPage();await open(hidden,true);await part('S15',hidden.locator('.i-summary-ticket'));await hidden.close()
 const empty=await context.newPage();await setup(empty,[]);await empty.goto('/insights/records?month=2026-10');await expect(empty.getByText('No records for this month',{exact:true})).toBeVisible();await part('E01',empty.locator('.i-state-card'));await empty.getByRole('button',{name:'Change month'}).click();await expect(empty.getByRole('dialog',{name:'Month',exact:true})).toBeVisible();await empty.close()
 const loading=await context.newPage();await setup(loading,receiptRecords);let releaseRecords:()=>void=()=>{};const recordsGate=new Promise<void>(resolve=>{releaseRecords=resolve});await loading.route('**/rest/v1/expenses*',async route=>{await recordsGate;return route.fulfill({json:receiptRecords.map(apiExpense)})});await loading.goto('/insights/records?month=2026-10');await expect(loading.getByRole('status',{name:'Loading your spending…'})).toBeVisible();try{await part('E02',loading.locator('.i-state-card'));await expect(loading.getByTestId('spending-total')).toHaveCount(0)}finally{releaseRecords()};await expect(loading.getByTestId('spending-total')).toContainText('90,000');await loading.close()
 const error=await context.newPage();await setup(error,receiptRecords);let failed=true;await error.route('**/rest/v1/expenses*',route=>route.fulfill(failed?{status:500,json:{code:'test_error',message:'Synthetic failure'}}:{json:receiptRecords.map(apiExpense)}));await error.goto('/insights/records?month=2026-10');await expect(error.getByRole('alert')).toContainText('Couldn’t load records');await part('E03',error.getByRole('alert'));await expect(error.getByTestId('spending-total')).toHaveCount(0);failed=false;await error.getByRole('button',{name:'Retry'}).click();await expect(error.getByTestId('spending-total')).toContainText('90,000');await error.close()
})

test('B more currencies and long labels keep shared fallback, complete numbers and keyboard scrolling',async({page})=>{
 await setup(page,[...receiptRecords,spendingExpense('very-long-jpy',9007199254740000,'personal',{currency:'JPY',description:'A deliberately long international record title with full original amount'}),spendingExpense('extra-usd',123456,'personal',{currency:'USD'})],200,false,'zh')
 await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'));await page.route('**/rpc/insights_fx_snapshot',route=>route.fulfill({json:{...receiptFx,rates:{...receiptFx.rates,JPY:{...receiptFx.rates.VND,currency:'JPY',numerator:'1',denominator:'33'},USD:{...receiptFx.rates.CNY,currency:'USD',numerator:'4',denominator:'1'}}}}))
 await page.setViewportSize({width:320,height:844});await page.goto('/insights?month=2026-10');await expect(page.getByTestId('spending-total')).toContainText('9,007,199,254,740,000',{timeout:15_000});await page.addStyleTag({content:'html{font-size:200% !important}'})
 await expect(page.locator('.i-currency-row')).toHaveCount(5);await expect(page.locator('.i-currency-list')).toHaveAttribute('data-layout','stacked')
 await expect.poll(()=>page.locator('.i-currency-row').evaluateAll(rows=>Math.max(...rows.map(r=>r.getBoundingClientRect().height))-Math.min(...rows.map(r=>r.getBoundingClientRect().height)))).toBeLessThanOrEqual(1)
 const big=page.locator('.i-original-number').filter({hasText:'9,007,199,254,740,000'});await expect(big).toHaveAttribute('tabindex','0');await big.focus();await big.press('ArrowRight');await expect.poll(()=>big.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0)
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await capture(page,'receipt-five-currencies-big-zh-200')
 await page.getByRole('link',{name:'查看记录',exact:true}).click();await expect(page.getByRole('heading',{name:'支出记录',exact:true})).toBeVisible();await expect(page.locator('.i-record-row')).toHaveCount(17);await capture(page,'receipt-five-currencies-records-zh-200')
})

test('B desktop and long localized labels wrap without shrinking or page overflow',async({page})=>{
 await page.setViewportSize({width:1024,height:900});await open(page);await expect(page.locator('.i-currency-list')).toHaveAttribute('data-layout','inline');await capture(page,'receipt-desktop-1024')
 await page.locator('.i-filter-button--scope .i-filter-value').evaluate(e=>{e.textContent='All spending · personal and shared expenses across every account'})
 await page.locator('.i-ticket-title>span').evaluate(e=>{e.textContent='Total spending with a deliberately longer translated title'})
 await page.locator('.i-ticket-footer .i-link>span').evaluate(e=>{e.textContent='View every spending record for the selected month'})
 await page.addStyleTag({content:'html{font-size:200% !important}'});await page.setViewportSize({width:320,height:700})
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await expect(page.locator('.i-ticket-footer')).toHaveAttribute('data-layout','stacked')
 await expect(page.locator('.i-filter-row')).toHaveAttribute('data-layout','single')
 await expect.poll(()=>page.locator('.i-filter-value').evaluateAll(values=>values.every(v=>v.scrollWidth<=v.clientWidth+1))).toBe(true)
 await capture(page,'receipt-long-labels-200');expect(await page.evaluate(()=>CSS.supports('padding-bottom','env(safe-area-inset-bottom)'))).toBe(true)
})
