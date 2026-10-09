/** @vitest-environment jsdom */
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { useRouteScroll } from './useRouteScroll'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('restores a route entry only after its data is ready and never across authenticated identities', () => {
  let scroll = 0
  const callbacks = new Map<number, FrameRequestCallback>(); let next = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { callbacks.set(++next, cb); return next })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
  Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scroll })
  const scrollTo = vi.fn((value: ScrollToOptions) => { scroll = value.top ?? 0 })
  vi.stubGlobal('scrollTo', scrollTo)
  function flushFrames() { act(() => { const frames = [...callbacks.values()]; callbacks.clear(); frames.forEach(cb => cb(0)) }) }
  function Journey() {
    const location = useLocation(), navigate = useNavigate()
    const [ready, setReady] = useState(true), [owner, setOwner] = useState('scroll-owner')
    useRouteScroll(ready, owner)
    return <><p>{location.pathname}</p><button onClick={() => navigate('/detail')}>Detail</button>
      <button onClick={() => { setReady(false); navigate(-1) }}>Back loading</button>
      <button onClick={() => setReady(true)}>Loaded</button><button onClick={() => setOwner('different-owner')}>Switch identity</button></>
  }
  render(<MemoryRouter initialEntries={['/list']}><Journey /></MemoryRouter>)
  flushFrames(); expect(scroll).toBe(0)
  act(() => { scroll = 640; window.dispatchEvent(new Event('scroll')) })
  fireEvent.click(screen.getByText('Detail')); flushFrames(); expect(scroll).toBe(0)
  act(() => { scroll = 240; window.dispatchEvent(new Event('scroll')) })
  fireEvent.click(screen.getByText('Back loading')); flushFrames(); expect(scroll).toBe(240)
  fireEvent.click(screen.getByText('Loaded')); flushFrames(); expect(scroll).toBe(640)
  fireEvent.click(screen.getByText('Switch identity')); flushFrames(); expect(scroll).toBe(0)
})
