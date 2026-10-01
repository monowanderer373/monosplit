import { useState, useEffect, useContext, createContext } from 'react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from '../lib/supabase'
import { applyProfileEnrichment } from '../lib/authProfile'
import {
  observeAuthFailure,
  observeAuthOutcome,
  type AuthMethod,
  type AuthOperation,
} from '../lib/telemetry'
import { useStore } from '../store/useStore'
import type { UserProfile } from '../types'
import { safeInternalRedirect } from '../lib/authUi'

async function observeAuthRequest<T>(
  operation: AuthOperation,
  method: AuthMethod,
  request: () => Promise<T>,
): Promise<T> {
  observeAuthOutcome(operation, 'started', method)
  try {
    const result = await request()
    observeAuthOutcome(operation, 'succeeded', method)
    return result
  } catch (cause) {
    observeAuthFailure(operation, method, cause)
    throw cause
  }
}

function buildProfile(
  user: User,
  row?: {
    display_name?: string | null
    avatar_url?: string | null
    default_currency?: string | null
    timezone?: string | null
  } | null,
  participantId?: string | null,
): UserProfile {
  return {
    id: user.id,
    participantId: participantId ?? null,
    email: user.email,
    displayName:
      row?.display_name ??
      user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      null,
    avatarUrl: row?.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    lang: 'en',
    themeId: 'solid-vintage',
    defaultCurrency: row?.default_currency ?? 'MYR',
    timezone: row?.timezone ?? 'Asia/Kuala_Lumpur',
    isAnonymous: user.is_anonymous ?? false,
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

type AuthContextValue = {
  authUser: UserProfile | null
  loading: boolean
  sessionError: boolean
  retrySession: () => void
  signUp: (email: string, password: string, displayName: string, emailRedirectTo?: string) => Promise<unknown>
  signIn: (email: string, password: string) => Promise<unknown>
  signInAnonymously: () => Promise<unknown>
  linkAnonymousEmail: (email: string, emailRedirectTo?: string) => Promise<void>
  setAccountPassword: (password: string) => Promise<void>
  signInWithGoogle: (afterLoginPath?: string) => Promise<void>
  signOut: () => Promise<void>
  updateProfile: (updates: { displayName?: string }) => Promise<void>
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ── Provider (single instance for the whole app) ─────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(supabaseEnabled)

  const [sessionError, setSessionError] = useState(false)
  const [sessionAttempt, setSessionAttempt] = useState(0)

  useEffect(() => {
    if (!supabase || !supabaseEnabled) return
    const client = supabase
    let active = true
    let revision = 0
    let sessionIdentity: string | null = null
    setLoading(true)
    setSessionError(false)

    // Keep database requests outside Supabase's auth callback/lock. A new
    // session revision also invalidates any older profile or bootstrap response.
    const acceptSession = async (user: User | null) => {
      const requestRevision = ++revision
      if (!active) return
      setSessionError(false)
      if (user && sessionIdentity !== user.id) setLoading(true)
      sessionIdentity = user?.id ?? null
      if (!user) {
        setAuthUser(null)
        setLoading(false)
        return
      }

      setAuthUser((current) => current?.id === user.id
        ? { ...current, email: user.email, isAnonymous: user.is_anonymous ?? false }
        : buildProfile(user))
      try {
        // Yield out of the auth notification before doing any database work.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        if (!active || revision !== requestRevision) return
        const [profileResult, participantResult] = await Promise.all([
          client.from('user_profiles')
            .select('display_name, avatar_url, default_currency, timezone')
            .eq('id', user.id).maybeSingle(),
          client.from('participants').select('id')
            .eq('auth_user_id', user.id).maybeSingle(),
        ])
        if (!active || revision !== requestRevision) return
        if (profileResult.error) throw profileResult.error
        if (participantResult.error) throw participantResult.error
        const enriched = buildProfile(user, profileResult.data, participantResult.data?.id ?? null)
        setAuthUser((current) => applyProfileEnrichment(current, enriched))
        setLoading(false)
      } catch (cause) {
        if (!active || revision !== requestRevision) return
        observeAuthFailure('profile_load', 'session', cause)
        // A failed read must not masquerade as logged out or missing schema.
        setSessionError(true)
        setLoading(false)
      }
    }

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active || event === 'INITIAL_SESSION') return
      if (session?.user || event === 'SIGNED_OUT') {
        void acceptSession(session?.user ?? null)
      }
    })

    // Read the persisted session immediately, rather than using a timer to
    // decide when a user is signed out. Later auth events take precedence.
    const bootstrapRevision = revision
    void client.auth.getSession().then(({ data: { session }, error }) => {
      if (!active || revision !== bootstrapRevision) return
      if (error) throw error
      observeAuthOutcome('initial_session', 'succeeded', 'session')
      return acceptSession(session?.user ?? null)
    }).catch((cause: unknown) => {
      if (!active || revision !== bootstrapRevision) return
      observeAuthFailure('initial_session', 'session', cause)
      setSessionError(true)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [sessionAttempt])

  // ── Auth methods ────────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, displayName: string, emailRedirectTo?: string) => {
    return observeAuthRequest('sign_up', 'email', async () => {
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
    })
  }

  const signIn = async (email: string, password: string) => {
    return observeAuthRequest('sign_in', 'email', async () => {
      if (!supabase) throw new Error('not-configured')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      return data
    })
  }

  const signInAnonymously = async () => {
    return observeAuthRequest('anonymous_sign_in', 'anonymous', async () => {
      if (!supabase) throw new Error('not-configured')
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      return data
    })
  }

  const linkAnonymousEmail = async (email: string, emailRedirectTo?: string) => {
    return observeAuthRequest('link_email', 'email', async () => {
      if (!supabase || !authUser?.isAnonymous) throw new Error('anonymous_session_required')
      const { error } = await supabase.auth.updateUser(
        { email: email.trim() },
        emailRedirectTo ? { emailRedirectTo } : undefined,
      )
      if (error) throw error
    })
  }

  const setAccountPassword = async (password: string) => {
    return observeAuthRequest('set_password', 'email', async () => {
      if (!supabase || !authUser || authUser.isAnonymous) throw new Error('verified_account_required')
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    })
  }

  // afterLoginPath preserves the intended relational route across OAuth.
  const signInWithGoogle = async (afterLoginPath?: string) => {
    return observeAuthRequest('google_sign_in', 'google', async () => {
      if (!supabase) throw new Error('not-configured')
      const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
      const safePath = safeInternalRedirect(afterLoginPath)
      if (safePath) callbackUrl.searchParams.set('redirect', safePath)
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      })
      if (error) throw error
    })
  }

  const signOut = async () => {
    return observeAuthRequest('sign_out', 'session', async () => {
      if (!supabase) throw new Error('not-configured')
      const signingOutUserId = authUser?.id
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      if (signingOutUserId) useStore.getState().clearLedgerIdentity(signingOutUserId)
      setAuthUser(null)
    })
  }

  const updateProfile = async (updates: { displayName?: string }) => {
    return observeAuthRequest('update_profile', 'session', async () => {
      if (!supabase || !authUser) throw new Error('not-authenticated')
      const { error } = await supabase
        .from('user_profiles')
        .upsert({ id: authUser.id, display_name: updates.displayName })
      if (error) throw error
      setAuthUser((prev) =>
        prev ? { ...prev, displayName: updates.displayName ?? prev.displayName } : null,
      )
    })
  }

  return createElement(
    AuthContext.Provider,
    {
      value: {
        authUser,
        loading,
        sessionError,
        retrySession: () => setSessionAttempt((attempt) => attempt + 1),
        signUp,
        signIn,
        signInAnonymously,
        linkAnonymousEmail,
        setAccountPassword,
        signInWithGoogle,
        signOut,
        updateProfile,
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
