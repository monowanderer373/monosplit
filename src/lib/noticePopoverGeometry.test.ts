/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import {
  previewItems,
  realTaskCount,
  rightPopupGeometry,
  shouldCancelNavigation,
} from './noticePopoverGeometry'
import { createPopoverMotion } from './noticePopoverMotion'

describe('right notice geometry', () => {
  it('places the panel to the right of the bell with inset clearance', () => {
    const place = rightPopupGeometry({
      anchor: { left: 120, right: 164, top: 48, bottom: 92 },
      viewport: { left: 0, top: 0, width: 390, height: 844 },
      frame: { left: 0, right: 390 },
      panelHeight: 180,
    })
    expect(place.mode).toBe('popover')
    if (place.mode === 'closed') throw new Error('closed')
    expect(place.left).toBe(170)
    expect(place.top).toBe(48)
    expect(place.width).toBeLessThanOrEqual(300)
    expect(place.left + place.width).toBeLessThanOrEqual(374)
  })

  it('falls back to a same-side summary when the remaining width is too narrow', () => {
    const place = rightPopupGeometry({
      anchor: { left: 180, right: 224, top: 40, bottom: 84 },
      viewport: { left: 0, top: 0, width: 360, height: 640 },
      panelHeight: 200,
    })
    expect(place.mode).toBe('summary')
  })

  it('keeps grouped task counts independent of the preview slice', () => {
    expect(previewItems(['a', 'b', 'c', 'd']).items).toEqual(['a', 'b', 'c'])
    expect(realTaskCount([
      { tab: 'tasks', taskCount: 2 },
      { tab: 'tasks' },
      { tab: 'activity' },
    ])).toBe(3)
    expect(shouldCancelNavigation('navigate')).toBe(false)
    expect(shouldCancelNavigation('outside')).toBe(true)
  })
})

describe('notice popover motion', () => {
  it('unmounts immediately under reduced motion and ignores work after dispose', () => {
    const node = document.createElement('div')
    const hidden = { n: 0 }
    const motion = createPopoverMotion(node, { reduced: true, onHidden: () => { hidden.n += 1 } })
    motion.show()
    motion.hide()
    expect(hidden.n).toBe(1)
    motion.dispose()
    motion.hide()
    expect(hidden.n).toBe(1)
  })
})
