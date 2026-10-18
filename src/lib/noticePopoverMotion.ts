/** Interruptible WAAPI controller; no finance, no network, no timers. */

export type PopoverMotion = {
  show: () => void
  hide: () => void
  dispose: () => void
}

export function createPopoverMotion(
  node: HTMLElement,
  {
    reduced = false,
    onHidden = () => {},
    readStyle = (target: HTMLElement) => getComputedStyle(target),
  }: {
    reduced?: boolean
    onHidden?: () => void
    readStyle?: (node: HTMLElement) => { opacity: string; transform: string }
  } = {},
): PopoverMotion {
  let animation: Animation | null = null
  let generation = 0
  let disposed = false

  function capture() {
    if (animation?.playState === 'running') {
      const style = readStyle(node)
      return { opacity: style.opacity, transform: style.transform }
    }
    return null
  }

  function stop() {
    generation += 1
    if (animation) {
      animation.onfinish = null
      animation.cancel()
      animation = null
    }
  }

  function show() {
    if (disposed) return
    const from = capture()
    stop()
    node.inert = false
    node.style.opacity = '1'
    node.style.transform = 'none'
    if (reduced || !node.animate) return
    animation = node.animate(
      [from ?? { opacity: 0, transform: 'translateX(-6px) scale(.97)' }, { opacity: 1, transform: 'translateX(0) scale(1)' }],
      { duration: 280, easing: 'cubic-bezier(.22,1,.36,1)' },
    )
  }

  function hide() {
    if (disposed) return
    const from = capture()
    stop()
    node.inert = true
    const token = generation
    if (reduced || !node.animate) {
      onHidden()
      return
    }
    animation = node.animate(
      [from ?? { opacity: 1, transform: 'translateX(0) scale(1)' }, { opacity: 0, transform: 'translateX(-4px) scale(.98)' }],
      { duration: 170, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
    )
    animation.onfinish = () => {
      if (!disposed && token === generation) onHidden()
    }
  }

  function dispose() {
    disposed = true
    stop()
    node.inert = true
  }

  return { show, hide, dispose }
}
