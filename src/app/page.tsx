import { redirect } from 'next/navigation'
import { Calendar, CheckSquare, Mail, Sparkles } from 'lucide-react'
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
    <div className="dark relative min-h-screen w-full bg-background text-foreground overflow-hidden">
      <Aurora />

      <main className="relative z-10 grid min-h-screen w-full lg:grid-cols-[minmax(460px,0.92fr)_minmax(0,1.08fr)]">
        <section className="flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:px-14">
          <header className="flex h-12 items-center">
            <div className="flex items-center gap-2">
              <CheckSquare className="size-7" strokeWidth={2.2} />
              <span className="text-lg font-semibold">Trackd</span>
            </div>
          </header>

          <div className="flex flex-1 items-center justify-center py-8">
            <div className="w-full max-w-[520px]">
              <GlassCard variant="strong" className="rounded-2xl p-7 shadow-2xl md:p-9">
                <div className="mb-7">
                  <GlassPill variant="subtle" className="mb-4">
                    <Sparkles className="size-3" />
                    <span>AI-powered</span>
                  </GlassPill>
                  <h1 className="mb-2 text-3xl font-semibold md:text-4xl">
                    Welcome back
                  </h1>
                  <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                    Sign in to keep your applications, interviews, and follow-ups in sync.
                  </p>
                </div>

                <LoginForm next={next} initialError={initialError} />
              </GlassCard>

              <p className="mt-6 text-center text-xs text-muted-foreground/80">
                Your workspace for applications, interviews, offers, and follow-ups.
              </p>
            </div>
          </div>
        </section>

        <section className="relative hidden min-h-screen overflow-hidden border-l border-border lg:block">
          <HeroImage />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,var(--background)_0%,rgb(28_28_28_/_0.30)_30%,transparent_68%),linear-gradient(0deg,rgb(0_0_0_/_0.62)_0%,transparent_42%)]"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-3 p-10 xl:p-14">
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
        </section>
      </main>
    </div>
  )
}
