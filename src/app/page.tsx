import { redirect } from 'next/navigation'
import { CheckSquare, Sparkles, Mail, Calendar } from 'lucide-react'
import { LoginForm } from '@/components/auth/login-form'
import { getCurrentUser } from '@/lib/auth'
import { HeroImage } from '@/components/home/hero-image'
import { Aurora, GlassCard, GlassPill } from '@/components/ui/glass'
import { authErrorMessage, safeAuthRedirectPath } from '@/lib/auth-callback'

interface HomePageProps {
  searchParams?: Promise<{ next?: string; error?: string }>
}

export default async function Home({ searchParams }: HomePageProps) {
  const user = await getCurrentUser()

  if (user) {
    redirect('/jobs')
  }

  const resolvedSearchParams = (await searchParams) ?? {}
  const next = safeAuthRedirectPath(resolvedSearchParams.next)
  const initialError = authErrorMessage(resolvedSearchParams.error)

  return (
    <div className="dark relative min-h-screen w-full flex bg-background text-foreground overflow-hidden">
      {/* Ambient aurora fills the whole page background */}
      <Aurora />

      {/* ---------------- Left: auth ---------------- */}
      <div className="relative z-10 w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-10">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-10">
            <CheckSquare className="size-7" strokeWidth={2.2} />
            <span className="text-lg font-semibold tracking-tight">Trackd</span>
          </div>

          <GlassCard variant="strong" className="p-7 md:p-8 rounded-3xl">
            <div className="mb-6">
              <GlassPill variant="subtle" className="mb-4">
                <Sparkles className="size-3" />
                <span>AI-powered</span>
              </GlassPill>
              <h1 className="text-3xl font-semibold tracking-tight mb-2">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground">
                Sign in or create your account to start tracking your job
                applications.
              </p>
            </div>

            <LoginForm next={next} initialError={initialError} />
          </GlassCard>

          <p className="mt-8 text-xs text-muted-foreground/80 text-center">
            Trusted by thousands of job-seekers. End-to-end encrypted.
          </p>
        </div>
      </div>

      {/* ---------------- Right: hero artwork + feature pills ---------------- */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <HeroImage />
        {/* Feature chips layered over the image */}
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-start justify-end p-10 gap-3">
          <GlassPill variant="nav" className="pointer-events-auto">
            <Mail className="size-3.5" />
            <span>Email sync in real time</span>
          </GlassPill>
          <GlassPill variant="nav" className="pointer-events-auto">
            <Calendar className="size-3.5" />
            <span>Interviews, offers, follow-ups</span>
          </GlassPill>
          <GlassPill variant="nav" className="pointer-events-auto">
            <Sparkles className="size-3.5" />
            <span>AI resume advisor</span>
          </GlassPill>
        </div>
        {/* Vignette so text reads against the photo */}
        <div
          aria-hidden
          className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-tr from-background/80 via-background/20 to-transparent"
        />
      </div>
    </div>
  )
}
