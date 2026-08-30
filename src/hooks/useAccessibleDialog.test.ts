import { describe, expect, it } from 'vitest'
import { nextDialogFocusIndex } from './useAccessibleDialog'

describe('dialog focus wrapping', () => {
  it('wraps Tab from the final control to the first', () => {
    expect(nextDialogFocusIndex(2, 3, false)).toBe(0)
  })

  it('wraps Shift+Tab from the first control to the final control', () => {
    expect(nextDialogFocusIndex(0, 3, true)).toBe(2)
  })

  it('handles a dialog without focusable controls', () => {
    expect(nextDialogFocusIndex(-1, 0, false)).toBe(-1)
  })
})
