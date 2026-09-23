/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

const accountCalls: Array<(value: { accounts: Array<{ name: string }> }) => void> = []

vi.mock('../lib/personalAccountReadRepository', () => ({
  loadPersonalAccountHome: () => new Promise((resolve) => {
    accountCalls.push(resolve)
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

vi.mock('../lib/personalExpenseAffiliationRepository', () => ({
  personalExpenseAffiliationRepository: { list: async () => [] },
}))

import { useHomeData } from './useHomeData'

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

describe('home data identity switch', () => {
  it('drops an in-flight account snapshot after the participant changes', async () => {
    const user = userEvent.setup()
    render(<Switcher />)
    await act(async () => {})
    expect(accountCalls).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'switch' }))
    await act(async () => {})
    expect(accountCalls).toHaveLength(2)

    await act(async () => {
      accountCalls[0]?.({ accounts: [{ name: 'Leaked wallet' }] })
    })

    expect(screen.queryByText('Leaked wallet')).toBeNull()
    expect(screen.getByText('loading')).toBeTruthy()
  })
})
