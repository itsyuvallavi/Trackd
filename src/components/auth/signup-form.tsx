'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chrome } from 'lucide-react'

export function SignUpForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  
  // Only create client on client side
  const supabase = typeof window !== 'undefined' ? createClient() : null

  async function handleGoogleSignUp() {
    if (!supabase) return
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    }
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    if (!supabase) return
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      setError(error.message)
      setIsLoading(false)
    } else {
      // If email confirmations are disabled, user can sign in immediately
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="text-center p-6 border border-border rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Check your email</h3>
        <p className="text-muted-foreground">
          We&apos;ve sent you a confirmation link at <strong>{email}</strong>
        </p>
        <Button
          className="mt-4"
          onClick={() => router.push('/login')}
        >
          Go to Login
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Button
        variant="outline"
        className="w-full justify-center"
        onClick={handleGoogleSignUp}
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

      <form onSubmit={handleEmailSignUp} className="space-y-4">
        <div>
          <Input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href="/login" className="text-primary hover:underline">
          Sign in
        </a>
      </p>
    </div>
  )
}


