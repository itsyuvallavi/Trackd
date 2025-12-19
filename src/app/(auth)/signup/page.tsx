'use client'

import { useEffect } from 'react'
import { SignUpForm } from '@/components/auth/signup-form'

export const dynamic = 'force-dynamic'

export default function SignUpPage() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground mt-2">
            Start tracking your job applications
          </p>
        </div>
        <SignUpForm />
      </div>
    </div>
  )
}


