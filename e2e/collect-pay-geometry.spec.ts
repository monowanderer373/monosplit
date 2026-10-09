import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

// Run against the unchanged checkpoint and current build served concurrently.
// This test does not synthesize dimensions from reference images or CSS pixels.
const baseline = process.env.COLLECT_PAY_BASELINE_URL
const styleKeys = ['display', 'width', 'height', 'minHeight', 'borderRadius', 'borderTopWidth', 'borderRightWidth',
  'borderBottomWidth', 'borderLeftWidth', 'borderTopColor', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'color', 'backgroundColor', 'gap']
async function geometry(page: Page) {
  return page.locator('[data-testid="home-receivable"],[data-testid="home-payable"]').evaluateAll((cards, keys) => cards.map(card => {
    const read = (element: Element) => {
      const rect = element.getBoundingClientRect(), styles = getComputedStyle(element)
      return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        styles: Object.fromEntries(keys.map(key => [key, styles[key as keyof CSSStyleDeclaration]])) }
    }
    const content = [...card.querySelectorAll('.home-meta,.home-debt-value,.home-money-line,.tt-money-currency,.tt-money-number')].map(read)
    const textRects: object[] = []
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node.textContent?.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      const r = range.getBoundingClientRect()
      textRects.push({ text: node.textContent, x: r.x, y: r.y, width: r.width, height: r.height })
    }
    return { id: card.getAttribute('data-testid'), ...read(card), content, textRects }
  }), styleKeys)
}
for (const width of [320, 360, 390, 430]) for (const lang of ['en', 'zh']) {
  test(`summary geometry unchanged at ${width}px in ${lang}`, async ({ page, context }) => {
    test.skip(!baseline, 'Set COLLECT_PAY_BASELINE_URL to the pre-change checkpoint preview URL.')
    await mkdir('test-results/collect-pay', { recursive: true })
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const before = await context.newPage(); await before.setViewportSize({ width, height: 844 })
    const suffix = `/__home-visual?case=both&lang=${lang}`
    await before.goto(`${baseline}${suffix}`); await page.goto(suffix)
    await expect(before.getByTestId('home-receivable')).toBeVisible(); await expect(page.getByTestId('home-receivable')).toBeVisible()
    await before.evaluate(() => document.fonts.ready); await page.evaluate(() => document.fonts.ready)
    await before.evaluate(() => window.scrollTo(0, 0)); await page.evaluate(() => window.scrollTo(0, 0))
    const original = await geometry(before), current = await geometry(page)
    await writeFile(`test-results/collect-pay/geometry-${width}-${lang}.json`, JSON.stringify({ original, current }, null, 2))
    await before.screenshot({ path: `test-results/collect-pay/home-before-${width}-${lang}.png`, fullPage: true })
    await page.screenshot({ path: `test-results/collect-pay/home-after-${width}-${lang}.png`, fullPage: true })
    expect(current).toEqual(original)
    await expect(page.getByRole('button', { name: lang === 'en' ? 'Open amounts to collect' : '查看待收事项' })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByTestId('home-receivable').focus(); await page.keyboard.press('Enter')
    await before.close()
  })
}
