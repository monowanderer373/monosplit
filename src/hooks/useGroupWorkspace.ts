import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useGroupSync } from './useGroupSync'
import { useStore } from '../store/useStore'
import { useT } from '../lib/i18n'
import { supabase, supabaseEnabled } from '../lib/supabase'
import {
  canEditExpenses,
  canEditGroup,
  canInviteMembers,
  canManageManualTravellers,
  canSettle,
  getGroupRole,
  getLinkedPerson,
} from '../lib/permissions'
import { buildDiagnosticsText, saveExpenseWithRecovery, shouldAutoClaim, shouldRegisterMembership } from '../lib/groupWorkspace'
import type { Group, GroupMembership, GroupRole } from '../types'

type InviteRole = 'full_access' | 'view'

export type GroupWorkspaceAccess = {
  role: GroupRole | null
  canEditTrip: boolean
  canInvite: boolean
  canManageTravellers: boolean
  canEditExpenseData: boolean
  canUseSettle: boolean
  hasAccess: boolean
  membershipByUserId: Record<string, GroupMembership>
  updateMembershipRole: (userId: string, role: InviteRole) => void
}

export type GroupWorkspaceSync = {
  status: ReturnType<typeof useGroupSync>['status']
  lastError: string | null
  ownerId: string | null
}

export type GroupWorkspaceIdentity = {
  linkedPerson: ReturnType<typeof getLinkedPerson>
  availableIdentityPeople: Group['people']
  claim: (personId: string) => void
  createNew: () => void
}

export type GroupWorkspaceInvite = {
  copyShareLink: (role: InviteRole) => Promise<void>
  busyRole: InviteRole | null
  linkCopied: boolean
}

export type GroupWorkspaceDiagnostics = {
  text: string
  show: boolean
  copy: () => Promise<void>
  copied: boolean
  repair: () => Promise<void>
  canRepair: boolean
  repairing: boolean
  notice: string
}

export type GroupWorkspace = {
  group: Group | undefined
  authUser: ReturnType<typeof useAuth>['authUser']
  authLoading: boolean
  access: GroupWorkspaceAccess
  sync: GroupWorkspaceSync
  identity: GroupWorkspaceIdentity
  invite: GroupWorkspaceInvite
  diagnostics: GroupWorkspaceDiagnostics
  saveExpenseWithRecovery: (nextGroup: Group) => Promise<{ ok: boolean; error: string | null }>
}

/**
 * Everything about "being in this group" that isn't the group's own data:
 * who the current user is, what they're allowed to do, whether this device
 * is synced, and the identity/invite/support-diagnostics actions that flow
 * from that. `GroupPage` owns tab state and modal-open state; this hook owns
 * the auth/sync/role tangle underneath it.
 *
 * Internal timing (auto-claim, auto-registering a membership row, the raw
 * `user_groups` read) is deliberately not exposed — callers only see the
 * settled `access`/`sync` results, not the effects that produced them.
 */
export function useGroupWorkspace(groupId: string | undefined): GroupWorkspace {
  const t = useT()
  const {
    authUser,
    loading: authLoading,
    claimGroup,
    memberships,
    createInviteLink,
    updateGroupMembershipRole,
    registerGroupMembership,
  } = useAuth()
  const { status: syncStatus, ownerId, setOwnerId, saveGroupNow, lastError } = useGroupSync(groupId, {
    authLoading,
    authUserId: authUser?.id,
  })

  const group = useStore((state) => state.groups.find((entry) => entry.id === groupId))
  const addPerson = useStore((state) => state.addPerson)
  const updatePersonProfile = useStore((state) => state.updatePersonProfile)

  const [claimStatus, setClaimStatus] = useState<'idle' | 'claiming' | 'claimed'>('idle')
  const [groupMemberships, setGroupMemberships] = useState<GroupMembership[]>([])
  const [inviteBusyRole, setInviteBusyRole] = useState<InviteRole | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false)
  const [repairBusy, setRepairBusy] = useState(false)
  const [repairNotice, setRepairNotice] = useState('')

  const canClaim = !!authUser && ownerId === null && claimStatus !== 'claimed'

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

  // Auto-claim: when a logged-in user opens an unclaimed group, silently claim it.
  useEffect(() => {
    if (!shouldAutoClaim({ authUserId: authUser?.id, groupId, claimStatus, syncStatus, ownerId })) return
    void handleClaim()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id, groupId, syncStatus, ownerId, claimStatus])

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

  const linkedPerson = useMemo(() => (group ? getLinkedPerson(group, authUser?.id) : null), [group, authUser?.id])
  const availableIdentityPeople = useMemo(
    () => group?.people.filter((person) => !person.authUserId) ?? [],
    [group?.people],
  )
  const membershipByUserId = useMemo(
    () => Object.fromEntries(groupMemberships.map((entry) => [entry.userId, entry])),
    [groupMemberships],
  )

  // Raw read of `user_groups` — out of GroupRepository's scope (that seam only
  // covers the `groups` blob, not membership rows; see ADR 0003).
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

  // Auto-register: the first time we resolve a non-owner role, make sure it's backed by a real row.
  useEffect(() => {
    if (!shouldRegisterMembership({
      authUserId: authUser?.id,
      groupId,
      hasGroup: !!group,
      role,
      isAlreadyMember: memberships.some((entry) => entry.groupId === groupId && entry.userId === authUser?.id),
    })) return
    void registerGroupMembership(groupId!, role!)
  }, [authUser, group, groupId, memberships, registerGroupMembership, role])

  const updateMembershipRole = (userId: string, nextRole: InviteRole) => {
    if (!group) return
    void updateGroupMembershipRole(group.id, userId, nextRole)
    setGroupMemberships((prev) => [...prev.filter((entry) => entry.userId !== userId), { groupId: group.id, userId, role: nextRole }])
  }

  const claim = (personId: string) => {
    if (!group || !authUser) return
    updatePersonProfile(group.id, personId, { authUserId: authUser.id })
  }

  const createNew = () => {
    if (!group || !groupId || !authUser) return
    const fallbackName = authUser.displayName ?? authUser.email?.split('@')[0] ?? 'Traveller'
    addPerson(groupId, fallbackName, authUser.id)
  }

  const copyShareLink = async (inviteRole: InviteRole) => {
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

  const diagnosticsText = useMemo(
    () => buildDiagnosticsText(t, {
      syncStatus,
      lastError,
      groupId,
      ownerId: ownerId ?? group?.ownerId ?? null,
      authUserId: authUser?.id,
      role,
      membershipRole: membership?.role ?? null,
      linkedPerson: linkedPerson ? { id: linkedPerson.id, name: linkedPerson.name } : null,
      canEditExpenseData,
    }),
    [authUser?.id, canEditExpenseData, group?.ownerId, groupId, lastError, linkedPerson, membership?.role, ownerId, role, syncStatus, t],
  )

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnosticsText)
      setDiagnosticsCopied(true)
      setTimeout(() => setDiagnosticsCopied(false), 2000)
    } catch {
      window.alert(diagnosticsText)
    }
  }

  const repairAccess = async () => {
    if (!groupId || !authUser) return
    setRepairBusy(true)
    setRepairNotice('')
    try {
      const nextRole = canEditExpenseData ? 'full_access' : 'view'
      await registerGroupMembership(groupId, nextRole)
      setRepairNotice(t('group.syncDebugRepairDone'))
    } catch {
      setRepairNotice(t('auth.errorGeneric'))
    } finally {
      setRepairBusy(false)
    }
  }

  return {
    group,
    authUser,
    authLoading,
    access: {
      role,
      canEditTrip,
      canInvite,
      canManageTravellers,
      canEditExpenseData,
      canUseSettle,
      hasAccess,
      membershipByUserId,
      updateMembershipRole,
    },
    sync: {
      status: syncStatus,
      lastError,
      ownerId: ownerId ?? group?.ownerId ?? null,
    },
    identity: {
      linkedPerson,
      availableIdentityPeople,
      claim,
      createNew,
    },
    invite: {
      copyShareLink,
      busyRole: inviteBusyRole,
      linkCopied,
    },
    diagnostics: {
      text: diagnosticsText,
      show: syncStatus === 'error' || !!lastError,
      copy: copyDiagnostics,
      copied: diagnosticsCopied,
      repair: repairAccess,
      canRepair: !!authUser && ownerId !== authUser.id,
      repairing: repairBusy,
      notice: repairNotice,
    },
    saveExpenseWithRecovery: (nextGroup: Group) =>
      saveExpenseWithRecovery(
        { save: saveGroupNow, registerMembership: registerGroupMembership },
        { group: nextGroup, ownerId, authUserId: authUser?.id },
      ),
  }
}
