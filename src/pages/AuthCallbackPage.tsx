import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) {
      navigate('/')
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? '/' : '/login', { replace: true })
    })
  }, [navigate])

  return (
    <main className="ms-page flex min-h-dvh items-center justify-center">
      <p className="text-sm text-[var(--ms-text-secondary)]">Signing you in...</p>
    </main>
  )
}
