/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SharedPage from './SharedPage'
import { useStore } from '../store/useStore'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    authUser: {
      id: 'user',
      participantId: 'owner',
      displayName: 'Ada',
      defaultCurrency: 'MYR',
      timezone: 'Asia/Kuala_Lumpur',
      isAnonymous: false,
    },
    loading: false,
  }),
}))
vi.mock('../hooks/usePersonalLedger', () => ({
  usePersonalLedger: () => ({ expenses: [], outbox: [], refresh: vi.fn() }),
}))
vi.mock('../hooks/useSettlements', () => ({
  useSettlements: () => ({ settlements: [] }),
}))
vi.mock('../hooks/useHomeNotifications', () => ({
  useHomeNotifications: () => ({ notices: [], status: 'ready' }),
}))
vi.mock('../hooks/useLocalCalendarDate', () => ({
  useLocalCalendarDate: () => '2026-10-18',
}))
vi.mock('../lib/personRepository', () => ({
  personRepository: {
    listPeople: async () => [{
      id: 'person-sam',
      ownerParticipantId: 'owner',
      displayName: 'Sam',
      linkedParticipantId: 'sam',
      mergedIntoPersonId: null,
      manualParticipantIds: [],
      primaryManualParticipantId: null,
      state: 'linked',
      friendshipStatus: 'accepted',
    }],
    subscribeToPeople: () => () => undefined,
    createManualPerson: vi.fn(),
  },
}))
vi.mock('../lib/friendRepository', () => ({
  friendRepository: {
    listLinkRequests: async () => [],
    createInvite: vi.fn(),
    respondManualLink: vi.fn(),
  },
}))
vi.mock('../lib/spaceRepository', () => ({
  spaceRepository: {
    list: async () => [],
    create: vi.fn(),
  },
}))

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

function SearchProbe() {
  const [params] = useSearchParams()
  return <div data-testid="query">{params.toString()}</div>
}

describe('Shared A page', () => {
  it('keeps a single Shared header and Friends selected by default', async () => {
    useStore.setState({ lang: 'en', homeUi: { ...useStore.getState().homeUi, balanceHidden: false } })
    render(
      <MemoryRouter initialEntries={['/shared']}>
        <Routes>
          <Route path="/shared" element={<SharedPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findAllByRole('heading', { name: 'Shared' })).toHaveLength(1)
    expect(screen.getByRole('tab', { name: 'Friends' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('People')).toBeNull()
  })

  it('preserves currency while switching to Groups instead of clearing the query', async () => {
    useStore.setState({ lang: 'en' })
    render(
      <MemoryRouter initialEntries={['/shared?currency=VND']}>
        <Routes>
          <Route path="/shared" element={<><SharedPage /><SearchProbe /></>} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('tab', { name: 'Groups' })
    await userEvent.click(screen.getByRole('tab', { name: 'Groups' }))
    expect(screen.getByTestId('query').textContent).toContain('tab=groups')
    expect(screen.getByTestId('query').textContent).not.toContain('currency=VND')
  })

  it('conceals list amounts and direction from the accessible name', async () => {
    useStore.setState({ lang: 'en', homeUi: { ...useStore.getState().homeUi, balanceHidden: true } })
    render(
      <MemoryRouter initialEntries={['/shared']}>
        <Routes>
          <Route path="/shared" element={<SharedPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const row = await screen.findByTestId('person-card')
    expect(row.getAttribute('aria-label')).toContain('Hidden')
    expect(row.textContent).not.toMatch(/MYR|RM|\d+\.\d{2}/)
  })
})
