/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const accountCalls: Array<{
  resolve: (value: { accounts: Array<{ name: string }> }) => void
  reject: (reason?: unknown) => void
}> = []

vi.mock('../lib/personalAccountReadRepository', () => ({
  loadPersonalAccountHome: () => new Promise((resolve, reject) => {
    accountCalls.push({ resolve, reject })
  }),
}))

vi.mock('../lib/personRepository', () => ({
  personRepository: { listPeople: async () => [] },
}))

vi.mock('../lib/settlementRepository', () => ({
  settlementRepository: { listSettlements: async () => [] },
}))

vi.mock('../lib/spaceRepository', () => ({
  spaceRepository: { list: async () => [] },
}))

const affiliations = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('../lib/personalExpenseAffiliationRepository', () => ({
  personalExpenseAffiliationRepository: affiliations,
}))

import { resetVerifiedHomeCache, useHomeData } from './useHomeData'

function Switcher() {
  const [id, setId] = useState('owner-a')
  const data = useHomeData(id, 'refresh', false)
  const label = data.accounts.status === 'ready'
    ? data.accounts.data?.accounts[0]?.name ?? 'empty'
    : data.accounts.status
  return (
    <>
      <button type="button" onClick={() => setId('owner-b')}>switch</button>
      <p>{label}</p>
    </>
  )
}

function Probe({ id, refreshKey = 'refresh' }: { id: string; refreshKey?: string }) {
  const data = useHomeData(id, refreshKey, false)
  const name = data.accounts.status === 'ready'
    ? data.accounts.data?.accounts[0]?.name ?? 'empty'
    : data.accounts.status
  return <p>{data.refreshing ? `updating:${name}` : name}</p>
}

describe('home data identity switch', () => {
  beforeEach(() => {
    accountCalls.length = 0
    affiliations.list.mockReset().mockResolvedValue([])
    resetVerifiedHomeCache()
  })

  afterEach(() => {
    cleanup()
  })

  it('publishes verified accounts without waiting for unrelated trip affiliations', async () => {
    let finish!: (value: never[]) => void
    affiliations.list.mockReturnValue(new Promise<never[]>(resolve => { finish = resolve }))
    render(<Probe id="owner-a" />)
    await act(async () => { accountCalls[0]?.resolve({ accounts: [{ name: 'Ready wallet' }] }) })
    expect(screen.getByText('Ready wallet')).toBeTruthy()
    await act(async () => { finish([]) })
  })

  it('ignores the older same-owner refresh after a newer request succeeds', async () => {
    const view = render(<Probe id="owner-a" />)
    view.rerender(<Probe id="owner-a" refreshKey="newer" />)
    await act(async () => { accountCalls[1]?.resolve({ accounts: [{ name: 'New wallet' }] }) })
    await act(async () => { accountCalls[0]?.reject(new Error('old read failed')) })
    expect(screen.getByText('New wallet')).toBeTruthy()
  })

  it('drops an in-flight account snapshot after the participant changes', async () => {
    const user = userEvent.setup()
    render(<Switcher />)
    await act(async () => {})
    expect(accountCalls).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'switch' }))
    await act(async () => {})
    expect(accountCalls).toHaveLength(2)

    await act(async () => {
      accountCalls[0]?.resolve({ accounts: [{ name: 'Leaked wallet' }] })
    })

    expect(screen.queryByText('Leaked wallet')).toBeNull()
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('keeps the last verified accounts visible while a return visit is still loading', async () => {
    const view = render(<Probe id="owner-a" />)
    await act(async () => {
      accountCalls[0]?.resolve({ accounts: [{ name: 'CIMB' }] })
    })
    expect(screen.getByText('CIMB')).toBeTruthy()

    view.unmount()
    render(<Probe id="owner-a" refreshKey="return" />)
    expect(screen.getByText('updating:CIMB')).toBeTruthy()
    expect(screen.queryByText('error')).toBeNull()
    expect(screen.queryByText(/^loading$/)).toBeNull()

    await act(async () => {
      accountCalls.at(-1)?.resolve({ accounts: [{ name: 'CIMB' }] })
    })
    expect(screen.getByText('CIMB')).toBeTruthy()
  })

  it('fail-closes a return visit when the account request actually fails', async () => {
    const view = render(<Probe id="owner-a" />)
    await act(async () => {
      accountCalls[0]?.resolve({ accounts: [{ name: 'CIMB' }] })
    })
    view.unmount()
    render(<Probe id="owner-a" refreshKey="failed-return" />)
    expect(screen.getByText('updating:CIMB')).toBeTruthy()

    await act(async () => {
      accountCalls.at(-1)?.reject(new Error('offline'))
    })
    expect(screen.getByText('error')).toBeTruthy()
    expect(screen.queryByText(/CIMB/)).toBeNull()
  })
})
