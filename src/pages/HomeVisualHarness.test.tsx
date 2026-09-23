/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import BottomNavigation from '../components/BottomNavigation'
import HomeVisualHarness from './HomeVisualHarness'

afterEach(() => {
  cleanup()
})

describe('home visual harness', () => {
  it('renders the real home screen', () => {
    render(
      <MemoryRouter initialEntries={['/__home-visual?case=both']}>
        <HomeVisualHarness />
      </MemoryRouter>,
    )
    expect(screen.getByTestId('home-mode-switch')).toBeTruthy()
    expect(screen.queryByText('PERSONAL LEDGER')).toBeNull()
    expect(screen.queryByText('Smart capture')).toBeNull()
    expect(screen.queryByText('Tracked receivable')).toBeNull()
  })

  it('highlights Shared on friend, group, and trip routes', () => {
    for (const path of ['/friends', '/person/lan', '/spaces', '/space/hanoi', '/shared']) {
      const view = render(
        <MemoryRouter initialEntries={[path]}>
          <BottomNavigation />
        </MemoryRouter>,
      )
      expect(view.getByRole('button', { name: '共享' }).getAttribute('aria-current')).toBe('page')
      view.unmount()
    }
  })
})
