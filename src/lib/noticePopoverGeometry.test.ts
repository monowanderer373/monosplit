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
  it('uses a readable full width below the bell with inset clearance', () => {
    const place = rightPopupGeometry({
      anchor: { left: 120, right: 164, top: 48, bottom: 92 },
      viewport: { left: 0, top: 0, width: 390, height: 844 },
      frame: { left: 0, right: 390 },
      panelHeight: 180,
    })
    expect(place.mode).toBe('popover')
    if (place.mode === 'closed') throw new Error('closed')
    expect(place.left).toBe(16)
    expect(place.top).toBe(98)
    expect(place.width).toBe(358)
    expect(place.left + place.width).toBeLessThanOrEqual(374)
  })

  it('does not squeeze the panel into the narrow space beside the bell', () => {
    const place = rightPopupGeometry({
      anchor: { left: 180, right: 224, top: 40, bottom: 84 },
      viewport: { left: 0, top: 0, width: 360, height: 640 },
      panelHeight: 200,
    })
    expect(place.mode).toBe('popover')
    if(place.mode==='closed')throw new Error('closed')
    expect(place.width).toBe(328)
    expect(place.left).toBe(16)
  })

  it('clamps to an offset visual viewport, desktop frame and safe areas',()=>{
    const place=rightPopupGeometry({anchor:{left:330,right:374,top:80,bottom:124},viewport:{left:100,top:30,width:400,height:700},frame:{left:130,right:480},safe:{top:10,left:8,right:12,bottom:20},bottomReserve:96})
    if(place.mode==='closed')throw new Error('closed')
    expect(place.left).toBeGreaterThanOrEqual(130)
    expect(place.left+place.width).toBeLessThanOrEqual(472)
    expect(place.top).toBe(130)
    expect(place.top+place.maxHeight).toBeLessThanOrEqual(634)
  })
  it('keeps tall content scrollable instead of replacing it with a cramped summary',()=>{
    const place=rightPopupGeometry({anchor:{left:120,right:164,top:30,bottom:74},viewport:{left:0,top:0,width:320,height:460},panelHeight:900,bottomReserve:96})
    expect(place).toMatchObject({mode:'popover',left:16,top:80,width:288,maxHeight:284})
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
