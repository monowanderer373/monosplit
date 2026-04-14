import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import BottomTabs from '../components/BottomTabs'
import PeopleTab from '../components/PeopleTab'
import SettleTab from '../components/SettleTab'
import SummaryTab from '../components/SummaryTab'
import DashboardTab from '../components/DashboardTab'
import ExpenseSheet from '../components/ExpenseSheet'
import SettlePaySheet from '../components/SettlePaySheet'
import {
  canEditExpenses,
  canEditGroup,
  canInviteMembers,
  canManageManualTravellers,
  canSettle,
  getGroupRole,
} from '../lib/permissions'
import { useStore } from '../store/useStore'
import { formatDateRange } from '../lib/format'
import { useT } from '../lib/i18n'
import { supabase, supabaseEnabled } from '../lib/supabase'

import { useGroupSync } from '../hooks/useGroupSync'
import { useAuth } from '../hooks/useAuth'
import type { GroupMembership } from '../types'

type Tab = 'summary' | 'dashboard' | 'settle' | 'profile'

export default function GroupPage() {
  const t = useT()
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('summary')
  const [expenseComposerOpen, setExpenseComposerOpen] = useState(false)
  const [settlePayOpen, setSettlePayOpen] = useState(false)
  const [groupEditOpen, setGroupEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')

  const { status: syncStatus, ownerId, setOwnerId } = useGroupSync(groupId)
  const { authUser, loading: authLoading, claimGroup, memberships, createInviteLink, updateGroupMembershipRole, registerGroupMembership } = useAuth()
  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle')
  const [linkCopied, setLinkCopied] = useState(false)
  const [inviteBusyRole, setInviteBusyRole] = useState<'full_access' | 'view' | null>(null)

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
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([])

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
  const membership = useMemo(
    () => memberships.find((entry) => entry.groupId === groupId && entry.userId === authUser?.id) ?? null,
    [authUser?.id, groupId, memberships],
  )
  const role = getGroupRole({ ownerId: ownerId ?? group?.ownerId ?? null, authUserId: authUser?.id, membership })
  const canEditTrip = canEditGroup(role)
  const canInvite = canInviteMembers(role)
  const canManageTravellers = canManageManualTravellers(role)
  const canEditExpenseData = canEditExpenses(role)
  const canUseSettle = canSettle(role)
  const hasAccess = !!role || canClaim
  const linkedPerson = useMemo(
    () => authUser?.id ? group?.people.find((person) => person.authUserId === authUser.id) ?? null : null,
    [authUser?.id, group?.people],
  )
  const membershipByUserId = useMemo(
    () => Object.fromEntries(groupMemberships.map((entry) => [entry.userId, entry])),
    [groupMemberships],
  )

  useEffect(() => {
    if (!groupId || !role || !supabase || !supabaseEnabled) {
      setGroupMemberships([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data } = await supabase
          .from('user_groups')
          .select('user_id, role')
          .eq('group_id', groupId)
        if (cancelled) return
        setGroupMemberships(
          (data || []).map((entry: { user_id: string; role: string }) => ({
            groupId,
            userId: entry.user_id,
            role: entry.role === 'owner' || entry.role === 'full_access' || entry.role === 'view' ? entry.role : 'view',
          })),
        )
      } catch {
        if (!cancelled) setGroupMemberships([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [groupId, role])

  useEffect(() => {
    if (!authUser || !group || !groupId || !role) return
    if (linkedPerson) return

    const normalizedAuthName = (authUser.displayName ?? authUser.email?.split('@')[0] ?? '').trim().toLowerCase()
    const authTokens = normalizedAuthName.split(/\s+/).filter(Boolean)
    const manualMatch = group.people.find((person) => {
      if (person.authUserId) return false
      const normalizedPersonName = person.name.trim().toLowerCase()
      return (
        normalizedPersonName === normalizedAuthName ||
        normalizedAuthName.startsWith(normalizedPersonName) ||
        normalizedPersonName.startsWith(normalizedAuthName) ||
        authTokens.includes(normalizedPersonName)
      )
    })

    if (manualMatch) {
      updatePersonProfile(group.id, manualMatch.id, { authUserId: authUser.id })
      return
    }

    const fallbackName = authUser.displayName ?? authUser.email?.split('@')[0] ?? 'Traveller'
    addPerson(groupId, fallbackName, authUser.id)
  }, [addPerson, authUser, group, groupId, linkedPerson, role, updatePersonProfile])

  useEffect(() => {
    if (!authUser || !groupId || !group || !role) return
    const alreadyMember = memberships.some((entry) => entry.groupId === groupId && entry.userId === authUser.id)
    if (role === 'owner' || alreadyMember) return
    void registerGroupMembership(groupId, role)
  }, [authUser, group, groupId, memberships, registerGroupMembership, role])

  const openEditPanel = () => {
    if (!group) return
    setEditName(group.name)
    setEditStartDate(group.startDate || '')
    setEditEndDate(group.endDate || '')
    setGroupEditOpen(true)
  }

  const copyShareLink = async (inviteRole: 'full_access' | 'view') => {
    if (!groupId || !canInvite) return
    try {
      setInviteBusyRole(inviteRole)
      const invite = await createInviteLink(groupId, inviteRole)
      if (!invite) return
      const url = `${window.location.origin}/invite/${invite.token}`
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      window.alert(t('auth.errorGeneric'))
    } finally {
      setInviteBusyRole(null)
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
              {canInvite && (
                <>
                  <button className="ms-btn-ghost" onClick={() => copyShareLink('full_access')}>
                    {inviteBusyRole === 'full_access' ? t('group.syncing') : linkCopied ? t('group.copied') : t('group.inviteFullAccess')}
                  </button>
                  <button className="ms-btn-ghost" onClick={() => copyShareLink('view')}>
                    {inviteBusyRole === 'view' ? t('group.syncing') : linkCopied ? t('group.copied') : t('group.inviteView')}
                  </button>
                </>
              )}
              <button className="ms-btn-ghost" onClick={openEditPanel} disabled={!canEditTrip}>
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
                  {canInvite && (
                    <button className="ms-btn-ghost" onClick={() => copyShareLink('full_access')}>
                      {linkCopied ? t('group.copied') : t('group.share')}
                    </button>
                  )}
                  <button className="ms-btn-ghost" onClick={openEditPanel} disabled={!canEditTrip}>
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

          {!hasAccess ? (
            <section className="ms-card-soft">
              <p className="text-sm text-[#6b6058]">{t('group.noAccess')}</p>
            </section>
          ) : null}

          {activeTab === 'profile' && hasAccess ? (
            <PeopleTab
              group={group}
              authUserId={authUser?.id}
              role={role}
              membershipByUserId={membershipByUserId}
              onAddPerson={(name) => addPerson(group.id, name)}
              onUpdateMembershipRole={(userId, nextRole) => {
                void updateGroupMembershipRole(group.id, userId, nextRole)
                setGroupMemberships((prev) => {
                  const next = prev.filter((entry) => entry.userId !== userId)
                  return [...next, { groupId: group.id, userId, role: nextRole }]
                })
              }}
              onUpdatePersonProfile={(personId, updates) => updatePersonProfile(group.id, personId, updates)}
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
          ) : null}

          {activeTab === 'summary' && hasAccess ? (
            <SummaryTab
              group={group}
              canEdit={canEditExpenseData}
              onDeleteExpense={(expenseId) => canEditExpenseData && removeExpense(group.id, expenseId)}
              onEditExpense={(expenseId, updates) => canEditExpenseData && updateExpense(group.id, expenseId, updates)}
            />
          ) : null}

          {activeTab === 'dashboard' && hasAccess ? (
            <DashboardTab
              group={group}
              authUserId={authUser?.id}
              role={role}
              onUpdatePersonPaymentInfo={(personId, updates) => updatePersonPaymentInfo(group.id, personId, updates)}
              onAddComment={(personId, message) => addGroupComment(group.id, personId, message)}
            />
          ) : null}

          {activeTab === 'settle' && hasAccess ? (
            <SettleTab
              group={group}
              canSettle={canUseSettle}
              onMarkPairRepaid={(debtorId, creditorId, currency, repaidDate) =>
                canUseSettle && markSettlementPairRepaid(group.id, debtorId, creditorId, currency, repaidDate)
              }
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
        onSettlePayClick={() => canUseSettle && setSettlePayOpen(true)}
        fabHidden={settlePayOpen}
      />

      <SettlePaySheet
        isOpen={settlePayOpen}
        group={group}
        authUserId={authUser?.id}
        onClose={() => setSettlePayOpen(false)}
      />

      <ExpenseSheet
        group={group}
        isOpen={expenseComposerOpen && canEditExpenseData}
        onClose={() => setExpenseComposerOpen(false)}
        onSave={(expense) => {
          if (!canEditExpenseData) return
          addExpense(group.id, expense)
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
