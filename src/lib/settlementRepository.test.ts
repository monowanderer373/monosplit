import { describe, expect, it } from 'vitest'
import {
  InMemorySettlementRepository,
  SettlementRepositoryError,
  type ProposeSettlementInput,
} from './settlementRepository'

const proposal: ProposeSettlementInput = {
  requestId: '11111111-1111-4111-8111-111111111111',
  scope: 'space',
  spaceId: '22222222-2222-4222-8222-222222222222',
  currency: 'myr',
  amountMinor: 1500,
  paymentDate: '2026-08-30',
  allocations: [
    { creditorParticipantId: 'account-creditor', amountMinor: 1000 },
    { creditorParticipantId: 'manual-creditor', amountMinor: 500 },
  ],
  note: 'Dinner',
}

describe('InMemorySettlementRepository contract', () => {
  it('returns the same settlement for idempotent retries', async () => {
    const repository = new InMemorySettlementRepository({
      manualCreditorIds: ['manual-creditor'],
    })

    const [first, retry] = await Promise.all([
      repository.proposeSettlement(proposal),
      repository.proposeSettlement(proposal),
    ])

    expect(first).toBe(retry)
    expect(await repository.listSettlements()).toHaveLength(1)
  })

  it('accepts manual allocations and leaves account allocations pending', async () => {
    const repository = new InMemorySettlementRepository({
      manualCreditorIds: ['manual-creditor'],
    })
    await repository.proposeSettlement(proposal)

    const [payment] = await repository.listSettlements()

    expect(payment).toEqual(expect.objectContaining({
      currency: 'MYR',
      status: 'partially_confirmed',
      allocations: [
        expect.objectContaining({
          creditorParticipantId: 'account-creditor',
          state: 'pending',
        }),
        expect.objectContaining({
          creditorParticipantId: 'manual-creditor',
          state: 'accepted',
        }),
      ],
    }))
  })

  it('recomputes the parent status after response and reversal', async () => {
    const repository = new InMemorySettlementRepository({
      manualCreditorIds: ['manual-creditor'],
    })
    await repository.proposeSettlement(proposal)
    const [payment] = await repository.listSettlements()
    const accountAllocation = payment?.allocations.find(
      (allocation) => allocation.creditorParticipantId === 'account-creditor',
    )
    const manualAllocation = payment?.allocations.find(
      (allocation) => allocation.creditorParticipantId === 'manual-creditor',
    )
    if (!accountAllocation || !manualAllocation) throw new Error('test_setup_failed')

    await expect(
      repository.respondToAllocation(accountAllocation.id, 'accepted'),
    ).resolves.toBe('confirmed')
    await expect(
      repository.reverseAllocation(manualAllocation.id),
    ).resolves.toBe('partially_confirmed')
  })

  it('rejects duplicate creditors and non-reconciling allocations', async () => {
    const repository = new InMemorySettlementRepository()
    const duplicate = {
      ...proposal,
      allocations: [
        { creditorParticipantId: 'same', amountMinor: 1000 },
        { creditorParticipantId: 'same', amountMinor: 500 },
      ],
    }
    const nonReconciling = {
      ...proposal,
      allocations: [{ creditorParticipantId: 'creditor', amountMinor: 1499 }],
    }

    await expect(repository.proposeSettlement(duplicate)).rejects.toEqual(
      expect.objectContaining<Partial<SettlementRepositoryError>>({
        message: 'duplicate_creditor',
      }),
    )
    await expect(repository.proposeSettlement(nonReconciling)).rejects.toEqual(
      expect.objectContaining<Partial<SettlementRepositoryError>>({
        message: 'settlement_does_not_reconcile',
      }),
    )
  })
})
