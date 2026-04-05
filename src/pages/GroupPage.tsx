import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomTabs from '../components/BottomTabs'
import PeopleTab from '../components/PeopleTab'
import SettleTab from '../components/SettleTab'
import SummaryTab from '../components/SummaryTab'
import DashboardTab from '../components/DashboardTab'
import ExpenseForm from '../components/ExpenseForm'
import { useStore } from '../store/useStore'
import { formatDateRange } from '../lib/format'
import { spawnRipple } from '../lib/ripple'
import { useGroupSync } from '../hooks/useGroupSync'

type Tab = 'summary' | 'dashboard' | 'settle' | 'profile'

export default function GroupPage() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [expenseComposerOpen, setExpenseComposerOpen] = useState(false)
  const [groupEditOpen, setGroupEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const { status: syncStatus } = useGroupSync(groupId)
  const [linkCopied, setLinkCopied] = useState(false)

  const group = useStore((state) => state.groups.find((entry) => entry.id === groupId))
  const addPerson = useStore((state) => state.addPerson)
  const updatePersonProfile = useStore((state) => state.updatePersonProfile)
  const removePerson = useStore((state) => state.removePerson)
  const updatePersonPaymentInfo = useStore((state) => state.updatePersonPaymentInfo)
  const updateGroup = useStore((state) => state.updateGroup)
  const addExpense = useStore((state) => state.addExpense)
  const updateExpense = useStore((state) => state.updateExpense)
  const removeExpense = useStore((state) => state.removeExpense)
  const markSettlementPairRepaid = useStore((state) => state.markSettlementPairRepaid)
  const addGroupComment = useStore((state) => state.addGroupComment)

  const totalExpenses = useMemo(() => group?.expenses.length ?? 0, [group?.expenses.length])
  const desktopTabs: Array<{ id: Tab; label: string }> = [
    { id: 'summary', label: 'Summary' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'settle', label: 'Settle-up' },
    { id: 'profile', label: 'Profile' },
  ]

  const openEditPanel = () => {
    if (!group) return
    setEditName(group.name)
    setEditStartDate(group.startDate || '')
    setEditEndDate(group.endDate || '')
    setGroupEditOpen(true)
  }

  const copyShareLink = async () => {
    const url = `${window.location.origin}/group/${groupId}`
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      window.prompt('Copy this link to share:', url)
    }
  }

  if (!group) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <div className="ms-card-soft w-full p-6 text-center">
          <p className="text-sm text-[#6b6058]">Group not found.</p>
          <button className="ms-btn-primary mt-3" onClick={() => navigate('/')}>
            Back to groups
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="ms-page">
      <div className="hidden lg:mb-5 lg:block">
        <section className="ms-card-soft mb-4">
          <div className="flex items-start justify-between gap-3">
            <button className="ms-btn-ghost" onClick={() => navigate('/')}>
              Back
            </button>
            <div className="flex items-center gap-2">
              <button className="ms-btn-ghost" onClick={copyShareLink}>
                {linkCopied ? 'Copied!' : 'Share Link'}
              </button>
              <button className="ms-btn-ghost" onClick={openEditPanel}>
                Edit
              </button>
            </div>
          </div>
          <h1 className="mt-3 text-4xl font-bold text-[#2c2520]">{group.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-base text-[#6b6058]">{formatDateRange(group.startDate, group.endDate)}</p>
            {syncStatus === 'synced' && <span className="text-xs text-[#5a7a5a]">Synced</span>}
            {syncStatus === 'loading' && <span className="text-xs text-[#9a9088]">Syncing...</span>}
            {syncStatus === 'offline' && <span className="text-xs text-[#9a9088]">Local only</span>}
            {syncStatus === 'error' && <span className="text-xs text-[#9e4a4a]">Sync error</span>}
          </div>
          <p className="mt-1 text-base text-[#6b6058]">
            {group.people.length} people · {totalExpenses} expenses
          </p>
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 hidden px-4 pb-3 lg:block">
        <div className="ms-sketch-bar mx-auto max-w-4xl bg-[var(--ms-bg)] px-3">
          <div className="flex h-[82px] items-center justify-center gap-2">
            {desktopTabs.slice(0, 2).map((tab) => (
              <button
                key={tab.id}
                className={`ms-key h-[52px] flex-1 text-[1rem] font-semibold leading-none tracking-[0.01em] ${
                  activeTab === tab.id ? 'ms-key-active text-[var(--ms-accent-hover)]' : 'text-[var(--ms-text-muted)]'
                }`}
                onPointerDown={(e) => {
                  spawnRipple(e)
                  setActiveTab(tab.id)
                }}
              >
                {tab.label}
              </button>
            ))}

            <button
              className="ms-key ms-key-round h-[60px] w-[60px] shrink-0"
              aria-label="Add expense"
              onPointerDown={(e) => {
                spawnRipple(e)
                setExpenseComposerOpen(true)
              }}
            >
              <span className="-translate-y-[1px] text-[2rem] font-light leading-none text-[var(--ms-text)]">+</span>
            </button>

            {desktopTabs.slice(2).map((tab) => (
              <button
                key={tab.id}
                className={`ms-key h-[52px] flex-1 text-[1rem] font-semibold leading-none tracking-[0.01em] ${
                  activeTab === tab.id ? 'ms-key-active text-[var(--ms-accent-hover)]' : 'text-[var(--ms-text-muted)]'
                }`}
                onPointerDown={(e) => {
                  spawnRipple(e)
                  setActiveTab(tab.id)
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-w-0">
          {activeTab === 'summary' ? (
            <header className="ms-card-soft mb-4 lg:hidden">
              <div className="mb-2 flex items-start justify-between gap-3">
                <button className="ms-btn-ghost" onClick={() => navigate('/')}>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <button className="ms-btn-ghost" onClick={copyShareLink}>
                    {linkCopied ? 'Copied!' : 'Share'}
                  </button>
                  <button className="ms-btn-ghost" onClick={openEditPanel}>
                    Edit
                  </button>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-[#2c2520]">{group.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-[#6b6058]">{formatDateRange(group.startDate, group.endDate)}</p>
                {syncStatus === 'synced' && <span className="text-xs text-[#5a7a5a]">Synced</span>}
                {syncStatus === 'loading' && <span className="text-xs text-[#9a9088]">Syncing...</span>}
                {syncStatus === 'offline' && <span className="text-xs text-[#9a9088]">Local</span>}
              </div>
              <p className="mt-1 text-sm text-[#6b6058]">
                {group.people.length} people · {totalExpenses} expenses
              </p>
            </header>
          ) : null}

          {activeTab === 'profile' ? (
            <PeopleTab
              group={group}
              onAddPerson={(name) => addPerson(group.id, name)}
              onUpdatePersonProfile={(personId, updates) => updatePersonProfile(group.id, personId, updates)}
              onRemovePerson={(personId) => {
                const used = group.expenses.some(
                  (expense) => expense.payerIds?.includes(personId) || expense.splits.some((split) => split.personId === personId),
                )
                if (used) {
                  window.alert('This traveller is used in expenses. Remove related expenses first.')
                  return
                }
                const ok = window.confirm('Remove traveller?')
                if (ok) removePerson(group.id, personId)
              }}
              onUpdateGroupCurrency={(paid, repay) =>
                updateGroup(group.id, { defaultPaidCurrency: paid, defaultRepayCurrency: repay })
              }
            />
          ) : null}

          {activeTab === 'summary' ? (
            <SummaryTab
              group={group}
              onDeleteExpense={(expenseId) => removeExpense(group.id, expenseId)}
              onEditExpense={(expenseId, updates) => updateExpense(group.id, expenseId, updates)}
            />
          ) : null}

          {activeTab === 'dashboard' ? (
            <DashboardTab
              group={group}
              onUpdatePersonPaymentInfo={(personId, updates) => updatePersonPaymentInfo(group.id, personId, updates)}
              onAddComment={(personId, message) => addGroupComment(group.id, personId, message)}
            />
          ) : null}

          {activeTab === 'settle' ? (
            <SettleTab
              group={group}
              onMarkPairRepaid={(debtorId, creditorId, currency, repaidDate) =>
                markSettlementPairRepaid(group.id, debtorId, creditorId, currency, repaidDate)
              }
            />
          ) : null}
      </div>

      <BottomTabs
        active={activeTab}
        onChange={setActiveTab}
        onAddExpenseClick={() => setExpenseComposerOpen(true)}
      />

      {expenseComposerOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-2 lg:max-w-3xl">
            <ExpenseForm
              group={group}
              showModeBadge={false}
              onSave={(expense) => {
                addExpense(group.id, expense)
                setExpenseComposerOpen(false)
              }}
              onCancel={() => setExpenseComposerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      {groupEditOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 lg:max-w-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ms-title">Edit Trip</h2>
              <button className="ms-btn-ghost" onClick={() => setGroupEditOpen(false)}>
                Close
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#6b6058]">
                Trip name
                <input
                  className="ms-input mt-1 w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">Monthly calendar range</p>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3 sm:grid-cols-2">
                <label className="text-xs text-[#6b6058]">
                  Start date
                  <input
                    type="date"
                    className="ms-input mt-1 w-full"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </label>
                <label className="text-xs text-[#6b6058]">
                  End date
                  <input
                    type="date"
                    className="ms-input mt-1 w-full"
                    value={editEndDate}
                    min={editStartDate || undefined}
                    onChange={(e) => setEditEndDate(e.target.value)}
                  />
                </label>
              </div>

              <button
                className="ms-btn-primary w-full"
                onClick={() => {
                  const cleanName = editName.trim()
                  if (!cleanName) return
                  updateGroup(group.id, {
                    name: cleanName,
                    startDate: editStartDate || null,
                    endDate: editEndDate || null,
                  })
                  setGroupEditOpen(false)
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
