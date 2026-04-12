import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { useStore } from '../store/useStore'
import type { Group, UserProfile } from '../types'

function buildProfile(user: User, row?: { display_name?: string | null; avatar_url?: string | null } | null): UserProfile {
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

export function useAuth() {
  const [authUser, setAuthUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const upsertGroup = useStore((s) => s.upsertGroup)

  const fetchProfileAndSet = useCallback(async (user: User) => {
    // Set auth user immediately from session data — no DB round-trip needed to log in.
    // This prevents the "flashes logged-out" issue on page refresh.
    setAuthUser(buildProfile(user))

    if (!supabase) return
    // Then enrich with DB profile in the background (name, avatar from user_profiles table)
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      if (data) setAuthUser(buildProfile(user, data))
    } catch {
      // DB unavailable — basic profile is already set above, continue
    }
  }, [])

  const syncOwnedGroups = useCallback(
    async (userId: string) => {
      if (!supabase) return
      const { data } = await supabase
        .from('groups')
        .select('id, data')
        .eq('owner_id', userId)
      if (data) {
        data.forEach((row) => {
          if (row.data) upsertGroup({ ...(row.data as Group), id: row.id, ownerId: userId })
        })
      }
    },
    [upsertGroup],
  )

  useEffect(() => {
    if (!supabase || !supabaseEnabled) {
      setLoading(false)
      return
    }

    // Only call setLoading(false) once, whichever path fires first
    let loadingResolved = false
    const resolveLoading = () => {
      if (!loadingResolved) {
        loadingResolved = true
        setLoading(false)
      }
    }

    // Track whether INITIAL_SESSION fired so the fallback knows not to double-run
    let initialSessionFired = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      try {
        if (session?.user) {
          // fetchProfileAndSet sets authUser immediately (non-blocking DB enrich)
          await fetchProfileAndSet(session.user)
        } else {
          setAuthUser(null)
        }
      } catch (e) {
        console.warn('[auth] state change error', e)
        if (session?.user) setAuthUser(buildProfile(session.user))
      } finally {
        // Resolve loading as soon as auth state is confirmed — do NOT wait for group sync
        if (event === 'INITIAL_SESSION') {
          initialSessionFired = true
          resolveLoading()
        }
      }
      // Sync owned groups in the background (non-blocking — never delays loading state)
      if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        void syncOwnedGroups(session.user.id)
      }
    })

    // Safety fallback: some mobile Chrome / PWA builds don't fire INITIAL_SESSION reliably.
    // If it hasn't fired within 3 s, call getSession() directly as a backup.
    const fallbackTimer = setTimeout(async () => {
      if (initialSessionFired) return
      console.warn('[auth] INITIAL_SESSION timeout — running getSession() fallback')
      try {
        const { data: { session } } = await supabase!.auth.getSession()
        if (session?.user) {
          await fetchProfileAndSet(session.user)
          void syncOwnedGroups(session.user.id)
        } else {
          setAuthUser(null)
        }
      } catch (e) {
        console.warn('[auth] fallback getSession error', e)
      } finally {
        resolveLoading()
      }
    }, 3000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallbackTimer)
    }
  }, [fetchProfileAndSet, syncOwnedGroups])

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
    setAuthUser((prev) => (prev ? { ...prev, displayName: updates.displayName ?? prev.displayName } : null))
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

  return {
    authUser,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    claimGroup,
    releaseGroup,
  }
}
