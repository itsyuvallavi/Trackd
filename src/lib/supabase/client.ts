import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_API

  if (!url || !anonKey) {
    // Provide a fallback during build/SSR to prevent build errors
    // This will still fail at runtime if env vars are missing, which is expected
    if (typeof window === 'undefined') {
      // Server-side: return a mock client that will error when used
      // This allows the build to complete
      return {
        auth: {
          signUp: async () => ({ error: new Error('Supabase not configured') }),
          signInWithOAuth: async () => ({ error: new Error('Supabase not configured') }),
          signInWithPassword: async () => ({ error: new Error('Supabase not configured') }),
        },
      } as any
    }
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for Supabase client',
    )
  }

  return createBrowserClient(url, anonKey)
}


