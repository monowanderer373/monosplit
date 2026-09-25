import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('./supabase', () => ({
  supabase: { rpc },
}))

import { createPersonalAccount } from './personalAccountRepository'

describe('createPersonalAccount', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('calls the authenticated account command and does not invent an opening balance', async () => {
    rpc.mockResolvedValue({ data: { account_id: 'account-1' }, error: null })
    await createPersonalAccount({
      name: 'Touch n Go',
      accountType: 'ewallet',
      currency: 'myr',
      openingBalanceMinor: null,
      balanceAsOf: null,
      requestId: '11111111-1111-4111-8111-111111111111',
    })
    expect(rpc).toHaveBeenCalledWith('create_personal_account', {
      request_id: '11111111-1111-4111-8111-111111111111',
      account_name: 'Touch n Go',
      account_type: 'ewallet',
      currency_code: 'myr',
      opening_balance_minor: null,
      balance_as_of: null,
      make_default: false,
    })
  })
})
