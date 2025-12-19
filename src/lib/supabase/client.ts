import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_API

  if (!url || !anonKey) {
    // Provide a mock client when env vars are missing
    // This allows the app to load without errors, but auth features won't work
    console.warn('Supabase not configured - authentication features disabled')
    return {
      auth: {
        signUp: async () => ({ error: { message: 'Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.' } }),
        signInWithOAuth: async () => ({ error: { message: 'Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.' } }),
        signInWithPassword: async () => ({ error: { message: 'Supabase not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.' } }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
      },
    } as any
  }

  return createBrowserClient(url, anonKey)
}


