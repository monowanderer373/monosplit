import { expect, test, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { setup, capture } from './fixtures/insightsUi'
import { receiptRecords, receiptFx } from './fixtures/paperReceipt'

async function start(page: Page, hidden=false, lang='en', records=receiptRecords) {
  await setup(page,records,200,hidden,lang)
  await page.clock.setFixedTime(new Date('2026-10-14T10:00:00Z'))
  await page.route('**/rpc/insights_fx_snapshot',route=>route.fulfill({json:receiptFx}))
}
async function geometry(page: Page) {
  return page.locator('.i-summary-ticket').evaluate(root=>{
    const list=root.querySelector<HTMLElement>('.i-currency-list')!
    const textWidth=(el:HTMLElement)=>{const r=document.createRange();r.selectNodeContents(el);return r.getBoundingClientRect().width}
    const baseline=(el:HTMLElement)=>{const marker=document.createElement('span');marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';el.append(marker);const y=marker.getBoundingClientRect().top;marker.remove();return y}
    return {cardHeight:root.getBoundingClientRect().height,width:innerWidth,visualViewport:visualViewport?.width,dpr:devicePixelRatio,rootFont:getComputedStyle(document.documentElement).fontSize,scrollWidth:document.documentElement.scrollWidth,layout:list.dataset.layout,available:list.clientWidth,
      rows:[...list.querySelectorAll<HTMLElement>('.i-currency-row')].map(row=>{
        const unit=row.querySelector<HTMLElement>('.i-currency-unit')!,amount=row.querySelector<HTMLElement>('.i-original-number')!,equiv=row.querySelector<HTMLElement>('.i-equivalent')!,value=row.querySelector<HTMLElement>('.i-equivalent-value')!
        return {height:row.getBoundingClientRect().height,stacked:row.dataset.stacked,unitX:unit.getBoundingClientRect().x,amountX:amount.getBoundingClientRect().x,equivRight:equiv.getBoundingClientRect().right,amountFont:getComputedStyle(amount).fontSize,amountWidth:textWidth(amount),unitWidth:textWidth(unit),equivWidth:textWidth(value),amountFits:amount.scrollWidth<=amount.clientWidth+1,keyboardScroll:amount.tabIndex===0,baselineDelta:value.textContent?Math.abs(baseline(amount)-baseline(value)):0}
      }),headerRule:getComputedStyle(root.querySelector('.i-ticket-top')!).borderBottomWidth,band:getComputedStyle(root.querySelector('.i-ticket-top')!).backgroundColor,footerBand:getComputedStyle(root.querySelector('.i-ticket-footer')!).backgroundColor,outerBorder:getComputedStyle(root).borderTopWidth,after:getComputedStyle(root,'::after').content,perforation:root.querySelectorAll('.i-receipt-perforation[aria-hidden="true"]').length,sourceParagraphs:root.querySelectorAll('p.i-fx-source').length}
  })
}
for(const width of [320,360,390,430])for(const scale of [100,125,150,200])test(`B receipt ${width}px ${scale}% root font: common rows and right estimates (intercepted UI)`,async({page})=>{
  test.setTimeout(60_000)
  await start(page);await page.setViewportSize({width,height:844});await page.goto('/insights?month=2026-10')
  await expect(page.getByTestId('spending-total')).toContainText('≈ RM 9.16',{timeout:15_000})
  await page.addStyleTag({content:`html{font-size:${scale}% !important}`})
  await expect(page.locator('.i-summary-ticket .i-record-count')).toHaveText('15 records')
  await expect(page.locator('.i-donut')).toContainText('369.38')
  await expect(page.locator('.i-corner,.i-fold,.i-leather,.i-filter-label,.i-popover-corner')).toHaveCount(0)
  await expect.poll(async()=>{const g=await geometry(page);return g.rows.every(r=>r.stacked===String(g.layout==='stacked') && (r.amountFits||r.keyboardScroll))}).toBe(true)
  const g=await geometry(page)
  expect(g.scrollWidth).toBeLessThanOrEqual(width+1)
  expect(Math.max(...g.rows.map(r=>r.height))-Math.min(...g.rows.map(r=>r.height))).toBeLessThanOrEqual(1)
  expect(new Set(g.rows.map(r=>Math.round(r.amountX)))).toHaveProperty('size',1)
  expect(new Set(g.rows.map(r=>Math.round(r.equivRight)))).toHaveProperty('size',1)
  expect(g.rows.every(r=>Math.abs(parseFloat(r.amountFont)-28*scale/100)<.1)).toBe(true)
  if(scale===100){expect(g.layout).toBe('inline');expect(g.rows.every(r=>Math.abs(r.height-60)<1)).toBe(true);expect(g.cardHeight).toBe(348)}
  if(g.layout==='inline')expect(g.rows.every(r=>r.baselineDelta<1.5)).toBe(true)
  expect(g.headerRule).toBe('0px');expect(g.outerBorder).toBe('1px');expect(g.after).toBe('none');expect(g.band).toBe('rgb(232, 240, 243)');expect(g.footerBand).toBe(g.band);expect(g.perforation).toBe(1);expect(g.sourceParagraphs).toBe(1)
  await mkdir('test-results/insights-ui',{recursive:true});await writeFile(`test-results/insights-ui/receipt-geometry-${width}-${scale}.json`,JSON.stringify(g,null,2))
  await capture(page,`receipt-${width}-${scale}`)
  await page.locator('.i-summary-ticket').screenshot({path:`test-results/insights-ui/receipt-card-${width}-${scale}.png`})
  const original=await page.getByTestId('spending-total').textContent()
  await page.getByRole('link',{name:'View records',exact:true}).click()
  await expect(page).toHaveURL(/fx=20000000-0000-4000-8000-000000000014/)
  await expect(page.getByTestId('spending-total')).toHaveText(original!)
  await expect(page.locator('.i-record-row')).toHaveCount(15)
  await expect(page.getByRole('button',{name:'Edit Vietnam lunch'}).first()).toContainText('30,000')
  await expect(page.getByRole('button',{name:'Edit Vietnam lunch'}).first()).toContainText('Bill VND 90,000')
  await capture(page,`receipt-records-${width}-${scale}`,scale===100||width===320&&scale===200)
  await page.getByRole('button',{name:'Insights',exact:true}).click()
  await expect(page.getByTestId('spending-total')).toHaveText(original!)
})

test('B states keep one source, actual mixed dates, last-good, privacy and original record count (mock API)',async({page,context})=>{
  await start(page)
  await page.route('**/rpc/insights_fx_snapshot',route=>route.fulfill({json:{...receiptFx,status:'cached',rates:{...receiptFx.rates,VND:{...receiptFx.rates.VND,rateDate:'2026-10-01'}}}}))
  await page.goto('/insights?month=2026-10');await expect(page.getByTestId('spending-total')).toContainText('90,000',{timeout:15_000})
  await expect(page.locator('.i-fx-source')).toContainText('1 Oct 2026 – 13 Oct 2026')
  await expect(page.locator('.i-fx-source [role=status]')).toHaveText('Older reference rates (over 7 days)')
  await expect(page.locator('.i-fx-source')).toHaveCount(1);await expect(page.locator('.i-fx-source p')).toHaveCount(0)
  await expect(page.getByTestId('spending-total')).toContainText('≈ RM 9.16')
  await capture(page,'receipt-cached-mixed-dates')
  const privatePage=await context.newPage();await start(privatePage,true)
  await privatePage.goto('/insights?month=2026-10');await expect(privatePage.getByTestId('spending-total')).toContainText('••••',{timeout:15_000})
  await expect(privatePage.locator('main')).not.toContainText(/346\.00|15\.00|90,000|9\.16|14\.22|369\.38/)
  const accessible=await privatePage.locator('[aria-label],[title]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')+' '+n.getAttribute('title')).join(' '))
  expect(accessible).not.toMatch(/346\.00|90,000|9\.16|14\.22|369\.38/)
  await capture(privatePage,'receipt-hidden')
  await privatePage.getByRole('link',{name:'View records'}).click();await expect(privatePage.locator('main')).not.toContainText(/30,000|90,000|72\.00|24\.00/);await privatePage.close()
})
test('MYR-only and foreign-only use the same receipt without fake rates (mock API)',async({page})=>{
  await start(page,false,'en',receiptRecords.filter(r=>r.currency==='MYR'))
  await page.goto('/insights?month=2026-10');await expect(page.getByTestId('spending-total')).toContainText('346.00',{timeout:15_000})
  await expect(page.locator('.i-fx-source')).toHaveCount(0);await expect(page.locator('.i-equivalent')).toHaveCount(1);await expect(page.locator('.i-equivalent')).toBeEmpty()
  await capture(page,'receipt-single-myr')
  await page.unroute('http://127.0.0.1:54321/**')
  await start(page,false,'en',receiptRecords.filter(r=>r.currency==='CNY'))
  await page.reload();await expect(page.getByTestId('spending-total')).toContainText('15.00',{timeout:15_000});await expect(page.getByTestId('spending-total')).toContainText('≈ RM 9.16')
  await expect(page.locator('.i-summary-ticket .i-record-count')).toHaveText('2 records');await capture(page,'receipt-only-cny')
})
