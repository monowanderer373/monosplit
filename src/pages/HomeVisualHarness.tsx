import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import BottomNavigation from '../components/BottomNavigation'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import GlobalMoneyAction from '../components/GlobalMoneyAction'
import HomeScreen from '../components/home/HomeScreen'
import '../components/home/home.css'
import {
  availableMoney,
  buildHomeRecords,
  groupHomeRecords,
  presentHomeRecords,
  selectHomeTrip,
  summaryTileLayout,
  type HomeAccount,
} from '../lib/homeView'
import { useStore } from '../store/useStore'
import type { CanonicalExpense } from '../types'

const owner = 'owner'
const accounts: HomeAccount[] = [
  {
    id: 'cimb',
    name: 'CIMB',
    accountClass: 'asset',
    accountType: 'bank',
    currency: 'MYR',
    archived: false,
    openingStatus: 'posted',
    entrySumMinor: 125_000,
  },
  {
    id: 'cash',
    name: '现金',
    accountClass: 'asset',
    accountType: 'cash',
    currency: 'MYR',
    archived: false,
    openingStatus: 'posted',
    entrySumMinor: 4_000,
  },
]

function expense(input: {
  id: string
  scope: CanonicalExpense['scope']
  totalMinor: number
  ownerPaidMinor: number
  spaceId?: string | null
  description?: string
  category?: string
  occurredOn?: string
  createdAt?: string
}): CanonicalExpense {
  const occurredOn = input.occurredOn ?? '2026-09-16'
  const participations = input.scope === 'personal'
    ? [{
      id: `${input.id}-owner`,
      expenseId: input.id,
      participantId: owner,
      nameSnapshot: 'Me',
      order: 0,
      state: 'accepted' as const,
      trackingMode: 'tracked' as const,
    }]
    : [
      {
        id: `${input.id}-owner`,
        expenseId: input.id,
        participantId: owner,
        nameSnapshot: 'Me',
        order: 0,
        state: 'accepted' as const,
        trackingMode: 'tracked' as const,
      },
      {
        id: `${input.id}-lan`,
        expenseId: input.id,
        participantId: 'lan',
        nameSnapshot: 'Lan',
        order: 1,
        state: 'accepted' as const,
        trackingMode: 'tracked' as const,
      },
    ]
  return {
    id: input.id,
    clientRequestId: `${input.id}-request`,
    scope: input.scope,
    spaceId: input.spaceId ?? null,
    createdBy: owner,
    totalMinor: input.totalMinor,
    participantCount: participations.length,
    currency: 'MYR',
    description: input.description ?? input.id,
    category: input.category ?? 'Food',
    occurredOn,
    status: 'active',
    version: 1,
    correctsExpenseId: null,
    terminationKind: null,
    voidedAt: null,
    createdAt: input.createdAt ?? `${occurredOn}T02:00:00.000Z`,
    updatedAt: `${occurredOn}T02:00:00.000Z`,
    participations,
    payerContributions: [{
      expenseParticipationId: `${input.id}-owner`,
      expenseId: input.id,
      amountMinor: input.ownerPaidMinor,
    }],
    shares: input.scope === 'personal'
      ? [{
        expenseParticipationId: `${input.id}-owner`,
        expenseId: input.id,
        amountMinor: input.totalMinor,
      }]
      : [
        {
          expenseParticipationId: `${input.id}-owner`,
          expenseId: input.id,
          amountMinor: Math.floor(input.totalMinor / 2),
        },
        {
          expenseParticipationId: `${input.id}-lan`,
          expenseId: input.id,
          amountMinor: input.totalMinor - Math.floor(input.totalMinor / 2),
        },
      ],
  }
}

function HarnessBody() {
  const [params] = useSearchParams()
  const scenario = params.get('case') ?? 'both'
  const density = scenario === 'compact' ? 'compact' : 'detailed'
  const mode = scenario.startsWith('travel') ? 'travel' : 'daily'
  const hidden = scenario === 'hidden'
  const selectedAccountId = scenario === 'account' ? 'cimb' : 'all'
  const accountTasks = scenario === 'none' || scenario === 'shared-only' || scenario === 'empty-accounts'
    ? []
    : [{ id: 'funding:1', kind: 'pending_funding' as const, actionable: true as const }]
  const sharedContexts = scenario === 'none' || scenario === 'account-only'
    ? []
    : [{
      id: 'friend:lan',
      source: 'friend' as const,
      label: 'Lan',
      personId: 'person-lan',
      spaceId: null,
      lines: [{ currency: 'MYR', direction: 'receivable' as const, amountMinor: 2_400 }],
    }]
  const model = useMemo(() => {
    const expenses = [
      expense({ id: 'today-personal', scope: 'personal', totalMinor: 1_200, ownerPaidMinor: 1_200, description: 'Coffee', occurredOn: '2026-09-16' }),
      expense({ id: 'today-direct', scope: 'direct', totalMinor: 5_680, ownerPaidMinor: 5_680, description: '河粉', occurredOn: '2026-09-16', createdAt: '2026-09-16T04:00:00.000Z' }),
      expense({ id: 'yesterday-trip', scope: 'space', spaceId: 'hanoi', totalMinor: 8_000, ownerPaidMinor: 4_000, description: 'Train', category: 'Transport', occurredOn: '2026-09-15' }),
    ]
    const records = buildHomeRecords({
      ownerParticipantId: owner,
      expenses,
      funding: [],
      accounts: scenario === 'empty-accounts' ? [] : accounts,
      people: [{ id: 'person-lan', displayName: 'Lan', participantIds: ['lan'] }],
      spaces: [{
        id: 'hanoi',
        type: 'trip',
        name: 'Hanoi Days',
        status: 'active',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }],
      affiliations: [],
      journals: scenario === 'empty-accounts' ? [] : [{
        id: 'refund-1',
        kind: 'refund',
        occurredOn: '2026-09-16',
        createdAt: '2026-09-16T05:00:00.000Z',
        amountMinor: 2_000,
        currency: 'MYR',
        accountId: 'cimb',
        accountName: 'CIMB',
        expenseId: null,
        memo: 'Refund',
      }],
      selectedAccountId,
      limit: null,
      fundingKnown: scenario !== 'error',
    })
    return groupHomeRecords(presentHomeRecords(records, density), '2026-09-16')
  }, [density, scenario, selectedAccountId])
  const trip = scenario === 'travel-empty'
    ? null
    : selectHomeTrip(scenario === 'travel-ended'
      ? [{
        id: 'penang',
        type: 'trip',
        name: 'Penang',
        status: 'archived',
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        updatedAt: '2026-01-06T00:00:00.000Z',
      }]
      : [{
        id: 'hanoi',
        type: 'trip',
        name: 'Hanoi Days',
        status: 'active',
        startDate: '2026-09-01',
        endDate: '2026-09-20',
        updatedAt: '2026-09-01T00:00:00.000Z',
      }], '2026-09-16')

  return (
    <main className="ms-page home-shell">
      <HomeScreen
        mode={mode}
        onModeChange={() => undefined}
        density={density}
        onDensityChange={() => undefined}
        balanceHidden={hidden}
        onToggleBalanceHidden={() => undefined}
        selectedAccountId={selectedAccountId}
        onSelectAccount={() => undefined}
        monthlySpending={[{ currency: 'MYR', amountMinor: 8_640 }]}
        receivables={[{ currency: 'MYR', amountMinor: 2_400 }]}
        tileLayout={summaryTileLayout(accountTasks.length, sharedContexts.length)}
        accountTasks={accountTasks}
        sharedContexts={sharedContexts}
        sharedStatus="ready"
        recordGroups={scenario.startsWith('travel-empty') ? [] : model}
        onShowAllRecords={() => undefined}
        showingAllRecords={false}
        trip={trip}
        trips={trip ? [trip.trip] : []}
        travelStatus="ready"
        tripSpending={[{ currency: 'MYR', amountMinor: 8_000 }]}
        onSelectTrip={() => undefined}
        onCreateTrip={() => undefined}
        onOpenSharedContext={() => undefined}
        onCreateAccount={async () => undefined}
        accounts={scenario === 'empty-accounts' ? [] : accounts}
        accountsStatus={scenario === 'error' ? 'error' : 'ready'}
        balances={scenario === 'error' || scenario === 'empty-accounts' ? [] : availableMoney(accounts, selectedAccountId)}
      />
    </main>
  )
}

export default function HomeVisualHarness() {
  const [params] = useSearchParams()
  const setLang = useStore((state) => state.setLang)
  const requestedLang = params.get('lang')
  useEffect(() => {
    if (requestedLang === 'en' || requestedLang === 'zh') setLang(requestedLang)
  }, [requestedLang, setLang])
  const showActions = params.get('case') === 'expense-actions'
  const sample = expense({
    id: 'sheet-expense',
    scope: 'personal',
    totalMinor: 1_200,
    ownerPaidMinor: 1_200,
    description: 'Coffee',
  })
  return (
    <>
      {showActions ? (
        <div className="home-shell">
          <div className="home-record-action" data-testid="expense-action-host">
            <ExpenseActionSheet
              expense={sample}
              currentParticipantId={owner}
              onRefresh={async () => undefined}
              statusNotice="Could not refresh this expense. The actions below must stay readable."
            />
          </div>
        </div>
      ) : null}
      <HarnessBody />
      <BottomNavigation />
      <GlobalMoneyAction onAdd={() => undefined} />
    </>
  )
}
