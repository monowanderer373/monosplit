import { useLayoutEffect, type RefObject } from 'react'

/** Fit actual glyphs/options, including font scaling, rather than a device model. */
export function useContentFit(ref: RefObject<HTMLElement | null>, revision: string, grid = false) {
  useLayoutEffect(() => {
    const root = ref.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const canvas = document.createElement('canvas').getContext('2d')
      if (!canvas) return
      const textWidth = (el: HTMLElement) => {
        const style = getComputedStyle(el)
        canvas.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily
        return canvas.measureText(el.textContent ?? '').width + (parseFloat(style.letterSpacing) || 0) * (el.textContent?.length ?? 0)
      }
      const gap = parseFloat(getComputedStyle(root).columnGap) || 8
      if (grid) {
        const options = [...root.querySelectorAll<HTMLElement>('.i-month-face')]
        const minimum = Math.max(1, ...options.map(el => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect().width + 18 }))
        root.dataset.columns = String(Math.max(1, Math.min(4, Math.floor((root.clientWidth + gap) / (minimum + gap)))))
        return
      }
      const buttons = [...root.querySelectorAll<HTMLButtonElement>('.i-filter-button')]
      const widths = buttons.map(button => {
        const style = getComputedStyle(button)
        const value = button.querySelector<HTMLElement>('.i-filter-value')!
        const icons = [...button.querySelectorAll<SVGElement>('.i-icon')]
        return textWidth(value) + icons.reduce((sum, icon) => sum + icon.getBoundingClientRect().width, 0)
          + (parseFloat(style.gap) || 0) * icons.length + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2
      })
      root.dataset.layout = widths.reduce((sum,n) => sum+n,0)+gap <= root.clientWidth ? 'row' : 'single'
      root.style.gridTemplateColumns = root.dataset.layout === 'row' ? `minmax(${widths[0]}px,1fr) minmax(${widths[1]}px,1.15fr)` : 'minmax(0,1fr)'
      buttons.forEach((button, index) => { button.dataset.stacked = String(widths[index] > button.getBoundingClientRect().width + 1) })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('button').forEach(button => observer.observe(button))
    const mutation = new MutationObserver(measure)
    mutation.observe(root, { childList: true, characterData: true, subtree: true })
    document.fonts?.addEventListener('loadingdone', measure)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener('loadingdone', measure); window.removeEventListener('resize', measure) }
  }, [ref, revision, grid])
}
