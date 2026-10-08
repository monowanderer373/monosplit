import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import BottomNavigation from '../components/BottomNavigation'
import ExpenseActionSheet from '../components/ExpenseActionSheet'
import GlobalMoneyAction from '../components/GlobalMoneyAction'
import HomeScreen from '../components/home/HomeScreen'
import '../components/home/home.css'
import {
  availableMoney,
  localCalendarDate,
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
const today = localCalendarDate(new Date(), 'Asia/Kuala_Lumpur')
const yesterday = new Date(new Date(today + 'T12:00:00Z').getTime() - 86400000).toISOString().slice(0,10)
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
  const occurredOn = input.occurredOn ?? today
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
  const [density,setDensity] = useState<'compact'|'detailed'>(scenario === 'compact' ? 'compact' : 'detailed')
  const [mode,setMode] = useState<'daily'|'travel'>(scenario.startsWith('travel') ? 'travel' : 'daily')
  const [hidden,setHidden] = useState(scenario === 'hidden')
  const [selectedAccountId,setSelectedAccount] = useState(scenario === 'account' ? 'cimb' : 'all')
  const [fixtureAccounts,setAccounts] = useState<HomeAccount[]>(scenario === 'empty-accounts' ? [] : accounts.map(account => scenario === 'long' ? {...account,name:account.name+' Savings account with an unusually long name',entrySumMinor:12345678901} : account))
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
      expense({ id: 'today-personal', scope: 'personal', totalMinor: 1_200, ownerPaidMinor: 1_200, description: scenario === 'long' ? 'Coffee with a very long description that must remain readable when fonts are enlarged' : 'Morning coffee', category:'Coffee', occurredOn: today }),
      expense({ id: 'today-direct', scope: 'direct', totalMinor: 5_680, ownerPaidMinor: 5_680, description: '河粉', occurredOn: today, createdAt: `${today}T04:00:00.000Z` }),
      expense({ id: 'yesterday-trip', scope: 'space', spaceId: 'hanoi', totalMinor: 8_000, ownerPaidMinor: 4_000, description: 'Train', category: 'Transport', occurredOn: yesterday }),
    ]
    const records = buildHomeRecords({
      ownerParticipantId: owner,
      expenses,
      funding: [{expenseId:'today-personal',status:'posted',accountId:'cimb',accountAmountMinor:1200,accountCurrency:'MYR'}],
      accounts: fixtureAccounts,
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
        occurredOn: today,
        createdAt: `${today}T05:00:00.000Z`,
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
    return groupHomeRecords(presentHomeRecords(records, density), today)
  }, [density, scenario, selectedAccountId, fixtureAccounts])
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
      }], today)

  return (
    <main className="ms-page home-shell">
      <HomeScreen
        timezone="Asia/Kuala_Lumpur"
        initialAccountPanel={params.get('accountPanel') === 'manage' ? 'manage' : undefined}
        mode={mode}
        onModeChange={setMode}
        density={density}
        onDensityChange={setDensity}
        balanceHidden={hidden}
        onToggleBalanceHidden={() => setHidden(value => !value)}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccount}
        monthlySpending={[{ currency: 'MYR', amountMinor: 8_640 }]}
        receivables={[{ currency: 'MYR', amountMinor: 2_400 }]}
        tileLayout={summaryTileLayout(accountTasks.length, sharedContexts.length)}
        accountTasks={accountTasks}
        sharedContexts={sharedContexts}
        sharedPreviews={scenario === 'none' || scenario === 'empty-accounts' ? [] : [{
          id:'fixture-preview',source:'friend',label:'Lan',personId:'person-lan',spaceId:null,status:'pending',description:'Dinner with friends',
          lines: scenario === 'zero-pending' ? [] : [{currency:'MYR',direction:'receivable',amountMinor:scenario === 'negative-pending' ? -2500 : 2500}],
        }]}
        sharedStatus={scenario === 'error' ? 'error' : 'ready'}
        recordGroups={scenario.startsWith('travel-empty') ? [] : model}
        trip={trip}
        trips={trip ? [trip.trip] : []}
        travelStatus="ready"
        tripSpending={[{ currency: 'MYR', amountMinor: 8_000 }]}
        onSelectTrip={() => undefined}
        onCreateTrip={() => undefined}
        onOpenSharedContext={() => undefined}
        onCreateAccount={async input => {setAccounts(current => [...current, {
          id:'fixture-created-'+current.length, name:input.name,accountClass:'asset',accountType:input.accountType,currency:input.currency,
          archived:false,openingStatus:input.openingBalanceMinor == null ? 'unknown' : 'posted',entrySumMinor:input.openingBalanceMinor ?? 0,
        }])}}
        accounts={fixtureAccounts}
        accountsStatus={scenario === 'error' ? 'error' : 'ready'}
        balances={scenario === 'error' || scenario === 'empty-accounts' ? [] : availableMoney(fixtureAccounts, selectedAccountId)}
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
  const viewport = Number(params.get('viewport'))
  if ([320,360,390,430].includes(viewport)) {
    const query = new URLSearchParams(params); query.delete('viewport')
    return <iframe title={`Tabby Tally at ${viewport}px`} src={`/__home-visual?${query}`} style={{display:'block',width:viewport,height:844,maxWidth:'100%',border:0,margin:'0 auto'}} />
  }
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
