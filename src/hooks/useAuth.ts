import { useState, useEffect, useCallback, useContext, createContext } from 'react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useStore } from '../store/useStore'
import type { Group, UserProfile } from '../types'

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
  signUp: (email: string, password: string, displayName: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { displayName?: string }) => Promise<void>
  claimGroup: (groupId: string) => Promise<void>
  releaseGroup: (groupId: string) => Promise<void>
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider (single instance for the whole app) ─────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
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
        }
      } else {
        setAuthUser(null)
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
  }, [fetchProfileAndSet, syncOwnedGroups])

  // ── Auth methods ────────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!supabase) throw new Error('not-configured')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
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

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('not-configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
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

  return createElement(
    AuthContext.Provider,
    {
      value: {
        authUser,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateProfile,
        claimGroup,
        releaseGroup,
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
