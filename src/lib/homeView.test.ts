import { describe, expect, it } from 'vitest'
import type { CanonicalExpense } from '../types'
import {
  HOME_RECENT_LIMIT,
  homeRecordAccountFilter,
  homeRecordAmountState,
  isBookedHomeExpense,
  accountAttentionSources,
  availableMoney,
  balanceDisclosure,
  buildHomeRecords,
  countActionableAccountTasks,
  deriveOutstandingSharedContexts,
  groupHomeRecords,
  localCalendarDate,
  monthlyPersonalSpending,
  presentHomeRecords,
  receivableTotals,
  selectHomeTrip,
  shiftCalendarDate,
  tripsFromAffiliations,
  signedAmountCue,
  summaryTileLayout,
  travelReadableExpenseIds,
  type HomeAccount,
  type HomeJournalEntry,
} from './homeView'
import { derivePersonalLedgerRows } from './ledgerSummary'

function expense(input: {
  id: string
  scope?: CanonicalExpense['scope']
  spaceId?: string | null
  currency?: string
  totalMinor: number
  ownerPaidMinor: number
  ownerShareMinor: number
  otherId?: string
  otherName?: string
  otherShareMinor?: number
  otherPaidMinor?: number
  occurredOn?: string
  description?: string
  category?: string
}): CanonicalExpense {
  const ownerId = 'owner'
  const otherId = input.otherId ?? 'lan'
  const scope = input.scope ?? 'direct'
  const participations = scope === 'personal'
    ? [{
      id: `${input.id}-owner`,
      expenseId: input.id,
      participantId: ownerId,
      nameSnapshot: 'Me',
      order: 0,
      state: 'accepted' as const,
      trackingMode: 'tracked' as const,
    }]
    : [
      {
        id: `${input.id}-owner`,
        expenseId: input.id,
        participantId: ownerId,
        nameSnapshot: 'Me',
        order: 0,
        state: 'accepted' as const,
        trackingMode: 'tracked' as const,
      },
      {
        id: `${input.id}-other`,
        expenseId: input.id,
        participantId: otherId,
        nameSnapshot: input.otherName ?? 'Lan',
        order: 1,
        state: 'accepted' as const,
        trackingMode: 'tracked' as const,
      },
    ]
  const otherShare = input.otherShareMinor ?? Math.max(0, input.totalMinor - input.ownerShareMinor)
  return {
    id: input.id,
    clientRequestId: `${input.id}-request`,
    scope,
    spaceId: input.spaceId ?? null,
    createdBy: ownerId,
    totalMinor: input.totalMinor,
    participantCount: participations.length,
    currency: input.currency ?? 'MYR',
    description: input.description ?? input.id,
    category: input.category ?? 'Food',
    occurredOn: input.occurredOn ?? '2026-09-16',
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: `${input.occurredOn ?? '2026-09-16'}T00:00:00.000Z`,
    updatedAt: `${input.occurredOn ?? '2026-09-16'}T00:00:00.000Z`,
    participations,
    payerContributions: [
      {
        expenseParticipationId: `${input.id}-owner`,
        expenseId: input.id,
        amountMinor: input.ownerPaidMinor,
      },
      ...(scope === 'personal' || !input.otherPaidMinor ? [] : [{
        expenseParticipationId: `${input.id}-other`,
        expenseId: input.id,
        amountMinor: input.otherPaidMinor,
      }]),
    ],
    shares: [
      {
        expenseParticipationId: `${input.id}-owner`,
        expenseId: input.id,
        amountMinor: input.ownerShareMinor,
      },
      ...(scope === 'personal' ? [] : [{
        expenseParticipationId: `${input.id}-other`,
        expenseId: input.id,
        amountMinor: otherShare,
      }]),
    ],
  }
}

function account(overrides: Partial<HomeAccount> & Pick<HomeAccount, 'id' | 'currency'>): HomeAccount {
  return {
    name: overrides.id,
    accountClass: 'asset',
    accountType: 'bank',
    archived: false,
    openingStatus: 'posted',
    entrySumMinor: 0,
    ...overrides,
  }
}

describe('available money', () => {
  const accounts: HomeAccount[] = [
    account({ id: 'cimb', name: 'CIMB', currency: 'MYR', entrySumMinor: 10_000, unpostedInstallmentMinor: 50_000 }),
    account({ id: 'cash', name: '现金', accountType: 'cash', currency: 'MYR', entrySumMinor: 2_000 }),
    account({ id: 'tng', name: 'Touch ’n Go', accountType: 'ewallet', currency: 'MYR', entrySumMinor: 500 }),
    account({
      id: 'card',
      name: 'CIMB Credit',
      accountClass: 'liability',
      accountType: 'credit_card',
      currency: 'MYR',
      entrySumMinor: 80_000,
      creditLimitMinor: 500_000,
    }),
    account({ id: 'vnd', name: 'VND cash', accountType: 'cash', currency: 'VND', entrySumMinor: 300_000 }),
    account({ id: 'unknown', name: 'Maybank', currency: 'MYR', openingStatus: 'unknown', entrySumMinor: 0 }),
  ]

  it('keeps currencies separate and ignores liabilities, limits, and unposted instalments', () => {
    expect(availableMoney(accounts, 'all')).toEqual([
      {
        currency: 'MYR',
        amountMinor: 12_500,
        knownOnly: true,
        unknownOpeningCount: 1,
      },
      {
        currency: 'VND',
        amountMinor: 300_000,
        knownOnly: false,
        unknownOpeningCount: 0,
      },
    ])
  })

  it('does not turn an unknown opening into zero', () => {
    expect(availableMoney(accounts, 'unknown')).toEqual([
      {
        currency: 'MYR',
        amountMinor: null,
        knownOnly: false,
        unknownOpeningCount: 1,
      },
    ])
  })

  it('hides only the balance figures when the eye is closed', () => {
    const totals = availableMoney(accounts, 'cimb')
    const hidden = balanceDisclosure(true, totals)
    expect(hidden.hidden).toBe(true)
    expect(hidden.totals.every((total) => total.amountMinor == null)).toBe(true)
    expect(balanceDisclosure(false, totals).totals[0]?.amountMinor).toBe(10_000)
  })
})

describe('account tasks and summary tiles', () => {
  it('counts only actionable account work, including a posted negative balance', () => {
    const sources = accountAttentionSources({
      pendingFundingIds: ['intent-1'],
      recurring: [
        { id: 'posted', status: 'posted' },
        { id: 'failed', status: 'failed' },
        { id: 'review', status: 'pending_review' },
      ],
      installments: [
        { id: 'future', status: 'scheduled' },
        { id: 'failed-instalment', status: 'failed' },
      ],
      pendingPrincipalPlanIds: ['plan-1'],
    })
    const accounts = [
      account({ id: 'known-negative', currency: 'MYR', entrySumMinor: -100 }),
      account({ id: 'unknown-negative', currency: 'MYR', openingStatus: 'unknown', entrySumMinor: -100 }),
    ]
    expect(countActionableAccountTasks(sources, accounts)).toBe(6)
    expect(sources.find((source) => source.id === 'installment:future')?.actionable).toBe(false)
  })

  it('lays out zero, one, and two summary tiles', () => {
    expect(summaryTileLayout(0, 0)).toBe('hidden')
    expect(summaryTileLayout(2, 0)).toBe('account')
    expect(summaryTileLayout(0, 1)).toBe('shared')
    expect(summaryTileLayout(1, 4)).toBe('both')
  })
})

describe('shared outstanding contexts', () => {
  const people = [{ id: 'person-lan', displayName: 'Lan', participantIds: ['lan'] }]

  it('counts five expenses with Lan as one friend context', () => {
    const expenses = [1, 2, 3, 4, 5].map((index) => expense({
      id: `dinner-${index}`,
      totalMinor: 10_000,
      ownerPaidMinor: 10_000,
      ownerShareMinor: 5_000,
      occurredOn: `2026-09-0${index}`,
    }))
    const contexts = deriveOutstandingSharedContexts({
      ownerParticipantId: 'owner',
      expenses,
      settlements: [],
      people,
      spaces: [],
    })
    expect(contexts).toHaveLength(1)
    expect(contexts[0]).toMatchObject({
      id: 'friend:person-lan',
      source: 'friend',
      label: 'Lan',
    })
    expect(contexts[0]?.lines).toEqual([
      { currency: 'MYR', direction: 'receivable', amountMinor: 25_000 },
    ])
  })

  it('keeps a friend with several currencies as one context and splits group and trip', () => {
    const expenses = [
      expense({ id: 'myr', totalMinor: 10_000, ownerPaidMinor: 10_000, ownerShareMinor: 4_000 }),
      expense({
        id: 'vnd',
        currency: 'VND',
        totalMinor: 300_000,
        ownerPaidMinor: 0,
        ownerShareMinor: 100_000,
        otherShareMinor: 200_000,
        otherPaidMinor: 300_000,
      }),
      expense({
        id: 'group-bill',
        scope: 'space',
        spaceId: 'group-1',
        totalMinor: 9_000,
        ownerPaidMinor: 9_000,
        ownerShareMinor: 3_000,
        otherId: 'mei',
        otherName: 'Mei',
      }),
      expense({
        id: 'trip-bill',
        scope: 'space',
        spaceId: 'trip-1',
        totalMinor: 8_000,
        ownerPaidMinor: 0,
        ownerShareMinor: 8_000,
        otherId: 'mei',
        otherName: 'Mei',
        otherShareMinor: 0,
        otherPaidMinor: 8_000,
      }),
    ]
    const contexts = deriveOutstandingSharedContexts({
      ownerParticipantId: 'owner',
      expenses,
      settlements: [],
      people,
      spaces: [
        {
          id: 'group-1',
          type: 'group',
          name: 'Housemates',
          status: 'active',
          startDate: null,
          endDate: null,
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
        {
          id: 'trip-1',
          type: 'trip',
          name: 'Hanoi Days',
          status: 'active',
          startDate: '2026-09-01',
          endDate: '2026-09-20',
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      ],
    })
    expect(contexts.map((context) => context.id)).toEqual([
      'friend:person-lan',
      'group:group-1',
      'trip:trip-1',
    ])
    expect(contexts[0]?.lines.map((line) => line.currency).sort()).toEqual(['MYR', 'VND'])
    expect(receivableTotals(contexts).map((total) => total.currency)).toEqual(['MYR'])
  })
})

describe('home records', () => {
  const cimb = account({ id: 'cimb', name: 'CIMB', currency: 'MYR', entrySumMinor: 20_000 })

  it('uses the funded cash leg instead of the shared total or allocated share', () => {
    const shared = expense({
      id: 'pho',
      scope: 'space',
      spaceId: 'trip-1',
      currency: 'VND',
      totalMinor: 300_000,
      ownerPaidMinor: 300_000,
      ownerShareMinor: 100_000,
      description: 'Pho',
    })
    const [record] = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [shared],
      funding: [{
        expenseId: 'pho',
        status: 'posted',
        accountId: 'cimb',
        accountAmountMinor: 5_680,
        accountCurrency: 'MYR',
      }],
      accounts: [cimb],
      people: [],
      spaces: [],
      affiliations: [],
      journals: [],
      selectedAccountId: 'all',
      limit: HOME_RECENT_LIMIT,
      fundingKnown: true,
    })
    expect(record).toMatchObject({
      amountMinor: 5_680,
      currency: 'MYR',
      walletName: 'CIMB',
      direction: 'out',
      fundingPending: false,
    })
    expect(record?.amountMinor).not.toBe(shared.totalMinor)
    expect(record?.amountMinor).not.toBe(100_000)
    expect(signedAmountCue(record!.direction)).toEqual({ sign: '−', tone: 'outgoing' })
  })

  it('shows pending cross-currency funding without a debited wallet', () => {
    const [record] = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [expense({
        id: 'taxi',
        scope: 'personal',
        totalMinor: 4_500,
        ownerPaidMinor: 4_500,
        ownerShareMinor: 4_500,
      })],
      funding: [{
        expenseId: 'taxi',
        status: 'pending',
        accountId: null,
        accountAmountMinor: null,
        accountCurrency: null,
      }],
      accounts: [cimb],
      people: [],
      spaces: [],
      affiliations: [],
      journals: [],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: true,
    })
    expect(record).toMatchObject({
      fundingPending: true,
      walletName: null,
      amountMinor: 4_500,
    })
  })

  it('maps a wallet label and keeps transfers out of personal spending', () => {
    const transfer: HomeJournalEntry = {
      id: 'move-1',
      kind: 'transfer',
      occurredOn: '2026-09-16',
      createdAt: '2026-09-16T01:00:00.000Z',
      amountMinor: -2_000,
      currency: 'MYR',
      accountId: 'cimb',
      accountName: 'CIMB',
      expenseId: null,
      memo: 'To cash',
    }
    const income: HomeJournalEntry = {
      id: 'pay-1',
      kind: 'income',
      occurredOn: '2026-09-16',
      createdAt: '2026-09-16T02:00:00.000Z',
      amountMinor: 8_000,
      currency: 'MYR',
      accountId: 'cimb',
      accountName: 'CIMB',
      expenseId: null,
      memo: 'Salary',
    }
    const records = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [expense({
        id: 'lunch',
        scope: 'personal',
        totalMinor: 1_200,
        ownerPaidMinor: 1_200,
        ownerShareMinor: 1_200,
        description: 'Lunch',
      })],
      funding: [{
        expenseId: 'lunch',
        status: 'posted',
        accountId: 'cimb',
        accountAmountMinor: 1_200,
        accountCurrency: 'MYR',
      }],
      accounts: [cimb],
      people: [],
      spaces: [],
      affiliations: [{ expenseId: 'lunch', label: 'Hanoi Days', archived: false }],
      journals: [transfer, income],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: true,
    })
    expect(records.find((record) => record.id.startsWith('journal:move-1'))).toMatchObject({
      walletName: 'CIMB',
      direction: 'out',
      affectsPersonalSpending: false,
      amountMinor: 2_000,
    })
    expect(records.find((record) => record.description === 'Salary')).toMatchObject({
      direction: 'in',
      affectsPersonalSpending: false,
    })
    expect(signedAmountCue('in')).toEqual({ sign: '+', tone: 'incoming' })
    expect(records.find((record) => record.expenseId === 'lunch')?.chip).toEqual({
      kind: 'personal-trip',
      tripLabel: 'Hanoi Days',
    })
    const spending = records
      .filter((record) => record.affectsPersonalSpending)
      .reduce((sum, record) => sum + record.amountMinor, 0)
    expect(spending).toBe(1_200)
  })

  it('keeps compact mode from changing amounts or order', () => {
    const records = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [
        expense({ id: 'older', scope: 'personal', totalMinor: 100, ownerPaidMinor: 100, ownerShareMinor: 100, occurredOn: '2026-09-15' }),
        expense({ id: 'newer', scope: 'direct', totalMinor: 200, ownerPaidMinor: 200, ownerShareMinor: 100, occurredOn: '2026-09-16', description: 'Coffee' }),
      ],
      funding: [],
      accounts: [],
      people: [{ id: 'person-lan', displayName: 'Lan', participantIds: ['lan'] }],
      spaces: [],
      affiliations: [],
      journals: [],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: true,
    })
    const detailed = presentHomeRecords(records, 'detailed')
    const compact = presentHomeRecords(records, 'compact')
    expect(compact.map((record) => [record.id, record.amountMinor, record.direction])).toEqual(
      detailed.map((record) => [record.id, record.amountMinor, record.direction]),
    )
    expect(detailed.every((record) => record.showIcon)).toBe(true)
    expect(compact.every((record) => !record.showIcon)).toBe(true)
    expect(compact.find((record) => record.chip.kind === 'direct')?.showChip).toBe(true)
    expect(compact.find((record) => record.chip.kind === 'personal')?.showChip).toBe(false)
  })
})

describe('travel selection and filtering', () => {
  const trips = [
    {
      id: 'old',
      type: 'trip' as const,
      name: 'Penang',
      status: 'archived' as const,
      startDate: '2026-01-01',
      endDate: '2026-01-05',
      updatedAt: '2026-01-06T00:00:00.000Z',
    },
    {
      id: 'hanoi',
      type: 'trip' as const,
      name: 'Hanoi Days',
      status: 'active' as const,
      startDate: '2026-09-10',
      endDate: '2026-09-20',
      updatedAt: '2026-09-10T00:00:00.000Z',
    },
  ]

  it('prefers an active trip, then the latest ended trip, then none', () => {
    expect(selectHomeTrip(trips, '2026-09-16')?.trip.id).toBe('hanoi')
    expect(selectHomeTrip(trips, '2026-09-16')?.phase).toBe('active')
    expect(selectHomeTrip([trips[0]!], '2026-09-16')).toMatchObject({
      phase: 'ended',
      trip: { id: 'old' },
    })
    expect(selectHomeTrip([], '2026-09-16')).toBeNull()
  })

  it('offers a private affiliation label that is not a space trip', () => {
    const choices = tripsFromAffiliations(
      [{ expenseId: 'visible', label: 'Da Nang', archived: false }],
      [],
    )
    expect(choices.map((trip) => trip.name)).toEqual(['Da Nang'])
    expect(selectHomeTrip(choices, '2026-09-16')?.trip.name).toBe('Da Nang')
  })

  it('keeps an expense-linked refund beside the expense row', () => {
    const records = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [expense({
        id: 'lunch',
        scope: 'personal',
        totalMinor: 1_000,
        ownerPaidMinor: 1_000,
        ownerShareMinor: 1_000,
      })],
      funding: [],
      accounts: [],
      people: [],
      spaces: [],
      affiliations: [],
      journals: [{
        id: 'refund-1',
        kind: 'refund',
        occurredOn: '2026-09-16',
        createdAt: '2026-09-16T03:00:00.000Z',
        amountMinor: 1_000,
        currency: 'MYR',
        accountId: 'cimb',
        accountName: 'CIMB',
        expenseId: 'lunch',
        memo: 'Refund',
      }],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: true,
    })
    expect(records.some((record) => record.description === 'Refund' && record.direction === 'in')).toBe(true)
  })

  it('filters travel by affiliation or trip space without granting unread expenses', () => {
    const ids = travelReadableExpenseIds({
      readableExpenseIds: ['visible'],
      affiliations: [
        { expenseId: 'visible', label: 'Hanoi Days', archived: false },
        { expenseId: 'secret', label: 'Hanoi Days', archived: false },
      ],
      trip: { id: 'hanoi', name: 'Hanoi Days' },
      expenses: [
        { id: 'visible', spaceId: null },
        { id: 'secret', spaceId: null },
        { id: 'space-visible', spaceId: 'hanoi' },
      ],
    })
    expect(ids).toEqual(['visible'])
  })
})

describe('date grouping', () => {
  it('separates today and yesterday across a local timezone boundary', () => {
    const today = localCalendarDate(new Date('2026-09-16T16:30:00.000Z'), 'Asia/Kuala_Lumpur')
    expect(today).toBe('2026-09-17')
    expect(shiftCalendarDate(today, -1)).toBe('2026-09-16')
    const records = presentHomeRecords([
      {
        id: 'today',
        expenseId: null,
        spaceId: null,
        occurredOn: '2026-09-17',
        createdAt: '2026-09-17T00:00:00.000Z',
        description: 'Today',
        category: 'Food',
        chip: { kind: 'personal' },
        direction: 'out',
        amountMinor: 1,
        currency: 'MYR',
        accountId: null,
        walletName: null,
        fundingPending: false,
        amountKnown: true,
        affectsPersonalSpending: true,
      },
      {
        id: 'yesterday',
        expenseId: null,
        spaceId: null,
        occurredOn: '2026-09-16',
        createdAt: '2026-09-16T00:00:00.000Z',
        description: 'Yesterday',
        category: 'Food',
        chip: { kind: 'personal' },
        direction: 'out',
        amountMinor: 1,
        currency: 'MYR',
        accountId: null,
        walletName: null,
        fundingPending: false,
        amountKnown: true,
        affectsPersonalSpending: true,
      },
    ], 'detailed')
    expect(groupHomeRecords(records, today).map((group) => group.kind)).toEqual(['today', 'yesterday'])
  })
})

describe('funding fail-closed and booked activity', () => {
  it('does not present a payer contribution while funding is unknown', () => {
    const [record] = buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [expense({
        id: 'pho',
        scope: 'space',
        spaceId: 'trip-1',
        currency: 'VND',
        totalMinor: 300_000,
        ownerPaidMinor: 300_000,
        ownerShareMinor: 100_000,
      })],
      funding: [],
      accounts: [],
      people: [],
      spaces: [],
      affiliations: [],
      journals: [],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: false,
    })
    expect(record?.amountKnown).toBe(false)
    expect(record?.amountMinor).not.toBe(300_000)
    expect(homeRecordAmountState(false, 'loading')).toBe('pending')
    expect(homeRecordAmountState(false, 'error')).toBe('unavailable')
    expect(homeRecordAmountState(true, 'ready')).toBe('amount')
  })

  it('drops pending direct expenses and ignores the daily account filter while traveling', () => {
    const pending = expense({
      id: 'pending',
      totalMinor: 4_000,
      ownerPaidMinor: 0,
      ownerShareMinor: 2_000,
    })
    pending.participations[0]!.state = 'pending'
    expect(isBookedHomeExpense(pending, 'owner')).toBe(false)
    expect(buildHomeRecords({
      ownerParticipantId: 'owner',
      expenses: [pending],
      funding: [],
      accounts: [],
      people: [],
      spaces: [],
      affiliations: [],
      journals: [],
      selectedAccountId: 'all',
      limit: null,
      fundingKnown: true,
    })).toEqual([])
    expect(homeRecordAccountFilter('travel', 'cimb')).toBe('all')
    expect(homeRecordAccountFilter('daily', 'cimb')).toBe('cimb')
  })
})

describe('monthly spending', () => {
  it('sums personal spending for the month without using the shared total', () => {
    const rows = derivePersonalLedgerRows([
      expense({
        id: 'month',
        totalMinor: 10_000,
        ownerPaidMinor: 10_000,
        ownerShareMinor: 4_000,
        occurredOn: '2026-09-02',
      }),
    ], 'owner')
    expect(monthlyPersonalSpending(rows, '2026-09')).toEqual([
      { currency: 'MYR', amountMinor: 4_000 },
    ])
  })
})
