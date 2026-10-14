/** Measure displayed glyphs, not example lengths or device breakpoints. */
export function fitReceipt(root: HTMLElement, scrollLabel: string) {
  const canvas = document.createElement('canvas').getContext('2d')
  const width = (element: HTMLElement | null) => {
    if (!element) return 0
    const range = document.createRange()
    range.selectNodeContents(element)
    return range.getBoundingClientRect().width
  }
  const list = root.querySelector<HTMLElement>('.i-currency-list')
  if (!list) return
  const rows = [...list.querySelectorAll<HTMLElement>('.i-currency-row')]
  if (!rows.length) return
  const units = Math.ceil(Math.max(...rows.map(row => {
    const unit = row.querySelector<HTMLElement>('.i-currency-unit')!
    return Math.max(width(unit), parseFloat(getComputedStyle(unit).minWidth) || 0)
  })))
  const originals = Math.ceil(Math.max(...rows.map(row => width(row.querySelector('.i-original-number')))))
  const equivalents = Math.ceil(Math.max(...rows.map(row => width(row.querySelector('.i-equivalent-value')))))
  const gap = parseFloat(getComputedStyle(rows[0]).columnGap) || 0
  list.style.setProperty('--i-unit-width', `${units}px`)
  list.style.setProperty('--i-equivalent-width', `${equivalents}px`)
  const stacked = units + originals + equivalents + 2 * gap > list.clientWidth
  list.dataset.layout = stacked ? 'stacked' : 'inline'
  let anyScroll = false
  for (const row of rows) {
    row.dataset.stacked = String(stacked)
    let rowScroll = false
    for (const selector of ['.i-original-number', '.i-equivalent']) {
      const amount = row.querySelector<HTMLElement>(selector)!
      const scroll = amount.scrollWidth > amount.clientWidth + 1
      amount.tabIndex = scroll ? 0 : -1
      if (scroll) amount.setAttribute('title', scrollLabel)
      else amount.removeAttribute('title')
      rowScroll ||= scroll
    }
    row.dataset.scroll = String(rowScroll)
    anyScroll ||= rowScroll
  }
  list.dataset.scroll = String(anyScroll)

  const ticket = root.closest('.i-summary-ticket')
  const unwrapped = (element: HTMLElement | null) => {
    if (!element || !canvas) return width(element)
    const style = getComputedStyle(element)
    canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    return canvas.measureText(element.textContent ?? '').width
  }
  const header = ticket?.querySelector<HTMLElement>('.i-ticket-top')
  if (header) {
    const style = getComputedStyle(header)
    const title = header.querySelector<HTMLElement>('.i-ticket-title')!
    const titleWidth = unwrapped(title.querySelector('span')) + title.querySelector('.i-icon')!.getBoundingClientRect().width + (parseFloat(getComputedStyle(title).columnGap) || 0)
    const available = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    header.dataset.layout = titleWidth + unwrapped(header.querySelector('.i-quiet-month')) + (parseFloat(style.columnGap) || 0) > available ? 'stacked' : 'inline'
  }
  const footer = ticket?.querySelector<HTMLElement>('.i-ticket-footer')
  if (footer) {
    // Measure the canonical inline action before choosing a mode. Its stacked
    // divider/padding must not make a resize oscillate between the two modes.
    footer.dataset.layout = 'inline'
    const style = getComputedStyle(footer), action = footer.querySelector<HTMLElement>('.i-link')!
    const actionStyle = getComputedStyle(action)
    const actionWidth = unwrapped(action.querySelector('span')) + action.querySelector('.i-icon')!.getBoundingClientRect().width + parseFloat(actionStyle.paddingLeft) + parseFloat(actionStyle.borderLeftWidth) + (parseFloat(actionStyle.columnGap) || 0)
    const copyWidth = Math.max(unwrapped(footer.querySelector('.i-record-count')), unwrapped(footer.querySelector('.i-share-basis')))
    const available = footer.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    footer.dataset.layout = copyWidth + actionWidth + (parseFloat(style.columnGap) || 0) > available ? 'stacked' : 'inline'
  }
}
