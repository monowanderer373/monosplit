/** @vitest-environment jsdom */
import type { ReactNode } from 'react'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import AppShell from './AppShell'

const mocks = vi.hoisted(() => ({ open: vi.fn() }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ authUser: {
  id: 'account', participantId: 'participant', displayName: 'Dav', defaultCurrency: 'MYR', isAnonymous: false,
} }) }))
vi.mock('../hooks/usePersonalLedger', () => ({ PersonalLedgerProvider: ({ children }: { children: ReactNode }) => children }))
vi.mock('../hooks/useUniversalQuickAdd', () => ({
  UniversalQuickAddProvider: ({ children }: { children: ReactNode }) => children,
  useUniversalQuickAdd: () => ({ action: null, feedback: null, open: mocks.open }),
}))
vi.mock('./GlobalMoneyActionHost', () => ({ default: () => null }))
vi.mock('./GlobalMoneyAction', () => ({ default: () => null }))
vi.mock('./BottomNavigation', () => ({ default: () => null }))
afterEach(() => { cleanup(); mocks.open.mockReset() })

it('opens the shortcut once per entry, including another entry after returning to Daily', async () => {
  const router = createMemoryRouter([{ element: <AppShell />, children: [
    { path: '/', element: <p>Daily</p> },
    { path: '/quick-add', element: <p>Shortcut</p> },
  ] }], { initialEntries: ['/quick-add?source=pwa-shortcut'] })
  const { rerender } = render(<RouterProvider router={router} />)
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1))
  rerender(<RouterProvider router={router} />)
  expect(mocks.open).toHaveBeenCalledTimes(1)
  await act(() => router.navigate('/'))
  await act(() => router.navigate('/quick-add?source=pwa-shortcut'))
  await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(2))
  expect(mocks.open.mock.calls[1][0]).toMatchObject({
    directDeepLink: true, context: { ref: { kind: 'personal' }, currentParticipantId: 'participant' },
  })
  router.dispose()
})
