import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { setupMulticurrency } from './fixtures/multicurrency'
const out='test-results/multicurrency'
test.beforeAll(async()=>{await mkdir(out,{recursive:true})})
for(const width of [320,360,390,430])for(const font of [100,125,150,200])test(`native accounts fit ${width}px and ${font}% root text`,async({page})=>{
 const state=await setupMulticurrency(page);await page.setViewportSize({width,height:844});await page.goto('/accounts/bank');await expect(page.getByRole('heading',{name:'Wise',exact:true})).toBeVisible();await page.evaluate(font=>document.documentElement.style.fontSize=font+'%',font)
 const balances=page.locator('.ttmc-native-balances');await expect(balances.locator('li')).toHaveCount(3);await balances.getByRole('button',{name:/View all/}).click();await expect(balances.locator('li')).toHaveCount(5);await expect(balances).toContainText('Balance not set');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1)
 await balances.getByRole('button',{name:'Show fewer currencies'}).click();await expect(balances.locator('li')).toHaveCount(3);expect(state.writes).toHaveLength(0)
 await page.screenshot({path:`${out}/account-${width}-${font}.png`,fullPage:true})
})
test('shared persistent FX is display only; missing rates preserve native balances and completeness',async({page})=>{
 const state=await setupMulticurrency(page,{missingRates:true});await page.goto('/accounts/bank');const balances=page.locator('.ttmc-balances');await expect(balances).toContainText('Known recorded value');await expect(balances).toContainText('10,000.00');await expect(page.locator('.ttmc-native-balances')).toContainText('900,000');await expect(balances).toContainText('known balances only');expect(state.writes).toHaveLength(0)
})
test('same-parent exchange submits actual source total and net receipt with included fee once',async({page})=>{
 const state=await setupMulticurrency(page);await page.goto('/accounts/move/exchange?from=bank');await page.getByRole('combobox',{name:'To',exact:true}).selectOption('vnd-unit');await page.getByLabel(/Total deducted/).fill('150');await page.getByLabel(/You received/).fill('900000');await page.getByRole('button',{name:'Fee details (optional)',exact:true}).click();await page.getByLabel(/Fee amount/).fill('2');await page.getByRole('button',{name:'Record exchange',exact:true}).dblclick();await expect(page).toHaveURL(/accounts\/movements\/movement-1/);expect(state.writes).toHaveLength(1);expect(state.writes[0]).toMatchObject({movement_payload:{kind:'exchange',source_total_minor:15000,destination_net_minor:900000,fee:{mode:'included_source',amount_minor:200}}});await expect(page.getByRole('main')).toContainText('150.00');await expect(page.getByRole('main')).toContainText('900,000');await page.screenshot({path:`${out}/exchange-result.png`,fullPage:true})
})
test('financial conceal removes values and inputs while retaining the in-memory movement draft',async({page})=>{
 const state=await setupMulticurrency(page);await page.goto('/accounts/move/exchange?from=bank');await page.getByRole('combobox',{name:'To',exact:true}).selectOption('vnd-unit');await page.getByLabel(/Total deducted/).fill('12345.67');await page.getByLabel(/You received/).fill('900000');await page.getByRole('button',{name:'Hide account balances',exact:true}).click();await expect(page.getByRole('textbox')).toHaveCount(0);expect(await page.getByRole('main').ariaSnapshot()).not.toMatch(/12345|12,345|900,000|900000/);await page.getByRole('button',{name:'Show amount to continue'}).click();await expect(page.getByLabel(/Total deducted/)).toHaveValue('12,345.67');expect(state.writes).toHaveLength(0)
})
