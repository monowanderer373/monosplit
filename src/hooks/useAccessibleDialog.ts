import { useEffect, useEffectEvent, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function nextDialogFocusIndex(
  currentIndex: number,
  focusableCount: number,
  backwards: boolean,
): number {
  if (focusableCount <= 0) return -1
  if (backwards) return currentIndex <= 0 ? focusableCount - 1 : currentIndex - 1
  return currentIndex < 0 || currentIndex >= focusableCount - 1 ? 0 : currentIndex + 1
}

function setBackgroundInert(dialog: HTMLElement): () => void {
  const restored: Array<{
    element: HTMLElement
    inert: boolean
    ariaHidden: string | null
  }> = []
  let branch: HTMLElement | null = dialog

  while (branch?.parentElement && branch.parentElement !== document.body) {
    for (const sibling of Array.from(branch.parentElement.children)) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) continue
      restored.push({
        element: sibling,
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute('aria-hidden'),
      })
      sibling.inert = true
      sibling.setAttribute('aria-hidden', 'true')
    }
    branch = branch.parentElement
  }

  return () => {
    for (const { element, inert, ariaHidden } of restored) {
      element.inert = inert
      if (ariaHidden == null) element.removeAttribute('aria-hidden')
      else element.setAttribute('aria-hidden', ariaHidden)
    }
  }
}

export function useAccessibleDialog<T extends HTMLElement>(
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const dialogRef = useRef<T>(null)
  const closeDialog = useEffectEvent(onClose)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const restoreBackground = setBackgroundInert(dialog)
    const frame = window.requestAnimationFrame(() => {
      const fallback = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(initialFocusRef?.current ?? fallback ?? dialog).focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDialog()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
      if (focusable.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement)
      const nextIndex = nextDialogFocusIndex(currentIndex, focusable.length, event.shiftKey)
      if (
        currentIndex === -1
        || (event.shiftKey && currentIndex === 0)
        || (!event.shiftKey && currentIndex === focusable.length - 1)
      ) {
        event.preventDefault()
        focusable[nextIndex]?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown, true)
      restoreBackground()
      previouslyFocused?.focus()
    }
  }, [initialFocusRef])

  return dialogRef
}
