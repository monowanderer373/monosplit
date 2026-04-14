import { useState, useEffect, useCallback, useContext, createContext } from 'react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useStore } from '../store/useStore'
import type { Group, GroupInviteLink, GroupMembership, GroupRole, UserProfile } from '../types'

function buildProfile(
  user: User,
  row?: { display_name?: string | null; avatar_url?: string | null } | null,
): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName:
      row?.display_name ??
      user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      null,
    avatarUrl: row?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    lang: 'en',
    themeId: 'solid-vintage',
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type AuthContextValue = {
  authUser: UserProfile | null
  loading: boolean
  memberships: GroupMembership[]
  signUp: (email: string, password: string, displayName: string, emailRedirectTo?: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signInWithGoogle: (afterLoginPath?: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { displayName?: string }) => Promise<void>
  claimGroup: (groupId: string) => Promise<void>
  releaseGroup: (groupId: string) => Promise<void>
  transferGroupOwnership: (groupId: string, nextOwnerUserId: string) => Promise<void>
  registerGroupMembership: (groupId: string, role?: GroupRole) => Promise<void>
  updateGroupMembershipRole: (groupId: string, userId: string, role: Exclude<GroupRole, 'owner'>) => Promise<void>
  removeGroupMembership: (groupId: string, userId: string) => Promise<void>
  createInviteLink: (groupId: string, role: Exclude<GroupRole, 'owner'>) => Promise<GroupInviteLink | null>
  getInviteLink: (token: string) => Promise<GroupInviteLink | null>
  acceptInviteLink: (token: string) => Promise<GroupMembership | null>
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider (single instance for the whole app) ─────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [memberships, setMemberships] = useState<GroupMembership[]>([])
  const upsertGroup = useStore((s) => s.upsertGroup)

  // Set auth user immediately from session token; enrich from DB in background
  const fetchProfileAndSet = useCallback((user: User) => {
    setAuthUser(buildProfile(user))

    if (!supabase) return
    void Promise.resolve(
      supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
    )
      .then(({ data }) => {
        if (data) setAuthUser(buildProfile(user, data))
      })
      .catch(() => {
        // DB unavailable — basic profile already set, continue
      })
  }, [])

  const syncOwnedGroups = useCallback(
    (userId: string) => {
      if (!supabase) return
      void Promise.resolve(
        supabase.from('groups').select('id, data').eq('owner_id', userId),
      )
        .then(({ data }) => {
          const remoteOwnedIds = new Set((data || []).map((row) => row.id))
          // Prune stale local owned groups that no longer exist remotely
          // (e.g., deleted from another device).
          useStore.setState((state) => ({
            groups: state.groups.filter((g) => !(g.ownerId === userId && !remoteOwnedIds.has(g.id))),
          }))
          if (data) {
            data.forEach((row) => {
              if (row.data) upsertGroup({ ...(row.data as Group), id: row.id, ownerId: userId })
            })
          }
        })
        .catch((e: unknown) => {
          console.warn('[auth] syncOwnedGroups error', e)
        })
    },
    [upsertGroup],
  )

  // Fetch groups the user has joined as a member (via user_groups table)
  const syncMemberGroups = useCallback(
    (userId: string) => {
      if (!supabase) return
      void Promise.resolve(
        supabase.from('user_groups').select('group_id, role').eq('user_id', userId),
      )
        .then(async ({ data: memberships, error }) => {
          if (error) {
            // user_groups table may not exist yet — fail silently
            console.warn('[auth] syncMemberGroups error', error.message)
            return
          }
          const normalizedMemberships: GroupMembership[] = (memberships || []).map((m: { group_id: string; role?: string | null }) => ({
            groupId: m.group_id,
            userId,
            role: m.role === 'owner' || m.role === 'full_access' || m.role === 'view' ? m.role : 'full_access',
          }))
          setMemberships(normalizedMemberships)
          if (!memberships?.length) return
          const groupIds = memberships.map((m: { group_id: string }) => m.group_id)
          const { data: rows } = await supabase!
            .from('groups')
            .select('id, data, owner_id')
            .in('id', groupIds)
          const remoteMemberIds = new Set((rows || []).map((row: { id: string }) => row.id))
          // Prune stale local member groups (non-owned) that were removed/left remotely.
          useStore.setState((state) => ({
            groups: state.groups.filter((g) => {
              const isOwnedByUser = g.ownerId === userId
              if (isOwnedByUser) return true
              const hasLinkedPerson = g.people.some((p) => p.authUserId === userId)
              if (!hasLinkedPerson) return true
              return remoteMemberIds.has(g.id)
            }),
          }))
          if (rows) {
            rows.forEach((row: { id: string; data: unknown; owner_id: string | null }) => {
              if (row.data) {
                upsertGroup({
                  ...(row.data as Group),
                  id: row.id,
                  ...(row.owner_id ? { ownerId: row.owner_id } : {}),
                })
              }
            })
          }
        })
        .catch((e: unknown) => {
          console.warn('[auth] syncMemberGroups exception', e)
        })
    },
    [upsertGroup],
  )

  useEffect(() => {
    if (!supabase || !supabaseEnabled) {
      setLoading(false)
      return
    }

    let loadingResolved = false
    const resolveLoading = () => {
      if (!loadingResolved) {
        loadingResolved = true
        setLoading(false)
      }
    }

    let initialSessionFired = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Synchronous: sets authUser immediately, DB enrich runs in background
        fetchProfileAndSet(session.user)
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          syncOwnedGroups(session.user.id)
          syncMemberGroups(session.user.id)
        }
      } else {
        setAuthUser(null)
        setMemberships([])
      }

      if (event === 'INITIAL_SESSION') {
        initialSessionFired = true
        resolveLoading()
      }
    })

    // Safety fallback for mobile Chrome / PWA where INITIAL_SESSION sometimes misfires
    const fallbackTimer = setTimeout(() => {
      if (initialSessionFired) return
      console.warn('[auth] INITIAL_SESSION timeout — getSession() fallback')
      void Promise.resolve(supabase!.auth.getSession())
        .then(({ data: { session } }) => {
          if (session?.user) {
            fetchProfileAndSet(session.user)
            syncOwnedGroups(session.user.id)
            syncMemberGroups(session.user.id)
          } else {
            setAuthUser(null)
          }
        })
        .catch((e: unknown) => {
          console.warn('[auth] fallback error', e)
        })
        .finally(resolveLoading)
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallbackTimer)
    }
  }, [fetchProfileAndSet, syncOwnedGroups, syncMemberGroups])

  // ── Auth methods ────────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, displayName: string, emailRedirectTo?: string) => {
    if (!supabase) throw new Error('not-configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    })
    if (error) throw error
    return data
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('not-configured')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  // afterLoginPath: optional path to redirect to after OAuth completes (e.g. /group/:id?autoJoin=true)
  const signInWithGoogle = async (afterLoginPath?: string) => {
    if (!supabase) throw new Error('not-configured')
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    if (afterLoginPath) callbackUrl.searchParams.set('redirect', afterLoginPath)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    })
    if (error) throw error
  }

  // Register the current user as a member of a group in the user_groups table.
  // This makes the group persist across devices on next login.
  const registerGroupMembership = async (groupId: string, role: GroupRole = 'full_access') => {
    if (!supabase || !supabase.auth) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { error } = await supabase
      .from('user_groups')
      .upsert(
        { user_id: session.user.id, group_id: groupId, role },
        { onConflict: 'user_id,group_id' },
      )
    if (error) console.warn('[auth] registerGroupMembership error', error.message)
    if (!error) {
      setMemberships((prev) => {
        const next = prev.filter((entry) => !(entry.groupId === groupId && entry.userId === session.user.id))
        return [...next, { groupId, userId: session.user.id, role }]
      })
    }
  }

  const updateGroupMembershipRole = async (groupId: string, userId: string, role: Exclude<GroupRole, 'owner'>) => {
    if (!supabase) throw new Error('not-configured')
    const { error } = await supabase
      .from('user_groups')
      .upsert({ user_id: userId, group_id: groupId, role }, { onConflict: 'user_id,group_id' })
    if (error) throw error
    setMemberships((prev) => {
      const next = prev.filter((entry) => !(entry.groupId === groupId && entry.userId === userId))
      return [...next, { groupId, userId, role }]
    })
  }

  const removeGroupMembership = async (groupId: string, userId: string) => {
    if (!supabase) throw new Error('not-configured')
    const { error } = await supabase
      .from('user_groups')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId)
    if (error) throw error
    setMemberships((prev) => prev.filter((entry) => !(entry.groupId === groupId && entry.userId === userId)))
  }

  const createInviteLink = async (groupId: string, role: Exclude<GroupRole, 'owner'>): Promise<GroupInviteLink | null> => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const token = crypto.randomUUID()
    const invite: GroupInviteLink = {
      token,
      groupId,
      role,
      createdBy: authUser.id,
      active: true,
      createdAt: new Date().toISOString(),
      expiresAt: null,
    }
    const { error } = await supabase.from('group_invite_links').upsert({
      token: invite.token,
      group_id: invite.groupId,
      role: invite.role,
      created_by: invite.createdBy,
      active: invite.active,
      created_at: invite.createdAt,
      expires_at: invite.expiresAt,
    })
    if (error) throw error
    return invite
  }

  const getInviteLink = async (token: string): Promise<GroupInviteLink | null> => {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('group_invite_links')
      .select('*')
      .eq('token', token)
      .eq('active', true)
      .maybeSingle()
    if (error || !data) return null
    return {
      token: data.token,
      groupId: data.group_id,
      role: data.role,
      createdBy: data.created_by,
      active: data.active,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    } as GroupInviteLink
  }

  const acceptInviteLink = async (token: string): Promise<GroupMembership | null> => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const invite = await getInviteLink(token)
    if (!invite || invite.groupId == null) return null
    const membership: GroupMembership = {
      groupId: invite.groupId,
      userId: authUser.id,
      role: invite.role,
    }
    const { error } = await supabase
      .from('user_groups')
      .upsert({ user_id: authUser.id, group_id: invite.groupId, role: invite.role }, { onConflict: 'user_id,group_id' })
    if (error) throw error
    setMemberships((prev) => {
      const next = prev.filter((entry) => !(entry.groupId === invite.groupId && entry.userId === authUser.id))
      return [...next, membership]
    })
    return membership
  }

  const signOut = async () => {
    if (!supabase) throw new Error('not-configured')
    await supabase.auth.signOut()
    setAuthUser(null)
  }

  const updateProfile = async (updates: { displayName?: string }) => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: authUser.id, display_name: updates.displayName })
    if (error) throw error
    setAuthUser((prev) =>
      prev ? { ...prev, displayName: updates.displayName ?? prev.displayName } : null,
    )
  }

  const claimGroup = async (groupId: string) => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const { error } = await supabase
      .from('groups')
      .update({ owner_id: authUser.id })
      .eq('id', groupId)
    if (error) throw error
  }

  const releaseGroup = async (groupId: string) => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const { error } = await supabase
      .from('groups')
      .update({ owner_id: null })
      .eq('id', groupId)
    if (error) throw error
  }

  const transferGroupOwnership = async (groupId: string, nextOwnerUserId: string) => {
    if (!supabase || !authUser) throw new Error('not-authenticated')
    const { error: membershipError } = await supabase
      .from('user_groups')
      .upsert({ user_id: nextOwnerUserId, group_id: groupId, role: 'full_access' }, { onConflict: 'user_id,group_id' })
    if (membershipError) throw membershipError
    const { error } = await supabase
      .from('groups')
      .update({ owner_id: nextOwnerUserId })
      .eq('id', groupId)
    if (error) throw error
  }

  return createElement(
    AuthContext.Provider,
    {
      value: {
        authUser,
        loading,
        memberships,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        claimGroup,
        releaseGroup,
        transferGroupOwnership,
        registerGroupMembership,
        updateGroupMembershipRole,
        removeGroupMembership,
        createInviteLink,
        getInviteLink,
        acceptInviteLink,
      },
    },
    children,
  )
}

// ── Hook (reads from shared context — never creates its own state) ────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
