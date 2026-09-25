/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import BottomNavigation from '../BottomNavigation'
import GlobalMoneyAction from '../GlobalMoneyAction'
import PaperSheet from './PaperSheet'
import NavItem from './NavItem'

const paperCss = readFileSync('src/components/navigation/paper.css', 'utf8')

afterEach(() => cleanup())

function Path() {
  const location = useLocation()
  return <div data-testid="path">{location.pathname}</div>
}

function renderNav(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BottomNavigation />
      <Routes>
        <Route path="*" element={<Path />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('paper bottom navigation', () => {
  it('renders the four destinations and marks the active route', () => {
    renderNav('/insights')
    expect(screen.getByRole('button', { name: 'Daily' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Insights' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Shared' }).hasAttribute('aria-current')).toBe(false)
    expect(screen.getByRole('button', { name: 'Me' })).toBeTruthy()
  })

  it('marks shared and me from their routes', () => {
    const shared = renderNav('/shared')
    expect(screen.getByRole('button', { name: 'Shared' }).getAttribute('aria-current')).toBe('page')
    shared.unmount()
    renderNav('/profile')
    expect(screen.getByRole('button', { name: 'Me' }).getAttribute('aria-current')).toBe('page')
  })

  it('navigates with click and keyboard without treating add as a destination', async () => {
    const user = userEvent.setup()
    renderNav('/')
    expect(screen.getByRole('button', { name: 'Daily' }).getAttribute('aria-current')).toBe('page')
    await user.click(screen.getByRole('button', { name: 'Insights' }))
    expect(screen.getByTestId('path').textContent).toBe('/insights')
    screen.getByRole('button', { name: 'Me' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('path').textContent).toBe('/profile')
  })

  it('does not activate a disabled item', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<NavItem label="Later" active={false} disabled icon={<span />} onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: 'Later' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls the existing quick add handler and stays above a 44px target', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    render(<GlobalMoneyAction onAdd={onAdd} />)
    const add = screen.getByRole('button', { name: 'Quick add expense' })
    await user.click(add)
    expect(onAdd).toHaveBeenCalledOnce()
    expect(add.getAttribute('aria-pressed')).toBe('false')
    expect(paperCss).toContain('min-height: 44px')
    expect(paperCss).toContain('env(safe-area-inset-bottom)')
    expect(paperCss).toContain('prefers-reduced-motion')
  })

  it('gives the quick add sheet the paper surface and safe area', () => {
    const ref = { current: null }
    render(
      <PaperSheet labelledBy="sheet-title" dialogRef={ref} onClose={() => undefined}>
        <h2 id="sheet-title">Quick tally</h2>
      </PaperSheet>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Quick tally' })
    expect(dialog.className).toContain('tt-paper')
    expect(dialog.className).toContain('tt-sheet-panel')
    expect(paperCss).toContain('.tt-sheet-panel')
    expect(paperCss).toContain('env(safe-area-inset-bottom)')
  })

  it('marks the seal when the composer is already open', () => {
    render(<GlobalMoneyAction onAdd={() => undefined} composerOpen />)
    expect(screen.getByRole('button', { name: 'Quick add expense' }).getAttribute('aria-pressed')).toBe('true')
  })
})
