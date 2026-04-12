import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BottomTabs from '../components/BottomTabs'
import PeopleTab from '../components/PeopleTab'
import SettleTab from '../components/SettleTab'
import SummaryTab from '../components/SummaryTab'
import DashboardTab from '../components/DashboardTab'
import ExpenseSheet from '../components/ExpenseSheet'
import { useStore } from '../store/useStore'
import { formatDateRange } from '../lib/format'
import { useT } from '../lib/i18n'

import { useGroupSync } from '../hooks/useGroupSync'
import { useAuth } from '../hooks/useAuth'

type Tab = 'summary' | 'dashboard' | 'settle' | 'profile'

export default function GroupPage() {
  const t = useT()
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [expenseComposerOpen, setExpenseComposerOpen] = useState(false)
  const [groupEditOpen, setGroupEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false)

  const { status: syncStatus, ownerId, setOwnerId } = useGroupSync(groupId)
  const { authUser, claimGroup } = useAuth()
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle')
  const [linkCopied, setLinkCopied] = useState(false)

  const isOwned = ownerId === authUser?.id
  const isUnclaimed = ownerId === null
  const canClaim = !!authUser && isUnclaimed && claimStatus !== 'claimed'

  const handleClaim = async () => {
    if (!groupId || !authUser) return
    setClaimStatus('claiming')
    try {
      await claimGroup(groupId)
      setOwnerId(authUser.id)
      setClaimStatus('claimed')
    } catch {
      setClaimStatus('idle')
    }
  }

  const group = useStore((state) => state.groups.find((entry) => entry.id === groupId))

  // Auto-claim: when a logged-in user opens an unclaimed group, silently claim it
  useEffect(() => {
    if (!authUser || !groupId) return
    if (claimStatus !== 'idle') return
    if (syncStatus !== 'synced' && syncStatus !== 'error') return
    if (ownerId !== null) return
    void handleClaim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, groupId, syncStatus, ownerId, claimStatus])
  const addPerson = useStore((state) => state.addPerson)

  // Auto-join: when arriving via invite link (?autoJoin=true) and logged in, add user as person
  useEffect(() => {
    if (searchParams.get('autoJoin') !== 'true') return
    if (!authUser || !group || !groupId) return
    const alreadyMember = group.people.some((p) => p.authUserId === authUser.id)
    if (!alreadyMember) {
      const name = authUser.displayName ?? authUser.email ?? 'Traveller'
      addPerson(groupId, name, authUser.id)
    }
    // Clean up the query param without re-rendering
    navigate(`/group/${groupId}`, { replace: true })
  }, [searchParams, authUser, group, groupId, addPerson, navigate])
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
      window.prompt(t('group.copyPrompt'), url)
    }
  }

  const copyInviteLink = async () => {
    const url = `${window.location.origin}/invite/${groupId}`
    try {
      await navigator.clipboard.writeText(url)
      setInviteLinkCopied(true)
      setTimeout(() => setInviteLinkCopied(false), 2000)
    } catch {
      window.prompt(t('group.copyPrompt'), url)
    }
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
      <div className="hidden lg:mb-5 lg:block">
        <section className="ms-card-soft mb-4">
          <div className="flex items-start justify-between gap-3">
            <button className="ms-btn-ghost" onClick={() => navigate('/')}>
              {t('group.back')}
            </button>
            <div className="flex items-center gap-2">
              <button className="ms-btn-ghost" onClick={copyShareLink}>
                {linkCopied ? t('group.copied') : t('group.shareLink')}
              </button>
              <button className="ms-btn-ghost" onClick={copyInviteLink} title={t('auth.inviteLink')}>
                {inviteLinkCopied ? t('group.copied') : t('auth.invite')}
              </button>
              <button className="ms-btn-ghost" onClick={openEditPanel}>
                {t('group.edit')}
              </button>
            </div>
          </div>
          <h1 className="mt-3 text-4xl font-bold text-[#2c2520]">{group.name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-base text-[#6b6058]">{formatDateRange(group.startDate, group.endDate)}</p>
            {syncStatus === 'synced' && <span className="text-xs text-[#5a7a5a]">{t('group.synced')}</span>}
            {syncStatus === 'loading' && <span className="text-xs text-[#9a9088]">{t('group.syncing')}</span>}
            {syncStatus === 'offline' && <span className="text-xs text-[#9a9088]">{t('group.localOnly')}</span>}
            {syncStatus === 'error' && <span className="text-xs text-[#9e4a4a]">{t('group.syncError')}</span>}
          </div>
          <p className="mt-1 text-base text-[#6b6058]">
            {group.people.length} {t('groups.people')} · {totalExpenses} {t('groups.expenses')}
          </p>
        </section>
      </div>


      <div className="min-w-0">
          {activeTab === 'summary' ? (
            <header className="ms-card-soft mb-4 lg:hidden">
              <div className="mb-2 flex items-start justify-between gap-3">
                <button className="ms-btn-ghost" onClick={() => navigate('/')}>
                  {t('group.back')}
                </button>
                <div className="flex items-center gap-2">
                  <button className="ms-btn-ghost" onClick={copyShareLink}>
                    {linkCopied ? t('group.copied') : t('group.share')}
                  </button>
                  <button className="ms-btn-ghost" onClick={copyInviteLink}>
                    {inviteLinkCopied ? t('group.copied') : t('auth.invite')}
                  </button>
                  <button className="ms-btn-ghost" onClick={openEditPanel}>
                    {t('group.edit')}
                  </button>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-[#2c2520]">{group.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-xs text-[#6b6058]">{formatDateRange(group.startDate, group.endDate)}</p>
                {syncStatus === 'synced' && <span className="text-xs text-[#5a7a5a]">{t('group.synced')}</span>}
                {syncStatus === 'loading' && <span className="text-xs text-[#9a9088]">{t('group.syncing')}</span>}
                {syncStatus === 'offline' && <span className="text-xs text-[#9a9088]">{t('group.local')}</span>}
              </div>
              <p className="mt-1 text-sm text-[#6b6058]">
                {group.people.length} {t('groups.people')} · {totalExpenses} {t('groups.expenses')}
              </p>
            </header>
          ) : null}

          {activeTab === 'profile' ? (
            <PeopleTab
              group={group}
              authUserId={authUser?.id}
              onAddPerson={(name) => addPerson(group.id, name)}
              onUpdatePersonProfile={(personId, updates) => updatePersonProfile(group.id, personId, updates)}
              onRemovePerson={(personId) => {
                const used = group.expenses.some(
                  (expense) => expense.payerIds?.includes(personId) || expense.splits.some((split) => split.personId === personId),
                )
                if (used) {
                  window.alert(t('people.usedInExpenses'))
                  return
                }
                const ok = window.confirm(t('people.removeConfirm'))
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

      {(canClaim || isOwned || claimStatus === 'claimed') && (
        <div className={`mx-auto mb-4 max-w-3xl border p-3 text-sm ${
          isOwned || claimStatus === 'claimed'
            ? 'border-[var(--ms-success)] bg-[var(--ms-success-bg)] text-[var(--ms-success)]'
            : 'border-[var(--ms-accent-light)] bg-[var(--ms-accent-bg)] text-[var(--ms-text-secondary)]'
        }`}>
          {isOwned || claimStatus === 'claimed' ? (
            <span>● {t('auth.groupClaimed')}</span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs">{t('auth.claimGroupHint')}</span>
              <button
                className="ms-btn-primary shrink-0 text-xs"
                disabled={claimStatus === 'claiming'}
                onClick={handleClaim}
              >
                {claimStatus === 'claiming' ? t('auth.claiming') : t('auth.claimGroup')}
              </button>
            </div>
          )}
        </div>
      )}

      {!authUser && (
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
        onAddExpenseClick={() => setExpenseComposerOpen(true)}
      />

      <ExpenseSheet
        group={group}
        isOpen={expenseComposerOpen}
        onClose={() => setExpenseComposerOpen(false)}
        onSave={(expense) => {
          addExpense(group.id, expense)
          setExpenseComposerOpen(false)
        }}
      />

      {groupEditOpen ? (
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
