/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useNavigate, useLocation } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { useRouteScroll } from '../../hooks/useRouteScroll'
import { RecentRecordList } from '../home/HomeScreen'
import { useStore } from '../../store/useStore'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function ScrollProbe() {
  const navigate = useNavigate(), location = useLocation()
  useRouteScroll(true, 'travel-scroll-test-owner')
  return <><span>{location.pathname}</span><button onClick={() => navigate('/travel/trip/a')}>detail</button><button onClick={() => navigate(-1)}>back</button></>
}
it('restores the original Travel route entry scroll after browser back', async () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  const scroll = vi.fn((options: ScrollToOptions) => Object.defineProperty(window, 'scrollY', { configurable: true, value: options.top }))
  vi.stubGlobal('scrollTo', scroll)
  const user = userEvent.setup()
  render(<MemoryRouter><ScrollProbe /></MemoryRouter>)
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 240 })
  fireEvent.scroll(window)
  await user.click(screen.getByRole('button', { name: 'detail' }))
  expect(window.scrollY).toBe(0)
  await user.click(screen.getByRole('button', { name: 'back' }))
  expect(window.scrollY).toBe(240)
})
it('restores loaded record days for the same route and identity, but not another identity', async () => {
  useStore.setState({ lang: 'en' })
  vi.stubGlobal('IntersectionObserver', undefined)
  const props = { recordGroups: [
    { date: '2026-10-09', kind: 'today' as const, records: [] },
    { date: '2026-10-08', kind: 'yesterday' as const, records: [] },
    { date: '2026-10-07', kind: 'date' as const, records: [] },
  ], recordsStatus: 'ready' as const, accountsStatus: 'ready' as const, mode: 'travel' as const, travelStatus: 'ready' as const,
    affiliationsStatus: 'ready' as const, density: 'detailed' as const, balanceHidden: false }
  const user = userEvent.setup()
  const view = render(<RecentRecordList props={props} paginationKey="owner-a:entry:trip" />)
  await user.click(screen.getByRole('button', { name: 'Show earlier records' }))
  await user.click(screen.getByRole('button', { name: 'Show earlier records' }))
  view.unmount()
  const reopened = render(<RecentRecordList props={props} paginationKey="owner-a:entry:trip" />)
  expect(document.querySelectorAll('.home-day')).toHaveLength(3)
  reopened.unmount()
  render(<RecentRecordList props={props} paginationKey="owner-b:entry:trip" />)
  expect(document.querySelectorAll('.home-day')).toHaveLength(1)
})
