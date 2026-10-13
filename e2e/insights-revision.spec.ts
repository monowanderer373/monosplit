import { test, expect } from '@playwright/test'
import { setup, capture, fixtures, apiExpense } from './fixtures/insightsUi'

for (const width of [320, 360, 390, 430, 480, 768]) for (const scale of [100, 125, 150, 200]) {
  test(`revision filter fit ${width}px / ${scale}% text (simulated)`, async ({ page }) => {
    const lang = scale === 150 ? 'zh' : 'en'
    await setup(page, fixtures, 200, false, lang)
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/insights?month=2026-10&currency=MYR')
    await expect(page.getByTestId('spending-total')).toContainText('101.00')
    if (scale !== 100) await page.addStyleTag({ content: `html {font-size:${scale}% !important}` })
    const buttons = page.locator('.i-filter-button')
    // Allow observer-driven layout to finish; assertions use actual glyph geometry.
    await expect.poll(() => buttons.evaluateAll(nodes => nodes.every(el => {
      const value = el.querySelector<HTMLElement>('.i-filter-value')!
      return value.scrollWidth <= value.clientWidth + 1 && value.getBoundingClientRect().right <= el.getBoundingClientRect().right + 1
    }))).toBe(true)
    const boxes = await buttons.evaluateAll(nodes => nodes.map(el => ({ x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })))
    expect(boxes.every(box => box.height >= 48)).toBe(true)
    const layout = await page.locator('.i-filter-row').getAttribute('data-layout')
    if (layout === 'two') { expect(boxes[0].y).toBe(boxes[1].y); expect(boxes[0].height).toBe(boxes[1].height); expect(boxes[2].y).toBeGreaterThan(boxes[0].y) }
    if (layout === 'single') expect(boxes[2].y).toBeGreaterThan(boxes[1].y)
    if (scale === 100 && width <= 480) expect(layout).toBe('two')
    const popupTrigger = buttons.first()
    await popupTrigger.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    if (layout === 'two') {
      const heights = await buttons.evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height))
      expect(heights[0]).toBe(heights[1])
    }
    await expect.poll(() => page.locator('.i-month-face').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true)
    await page.locator('.i-year-button').click()
    await expect(page.locator('.i-year-range')).toHaveText('2021–2032')
    await expect(page.locator('.i-year-range .i-icon')).toHaveCount(0)
    await expect.poll(() => page.locator('.i-month-face').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true)
    const box = await page.getByRole('dialog').boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(15); expect(box!.x + box!.width).toBeLessThanOrEqual(width - 15)
    expect(box!.y).toBeGreaterThanOrEqual(15); expect(box!.y + box!.height).toBeLessThanOrEqual(829)
    if ((width === 390 && [100, 150, 200].includes(scale)) || (width === 320 && scale === 200)) await capture(page, `revision-years-${width}-${scale}`)
    await page.keyboard.press('Escape'); await expect(page.locator('.i-year-button')).toBeFocused(); await expect(page.getByRole('dialog')).toHaveCount(1)
    await page.keyboard.press('Escape'); await expect(popupTrigger).toBeFocused(); await expect(page.getByRole('dialog')).toHaveCount(0)
    if ((width === 390 && [100, 150, 200].includes(scale)) || (width === 320 && scale === 200)) await capture(page, `revision-page-${width}-${scale}`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    await capture(page, `revision-geometry-${width}-${scale}`, false)
  })
}

test('year paging, return months and This month preserve draft/committed data', async ({ page }) => {
  await setup(page)
  await page.goto('/insights?month=2026-10&currency=MYR')
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await page.clock.setFixedTime(new Date('2026-11-01T01:00:00Z'))
  await page.getByRole('button', { name: 'Month: Oct 2026' }).click()
  await page.locator('.i-year-button').click(); await page.getByRole('button', { name: 'Next 12 years' }).click()
  await expect(page.locator('.i-year-range')).toHaveText('2033–2044')
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await page.getByRole('button', { name: '2038', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Choose year: 2038' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Month: Oct 2026' })).toBeVisible()
  await page.locator('.i-year-button').click(); await page.getByRole('button', { name: 'Previous 12 years' }).click()
  await page.getByRole('button', { name: '2026', exact: true }).click()
  await expect(page.getByRole('button', { name: 'September 2026' })).toHaveText('Sep')
  await page.locator('.i-year-button').click(); await page.getByRole('button', { name: 'Months', exact: true }).click()
  await page.getByRole('button', { name: 'This month', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Month: Nov 2026' })).toBeVisible()
  await expect(page.getByTestId('spending-total')).toContainText('0.00')
})

test('long filter labels and one real currency reflow without cropping', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 320, height: 844 }); await page.goto('/insights?month=2026-10&currency=MYR')
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  await page.locator('.i-filter-button--month .i-filter-value').evaluate(el => { el.textContent = 'October 2026' })
  await page.locator('.i-filter-button--scope .i-filter-value').evaluate(el => { el.textContent = 'All spending — personal and shared spending records' })
  await expect.poll(() => page.locator('.i-filter-button--scope').getAttribute('data-stacked')).toBe('true')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  await page.getByRole('button', { name: 'Currency: MYR' }).click()
  await expect(page.locator('.i-currency-option')).toHaveCount(1)
  await page.keyboard.press('Escape')
})

test('records loading, retry and Change month are real actions, never false zero/error states', async ({ page, context }) => {
  await setup(page)
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  let failed = false
  await page.route('http://127.0.0.1:54321/rest/v1/expenses*', async route => { await pending; await route.fulfill({ status: failed ? 500 : 200, json: failed ? { message: 'Test failure' } : fixtures.map(apiExpense) }) })
  await page.goto('/insights/records?month=2026-10&currency=MYR')
  await expect(page.locator('.i-skeleton-row')).toHaveCount(2)
  await expect(page.getByTestId('spending-total')).toHaveCount(0)
  await capture(page, 'revision-records-loading')
  release(); await expect(page.getByTestId('spending-total')).toContainText('101.00')
  failed = true; await page.reload()
  await expect(page.getByRole('alert')).toContainText('Couldn’t load records')
  await expect(page.getByTestId('spending-total')).toHaveCount(0)
  await capture(page, 'revision-records-error')
  failed = false; await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByTestId('spending-total')).toContainText('101.00')
  const empty = await context.newPage(); await setup(empty, []); await empty.goto('/insights/records?month=2026-10&currency=MYR&tab=ranking')
  await expect(empty.getByText('No records for this month')).toBeVisible(); await capture(empty, 'revision-records-empty')
  await empty.getByRole('button', { name: 'Change month' }).click(); await expect(empty.getByRole('dialog', { name: 'Month', exact: true })).toBeVisible()
  await expect(empty.getByRole('tab', { name: 'Ranking' })).toHaveAttribute('aria-selected', 'true')
  await empty.getByRole('button', { name: 'November 2026' }).click(); await expect(empty.getByRole('button', { name: 'Month: Nov 2026' })).toBeVisible()
  await empty.close()
})

test('touch and short viewport keep the picker anchored and internally scrollable', async ({ page }) => {
  await setup(page); await page.setViewportSize({ width: 360, height: 400 }); await page.goto('/insights?month=2026-10&currency=MYR')
  const trigger = page.getByRole('button', { name: 'Month: Oct 2026' })
  await trigger.tap()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox(); expect(box!.y).toBeGreaterThanOrEqual(15); expect(box!.y + box!.height).toBeLessThanOrEqual(385)
  expect(await page.locator('.i-popover-content').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await page.getByRole('button', { name: 'October 2026' }).focus(); await page.keyboard.press('End')
  await expect(page.getByRole('button', { name: 'December 2026' })).toBeFocused()
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused()
})
