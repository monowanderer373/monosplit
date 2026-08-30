import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomTabs from '../components/BottomTabs'
import PeopleTab from '../components/PeopleTab'
import SettleTab from '../components/SettleTab'
import SummaryTab from '../components/SummaryTab'
import ExpenseSheet from '../components/ExpenseSheet'
import SettlePaySheet, { type SettlePayPrefill } from '../components/SettlePaySheet'
import { useStore } from '../store/useStore'
import { formatDateRange } from '../lib/format'
import { useT } from '../lib/i18n'

import { useGroupWorkspace } from '../hooks/useGroupWorkspace'

type Tab = 'summary' | 'settle' | 'profile'

export default function GroupPage() {
  const t = useT()
  const { groupId } = useParams()
  const navigate = useNavigate()
  /**
   * Settle Up is what people actually open a trip for, so it is the landing tab
   * — except on a trip with nothing in it yet, where the answer is always "you
   * owe nothing" and the ledger's empty state is the more useful thing to see.
   * Decided once on mount so adding a first expense does not teleport the user.
   */
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const existing = useStore.getState().groups.find((entry) => entry.id === groupId)
    return (existing?.expenses.length ?? 0) > 0 ? 'settle' : 'summary'
  })
  const [expenseComposerOpen, setExpenseComposerOpen] = useState(false)
  const [settlePayOpen, setSettlePayOpen] = useState(false)
  const [settlePayPrefill, setSettlePayPrefill] = useState<SettlePayPrefill | null>(null)
  const [groupEditOpen, setGroupEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const workspace = useGroupWorkspace(groupId)
  const { group, authUser, authLoading, access, sync, identity, invite, diagnostics } = workspace
  const { role, canEditTrip, canInvite, canManageTravellers, canEditExpenseData, canUseSettle, hasAccess, membershipByUserId } = access

  const addPerson = useStore((state) => state.addPerson)
  const updatePersonProfile = useStore((state) => state.updatePersonProfile)
  const removePerson = useStore((state) => state.removePerson)
  const updatePersonPaymentInfo = useStore((state) => state.updatePersonPaymentInfo)
  const updateGroup = useStore((state) => state.updateGroup)
  const addExpense = useStore((state) => state.addExpense)
  const updateExpense = useStore((state) => state.updateExpense)
  const removeExpense = useStore((state) => state.removeExpense)

  const totalExpenses = useMemo(() => group?.expenses.length ?? 0, [group?.expenses.length])

  const openSettlePay = (prefill: SettlePayPrefill | null) => {
    if (!canUseSettle) return
    setSettlePayPrefill(prefill)
    setSettlePayOpen(true)
  }

  const openEditPanel = () => {
    if (!group) return
    setEditName(group.name)
    setEditStartDate(group.startDate || '')
    setEditEndDate(group.endDate || '')
    setGroupEditOpen(true)
  }

  if (authLoading || sync.status === 'loading') {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <div className="ms-card-soft w-full p-6 text-center">
          <p className="text-sm text-[#6b6058]">{t('group.syncing')}</p>
        </div>
      </main>
    )
  }

  if (!group) {
    return (
      <main className="ms-page flex min-h-dvh items-center justify-center">
        <div className="ms-card-soft w-full p-6 text-center">
          <p className="text-sm text-[#6b6058]">{t('group.notFound')}</p>
          <button className="ms-btn-primary mt-3" onClick={() => navigate('/')}>
            {t('group.backToGroups')}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="ms-page">
      <div className="min-w-0">
          {diagnostics.show && hasAccess ? (
            <section className="ms-card-soft mb-4 border-[#c49898] bg-[rgba(158,74,74,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="ms-title text-[#7b3d3d]">{t('group.syncDebugTitle')}</h2>
                  <p className="mt-1 text-sm text-[#6b6058]">{t('group.syncDebugHelp')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="ms-btn-ghost text-xs" onClick={diagnostics.copy}>
                    {diagnostics.copied ? t('group.syncDebugCopied') : t('group.syncDebugCopy')}
                  </button>
                  {diagnostics.canRepair ? (
                    <button className="ms-btn-ghost text-xs" onClick={diagnostics.repair} disabled={diagnostics.repairing}>
                      {diagnostics.repairing ? t('group.syncDebugRepairing') : t('group.syncDebugRepair')}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[#4f463f]">
                <p className="whitespace-pre-line">{diagnostics.text}</p>
              </div>
              {diagnostics.notice ? (
                <p className="mt-3 text-sm text-[#7b3d3d]">{diagnostics.notice}</p>
              ) : null}
            </section>
          ) : null}

          {!hasAccess ? (
            <section className="ms-card-soft">
              <p className="text-sm text-[#6b6058]">{t('group.noAccess')}</p>
            </section>
          ) : null}

          {activeTab === 'profile' && hasAccess ? (
            <>
              <header className="ms-card-soft mb-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <button className="ms-btn-ghost" onClick={() => navigate('/')}>
                    {t('group.back')}
                  </button>
                  <div className="flex items-center gap-2">
                    {canInvite && (
                      <>
                        <button className="ms-btn-ghost" onClick={() => invite.copyShareLink('full_access')}>
                          {invite.busyRole === 'full_access' ? t('group.syncing') : invite.linkCopied ? t('group.copied') : t('group.share')}
                        </button>
                        <button className="ms-btn-ghost hidden lg:inline-flex" onClick={() => invite.copyShareLink('view')}>
                          {invite.busyRole === 'view' ? t('group.syncing') : invite.linkCopied ? t('group.copied') : t('group.inviteView')}
                        </button>
                      </>
                    )}
                    <button className="ms-btn-ghost" onClick={openEditPanel} disabled={!canEditTrip}>
                      {t('group.edit')}
                    </button>
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-[var(--ms-text)] lg:text-4xl">{group.name}</h1>
                <div className="mt-1 flex items-center gap-2 lg:mt-2 lg:gap-3">
                  <p className="text-xs text-[var(--ms-text-muted)] lg:text-base">{formatDateRange(group.startDate, group.endDate)}</p>
                  {sync.status === 'synced' && <span className="text-xs text-[var(--ms-success)]">{t('group.synced')}</span>}
                  {sync.status === 'offline' && <span className="text-xs text-[var(--ms-text-muted)]">{t('group.local')}</span>}
                  {sync.status === 'error' && <span className="text-xs text-[var(--ms-danger)]">{t('group.syncError')}</span>}
                </div>
                <p className="mt-1 text-sm text-[var(--ms-text-muted)] lg:text-base">
                  {group.people.length} {t('groups.people')} · {totalExpenses} {t('groups.expenses')}
                </p>
              </header>

              {!identity.myPerson ? (
                <section className="ms-card-soft mb-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="ms-label">{t('group.identityTitle')}</p>
                      <h2 className="mt-2 text-2xl font-extrabold text-[var(--ms-text)]">{t('group.identityQuestion')}</h2>
                      <p className="mt-1 max-w-xl text-sm text-[var(--ms-text-secondary)]">
                        {authUser ? t('group.identityHelp') : t('group.identityGuestHelp')}
                      </p>
                    </div>
                    <button className="ms-btn-primary shrink-0" onClick={identity.createNew}>
                      {authUser ? t('group.identityCreateMe') : t('group.identityCreateMeGuest')}
                    </button>
                  </div>

                  {identity.availableIdentityPeople.length > 0 ? (
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {identity.availableIdentityPeople.map((person) => (
                        <button
                          key={person.id}
                          className="flex items-center gap-3 rounded-3xl border border-[var(--ms-border)] bg-[var(--ms-surface)] p-3 text-left transition hover:bg-[var(--ms-surface-dim)]"
                          onClick={() => identity.claim(person.id)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--ms-accent-bg)] text-sm font-black text-[var(--ms-accent)]">
                            {person.avatarDataUrl ? (
                              <img src={person.avatarDataUrl} alt={person.name} className="h-full w-full object-cover" />
                            ) : (
                              person.name.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--ms-text)]">{person.name}</p>
                            <p className="text-xs text-[var(--ms-text-muted)]">{t('group.identityChooseThis')}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <PeopleTab
              group={group}
              authUserId={authUser?.id}
              myPersonId={identity.myPersonId}
              role={role}
              membershipByUserId={membershipByUserId}
              onAddPerson={(name) => addPerson(group.id, name)}
              onUpdateMembershipRole={access.updateMembershipRole}
              onUpdatePersonProfile={(personId, updates) => updatePersonProfile(group.id, personId, updates)}
              onUpdatePersonPaymentInfo={(personId, updates) => updatePersonPaymentInfo(group.id, personId, updates)}
              onRemovePerson={(personId) => {
                if (!canManageTravellers) return
                const used = group.expenses.some(
                  (expense) => expense.payerIds?.includes(personId) || expense.splits.some((split) => split.personId === personId),
                )
                const confirmMsg = used
                  ? t('people.removeConfirmWithExpenses')
                  : t('people.removeConfirm')
                const ok = window.confirm(confirmMsg)
                if (ok) removePerson(group.id, personId)
              }}
              onUpdateGroupCurrency={(paid, repay) =>
                canEditTrip && updateGroup(group.id, { defaultPaidCurrency: paid, defaultRepayCurrency: repay })
              }
            />
            </>
          ) : null}

          {activeTab === 'summary' && hasAccess ? (
            <SummaryTab
              group={group}
              canEdit={canEditExpenseData}
              myPersonId={identity.myPersonId}
              onDeleteExpense={(expenseId) => canEditExpenseData && removeExpense(group.id, expenseId)}
              onEditExpense={(expenseId, updates) => canEditExpenseData && updateExpense(group.id, expenseId, updates)}
            />
          ) : null}

          {activeTab === 'settle' && hasAccess ? (
            <SettleTab
              key={group.id}
              group={group}
              canSettle={canUseSettle}
              authUserId={authUser?.id}
              myPersonId={identity.myPersonId}
              onRecordPayment={openSettlePay}
            />
          ) : null}
      </div>

      {!authLoading && !authUser && (
        <div className="mx-auto mb-4 max-w-3xl border border-[var(--ms-border)] bg-[var(--ms-surface-dim)] p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--ms-text-secondary)]">{t('auth.signInToSave')}</span>
            <button
              className="ms-btn-ghost shrink-0 text-xs"
              onClick={() => navigate('/login')}
            >
              {t('auth.signIn')}
            </button>
          </div>
        </div>
      )}

      <BottomTabs
        active={activeTab}
        onChange={setActiveTab}
        onAddExpenseClick={() => canEditExpenseData && setExpenseComposerOpen(true)}
      />

      <SettlePaySheet
        isOpen={settlePayOpen}
        group={group}
        authUserId={authUser?.id}
        myPersonId={identity.myPersonId}
        prefill={settlePayPrefill}
        onClose={() => {
          setSettlePayOpen(false)
          setSettlePayPrefill(null)
        }}
      />

      <ExpenseSheet
        group={group}
        isOpen={expenseComposerOpen && canEditExpenseData}
        onClose={() => setExpenseComposerOpen(false)}
        onSave={async (expense) => {
          if (!canEditExpenseData) return
          const createdExpense = addExpense(group.id, expense)
          if (!createdExpense) return
          const nextGroup = {
            ...group,
            expenses: [...group.expenses, createdExpense],
          }
          const saveResult = await workspace.saveExpenseWithRecovery(nextGroup)

          if (!saveResult.ok) {
            removeExpense(group.id, createdExpense.id)
            window.alert(saveResult.error ?? t('group.syncError'))
            return
          }
          setExpenseComposerOpen(false)
        }}
      />

      {groupEditOpen && canEditTrip ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#2c2520]/45 p-2 lg:items-center">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 lg:max-w-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="ms-title">{t('group.editTrip')}</h2>
              <button className="ms-btn-ghost" onClick={() => setGroupEditOpen(false)}>
                {t('group.close')}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-sm text-[#6b6058]">
                {t('group.tripName')}
                <input
                  className="ms-input mt-1 w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>

              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6058]">{t('group.calendarRange')}</p>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-[#e6e0d5] bg-[#f0ece3] p-3 sm:grid-cols-2">
                <label className="text-xs text-[#6b6058]">
                  {t('groups.startDate')}
                  <input
                    type="date"
                    className="ms-input mt-1 w-full"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </label>
                <label className="text-xs text-[#6b6058]">
                  {t('groups.endDate')}
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
                {t('group.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
