/** Viewport CSS-pixel geometry only. This never loads or computes financial data. */

export type PopupPlacement =
  | { mode: 'closed' }
  | { mode: 'popover' | 'summary'; left: number; top: number; width: number; maxHeight: number; origin: string }

export function rightPopupGeometry({
  anchor,
  viewport,
  frame = { left: viewport.left, right: viewport.left + viewport.width },
  panelHeight = 160,
  gap = 6,
  inset = 16,
  maxWidth = 300,
  minWidth = 148,
  safe = { top: 0, right: 0, bottom: 0 },
  bottomReserve = 0,
}: {
  anchor: { left: number; right: number; top: number; bottom: number }
  viewport: { left: number; top: number; width: number; height: number }
  frame?: { left: number; right: number }
  panelHeight?: number
  gap?: number
  inset?: number
  maxWidth?: number
  minWidth?: number
  safe?: { top: number; right: number; bottom: number }
  bottomReserve?: number
}): PopupPlacement {
  const numbers = [
    anchor.left, anchor.right, anchor.top, anchor.bottom,
    viewport.left, viewport.top, viewport.width, viewport.height,
    frame.left, frame.right, panelHeight, gap, inset, maxWidth, minWidth,
  ]
  if (numbers.some(n => !Number.isFinite(n)) || viewport.width <= 0 || viewport.height <= 0 || panelHeight < 0) {
    throw new Error('invalid_geometry')
  }
  const vr = viewport.left + viewport.width
  const vb = viewport.top + viewport.height
  if (anchor.right <= viewport.left || anchor.left >= vr || anchor.bottom <= viewport.top || anchor.top >= vb) {
    return { mode: 'closed' }
  }
  const left = anchor.right + gap
  const right = Math.min(vr - safe.right, frame.right) - inset
  const top = Math.max(anchor.top, viewport.top + safe.top + inset)
  const bottom = vb - Math.max(inset + safe.bottom, bottomReserve)
  const width = Math.max(0, Math.min(maxWidth, right - left))
  const maxHeight = Math.max(0, bottom - top)
  if (width < 44 || maxHeight < 44) return { mode: 'closed' }
  return {
    mode: width < minWidth || panelHeight > maxHeight ? 'summary' : 'popover',
    left,
    top,
    width,
    maxHeight,
    origin: '0px 20px',
  }
}

export function previewItems<T>(items: readonly T[], limit = 3) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid_limit')
  return { items: items.slice(0, limit), hasMore: items.length > limit, totalRows: items.length }
}

export function realTaskCount(notices: readonly { tab: string; taskCount?: number }[]) {
  return notices.filter(n => n.tab === 'tasks').reduce((n, row) => n + (row.taskCount ?? 1), 0)
}

export function noticeDisplayRow(
  _n: unknown,
  options: { hidden?: boolean; dateLabel?: string; accountLabel?: string; title: string; hiddenTitle?: string },
) {
  return {
    title: options.hidden ? (options.hiddenTitle ?? 'Review item') : options.title,
    meta: [options.dateLabel, options.hidden ? '' : options.accountLabel].filter(Boolean).join(' · '),
  }
}

export const cancelCloseReasons = ['outside', 'escape', 'toggle', 'identity', 'route', 'anchor-hidden'] as const
export type NoticeCloseReason =
  | (typeof cancelCloseReasons)[number]
  | 'navigate'

export function shouldCancelNavigation(reason: string) {
  return (cancelCloseReasons as readonly string[]).includes(reason)
}

export function readSafeInsets(doc: Document = document) {
  const node = doc.createElement('div')
  node.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);padding-bottom:env(safe-area-inset-bottom,0px)'
  doc.documentElement.append(node)
  const style = getComputedStyle(node)
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
  }
  node.remove()
  return insets
}
