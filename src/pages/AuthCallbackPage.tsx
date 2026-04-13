import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (!supabase) {
      navigate('/')
      return
    }

    // The redirect path may come from:
    // 1. ?redirect= query param (set by signInWithGoogle / email confirmation)
    // 2. localStorage fallback (set before OAuth redirect)
    const redirectFromParam = searchParams.get('redirect')
    const redirectFromStorage = typeof window !== 'undefined'
      ? window.localStorage.getItem('ms_post_auth_redirect')
      : null
    const afterLoginPath = redirectFromParam || redirectFromStorage || null

    if (redirectFromStorage) {
      window.localStorage.removeItem('ms_post_auth_redirect')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(afterLoginPath || '/', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    })
  }, [navigate, searchParams])

  return (
    <main className="ms-page flex min-h-dvh items-center justify-center">
      <p className="text-sm text-[var(--ms-text-secondary)]">Signing you in...</p>
    </main>
  )
}
