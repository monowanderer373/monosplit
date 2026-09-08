import { describe, expect, it } from 'vitest'
import {
  InMemorySettlementRepository,
  SettlementRepositoryError,
  sumSettlementReversalMinor,
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

  it('rejects request ID reuse with different settlement money', async () => {
    const repository = new InMemorySettlementRepository({
      manualCreditorIds: ['manual-creditor'],
    })
    await repository.proposeSettlement(proposal)

    await expect(repository.proposeSettlement({
      ...proposal,
      amountMinor: 1600,
      allocations: [
        { creditorParticipantId: 'account-creditor', amountMinor: 1100 },
        { creditorParticipantId: 'manual-creditor', amountMinor: 500 },
      ],
    })).rejects.toEqual(expect.objectContaining({
      message: 'idempotency_conflict',
    }))
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
      repository.respondToAllocation(accountAllocation.id, 'accepted', 1),
    ).resolves.toEqual(expect.objectContaining({
      paymentStatus: 'confirmed',
      paymentVersion: 2,
    }))
    await expect(
      repository.reverseAllocation('reversal-request', manualAllocation.id, 2),
    ).resolves.toEqual(expect.objectContaining({
      paymentStatus: 'mixed_closed',
      paymentVersion: 3,
    }))

    const [updated] = await repository.listSettlements()
    expect(updated.allocations.find(
      (allocation) => allocation.id === manualAllocation.id,
    )).toEqual(expect.objectContaining({
      state: 'accepted',
      reversalMinor: manualAllocation.amountMinor,
    }))
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

  it('version-guards debtor cancellation of a pending allocation', async () => {
    const repository = new InMemorySettlementRepository()
    await repository.proposeSettlement({
      ...proposal,
      allocations: [{ creditorParticipantId: 'account-creditor', amountMinor: 1500 }],
    })
    const [payment] = await repository.listSettlements()
    const [allocation] = payment.allocations

    await expect(
      repository.cancelPendingAllocation(allocation.id, 99),
    ).rejects.toEqual(expect.objectContaining({ message: 'version_conflict' }))
    await expect(
      repository.cancelPendingAllocation(allocation.id, 1),
    ).resolves.toEqual(expect.objectContaining({
      allocationState: 'cancelled',
      paymentStatus: 'cancelled',
      paymentVersion: 2,
    }))
  })
})

describe('Supabase settlement reversal row mapping', () => {
  it('accepts the one-to-one object shape returned by PostgREST', () => {
    expect(sumSettlementReversalMinor({
      id: 'reversal',
      amount_minor: 200,
    })).toBe(200)
  })

  it('also tolerates array-shaped relationship payloads', () => {
    expect(sumSettlementReversalMinor([
      { id: 'one', amount_minor: '125' },
      { id: 'two', amount_minor: 75 },
    ])).toBe(200)
  })
})
