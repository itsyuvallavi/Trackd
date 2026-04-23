'use client'

import { useEffect } from 'react'
import { CheckSquare } from 'lucide-react'
import { SignUpForm } from '@/components/auth/signup-form'
import { Aurora, GlassCard } from '@/components/ui/glass'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }, [])

  return (
    <div className="dark relative min-h-screen flex items-center justify-center bg-background text-foreground overflow-hidden">
      <Aurora />

      <div className="relative z-10 w-full max-w-md p-6 sm:p-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <CheckSquare className="size-7" strokeWidth={2.2} />
          <span className="text-lg font-semibold tracking-tight">Trackd</span>
        </div>

        <GlassCard variant="strong" className="p-7 md:p-8 rounded-3xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create your account
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Start tracking your job applications in seconds.
            </p>
          </div>
          <SignUpForm />
        </GlassCard>
      </div>
    </div>
  )
}
