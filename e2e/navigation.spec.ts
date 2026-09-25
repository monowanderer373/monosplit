import { writeFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  closeBrowsers,
  copyInviteUrl,
  createConfirmedAccount,
  openAuthenticatedBrowser,
  openPersonDetail,
  signIn,
} from './fixtures/localSupabase'

test('keeps four destinations and a usable global money action at 320px', async ({ page }, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('navigation', 'Navigation Tester', runId)
  await signIn(page, account)
  await page.setViewportSize({ width: 320, height: 640 })

  await page.goto('/friends')
  const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
  await expect(navigation).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Daily', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Shared', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(navigation.getByRole('button', { name: 'Insights', exact: true })).toBeVisible()
  await expect(navigation.getByRole('button', { name: 'Me', exact: true })).toBeVisible()

  const addButton = page.getByRole('button', { name: 'Quick add expense' })
  const box = await addButton.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)

  await addButton.click()
  const gate = page.getByRole('dialog', { name: 'Where should this go?' })
  await expect(gate).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toHaveCount(0)
  await gate.getByRole('button', { name: 'Personal', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/friends$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/spaces')
  await expect(navigation.getByRole('button', { name: 'Shared', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Groups / Trips' })).toBeVisible()
  await page.goto('/profile')
  await expect(navigation.getByRole('button', { name: 'Me', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('direct Quick Add Back and Close both land safely on Personal', async ({ page }, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const account = await createConfirmedAccount('deep-link', 'Deep Link Tester', runId)
  await signIn(page, account)

  await page.goto('about:blank')
  await page.goto('/quick-add?source=pwa-shortcut')
  await expect(page.getByRole('dialog', { name: 'Quick tally' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Daily', exact: true })).toBeVisible()

  await page.goto('about:blank')
  await page.goto('/quick-add?source=pwa-shortcut')
  const dialog = page.getByRole('dialog', { name: 'Quick tally' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Daily', exact: true })).toBeVisible()
})

test('keeps the global money action above mobile form controls', async ({
  browser,
}, testInfo) => {
  const runId = `${Date.now().toString(36)}-${testInfo.parallelIndex}`
  const [ownerAccount, targetAccount] = await Promise.all([
    createConfirmedAccount('pointer-owner', 'Pointer Owner', runId),
    createConfirmedAccount('pointer-target', 'Pointer Target', runId),
  ])
  const [ownerBrowser, targetBrowser] = await Promise.all([
    openAuthenticatedBrowser(browser, ownerAccount),
    openAuthenticatedBrowser(browser, targetAccount),
  ])

  try {
    const owner = ownerBrowser.page
    const target = targetBrowser.page
    await owner.goto('/friends')
    await owner.getByRole('button', { name: 'Copy friend invite' }).click()
    await expect(owner.getByText('Invite copied', { exact: true })).toBeVisible()
    await target.goto(await copyInviteUrl(owner))
    await target.getByRole('button', { name: 'Accept friend invite' }).click()

    await owner.reload()
    await owner.getByPlaceholder('Person’s name').fill('Pointer Manual')
    await owner.getByRole('button', { name: 'Add person' }).click()

    await openPersonDetail(owner, 'Pointer Manual')
    const personNavigation = owner.getByRole('navigation', { name: 'Primary navigation' })
    await expect(personNavigation.getByRole('button', { name: 'Shared', exact: true })).toHaveAttribute('aria-current', 'page')
    await owner.getByRole('button', { name: 'Add Expense', exact: true }).click()
    const capture = owner.getByRole('dialog', { name: 'Add Expense' })
    await capture.getByRole('textbox', { name: /^Amount/ }).fill('1.01')
    await capture.getByPlaceholder('What was this for?').fill('Pointer overlap')
    await capture.getByRole('button', { name: 'Save expense' }).click()
    await expect(owner.getByRole('status')).toContainText('Expense recorded')
    await owner.getByRole('status').click()

    const select = owner.getByLabel('Link Pointer Manual to friend')
    await select.selectOption({ label: 'Pointer Target' })
    await expect(select.locator('option:checked')).toHaveText('Pointer Target')

    const add = owner.getByRole('button', { name: 'Quick add expense' })
    await select.scrollIntoViewIfNeeded()
    const [selectBox, addBox] = await Promise.all([
      select.boundingBox(),
      add.boundingBox(),
    ])
    if (!selectBox || !addBox) throw new Error('Expected mobile control bounds.')
    await owner.evaluate(
      ({ selectCenter, addCenter }) =>
        window.scrollBy(0, selectCenter - addCenter),
      {
        selectCenter: selectBox.y + selectBox.height / 2,
        addCenter: addBox.y + addBox.height / 2,
      },
    )
    const hitTestEvidence = await collectHitTestEvidence(owner, add, select)
    await testInfo.attach('global-money-action-hit-test.json', {
      body: JSON.stringify(hitTestEvidence, null, 2),
      contentType: 'application/json',
    })
    if (process.env.CAPTURE_HIT_TEST === '1') {
      writeFileSync(
        'test-results/global-money-action-hit-test.json',
        `${JSON.stringify(hitTestEvidence, null, 2)}\n`,
      )
    }
    expect(hitTestEvidence.geometry.centerOverlapsSelect).toBe(true)
    expect(hitTestEvidence.hitTest.topIsGlobalAction).toBe(true)

    await add.click()
    const captureDialog = owner.getByRole('dialog', { name: 'Add Expense' })
    await expect(captureDialog).toBeVisible()
    await expect(owner.getByRole('dialog', { name: 'Where should this go?' })).toHaveCount(0)
    await expect(
      captureDialog.getByRole('button', {
        name: 'Current context: Pointer Manual. Change context',
      }),
    ).toBeVisible()
    const modalHitTestEvidence = await collectHitTestEvidence(
      owner,
      owner.getByTestId('global-money-action-layer').locator('button'),
      select,
    )
    expect(modalHitTestEvidence.hitTest.topIsGlobalAction).toBe(false)
    expect(
      modalHitTestEvidence.hitTest.elementsFromPoint.some(
        (element) => element?.role === 'dialog',
      ),
    ).toBe(true)
    await captureDialog.getByRole('button', { name: 'Close' }).click()

    await expect(select.locator('option:checked')).toHaveText('Pointer Target')
    await owner.getByRole('button', { name: 'Back to Friends' }).click()
    await expect(owner).toHaveURL(/\/friends$/)
    await owner.getByRole('button', { name: 'Quick add expense' }).click()
    const friendsGate = owner.getByRole('dialog', { name: 'Where should this go?' })
    await expect(friendsGate).toBeVisible()
    await expect(
      friendsGate.getByRole('button', { name: 'Pointer Manual', exact: true }),
    ).toHaveCount(1)
    await friendsGate.getByRole('button', { name: 'Close' }).click()
    await owner
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('button', { name: 'Daily', exact: true })
      .click()
    await expect(owner).toHaveURL(/\/$/)
  } finally {
    await closeBrowsers([ownerBrowser, targetBrowser])
  }
})

async function collectHitTestEvidence(
  page: Page,
  action: Locator,
  select: Locator,
) {
  const actionHandle = await action.elementHandle()
  const selectHandle = await select.elementHandle()
  const navHandle = await page
    .locator('nav[aria-label="Primary navigation"]')
    .elementHandle()
  const layerHandle = await page
    .getByTestId('global-money-action-layer')
    .elementHandle()
  const mainHandle = await page.locator('main').elementHandle()
  if (
    !actionHandle
    || !selectHandle
    || !navHandle
    || !layerHandle
    || !mainHandle
  ) {
    throw new Error('Expected hit-testing DOM elements.')
  }

  return page.evaluate(
    ({ action, select, nav, layer, main }) => {
      const rect = (element: Element) => {
        const value = element.getBoundingClientRect()
        return {
          x: value.x,
          y: value.y,
          top: value.top,
          right: value.right,
          bottom: value.bottom,
          left: value.left,
          width: value.width,
          height: value.height,
        }
      }
      const describe = (element: Element | null) => {
        if (!element) return null
        const html = element as HTMLElement
        return {
          tag: element.tagName.toLowerCase(),
          id: html.id || null,
          className: typeof html.className === 'string' ? html.className : null,
          ariaLabel: element.getAttribute('aria-label'),
          role: element.getAttribute('role'),
        }
      }
      const computed = (element: Element) => {
        const style = getComputedStyle(element)
        return {
          position: style.position,
          zIndex: style.zIndex,
          pointerEvents: style.pointerEvents,
          transform: style.transform,
          translate: style.translate,
          isolation: style.isolation,
          overflow: style.overflow,
        }
      }
      const stackingAncestors = (element: Element) => {
        const ancestors = []
        let current: Element | null = element
        while (current) {
          const style = getComputedStyle(current)
          const reasons = [
            ['root', current === document.documentElement],
            ['positioned-z-index', (
              style.zIndex !== 'auto'
              && style.position !== 'static'
            )],
            ['fixed-or-sticky', (
              style.position === 'fixed'
              || style.position === 'sticky'
            )],
            ['transform-or-translate', (
              style.transform !== 'none'
              || style.translate !== 'none'
            )],
            ['isolation', style.isolation === 'isolate'],
            ['opacity', Number(style.opacity) < 1],
            ['filter', style.filter !== 'none'],
            ['backdrop-filter', style.backdropFilter !== 'none'],
            ['contain', /(layout|paint|strict|content)/.test(style.contain)],
          ].filter(([, active]) => active).map(([reason]) => reason)
          if (reasons.length > 0) {
            ancestors.push({
              ...describe(current),
              reasons,
              position: style.position,
              zIndex: style.zIndex,
            })
          }
          current = current.parentElement
        }
        return ancestors
      }

      const actionRect = rect(action)
      const selectRect = rect(select)
      const center = {
        x: actionRect.left + actionRect.width / 2,
        y: actionRect.top + actionRect.height / 2,
      }
      const elements = document.elementsFromPoint(center.x, center.y)
      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        rects: {
          action: actionRect,
          select: selectRect,
          nav: rect(nav),
          layer: rect(layer),
          main: rect(main),
        },
        center,
        geometry: {
          centerOverlapsSelect:
            center.x >= selectRect.left
            && center.x <= selectRect.right
            && center.y >= selectRect.top
            && center.y <= selectRect.bottom,
        },
        hitTest: {
          elementFromPoint: describe(document.elementFromPoint(center.x, center.y)),
          elementsFromPoint: elements.map(describe),
          topIsGlobalAction:
            elements[0] === action
            || action.contains(elements[0] ?? null),
        },
        computed: {
          action: computed(action),
          nav: computed(nav),
          layer: computed(layer),
          select: computed(select),
          main: computed(main),
        },
        stackingContexts: {
          action: stackingAncestors(action),
          select: stackingAncestors(select),
        },
      }
    },
    {
      action: actionHandle,
      select: selectHandle,
      nav: navHandle,
      layer: layerHandle,
      main: mainHandle,
    },
  )
}
