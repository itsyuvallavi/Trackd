'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chrome } from 'lucide-react'

interface LoginFormProps {
  next: string
}

export function LoginForm({ next }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  async function handleGoogleSignIn() {
    setIsLoading(true)
    setError(null)

    console.log('Starting Google OAuth sign in...')
    console.log('Redirect URL:', `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next,
        )}`,
      },
    })

    console.log('OAuth response:', { data, error })

    if (error) {
      console.error('OAuth error:', error)
      // Check if error is due to email already existing with different provider
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        setError('This email is already registered. Please sign in with email and password instead.')
      } else {
        setError(error.message)
      }
      setIsLoading(false)
    } else {
      // If successful, the browser should redirect automatically
      // If data.url exists, it means Supabase returned a redirect URL
      if (data?.url) {
        console.log('Redirecting to:', data.url)
        window.location.href = data.url
      } else {
        console.warn('No redirect URL returned from OAuth')
        setIsLoading(false)
      }
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else if (data.user) {
      // Check if user has completed onboarding
      const hasCompletedOnboarding =
        data.user.user_metadata &&
        (data.user.user_metadata as Record<string, unknown>)['onboarding_completed'] === true

      // Redirect to onboarding if not completed, otherwise to the requested page
      const redirectTo = hasCompletedOnboarding ? next : '/onboarding'
      router.push(redirectTo)
      router.refresh()
    }
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-full justify-center"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <Chrome className="size-4 mr-2" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <div>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-error-text">{error}</p>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <a href="/signup" className="text-primary hover:underline">
          Sign up
        </a>
      </p>
    </div>
  )
}


