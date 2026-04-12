import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseEnabled = Boolean(url && key)

export const supabase = supabaseEnabled
  ? createClient(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // Explicitly point to localStorage so Chrome mobile / PWA mode always finds the session
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null
