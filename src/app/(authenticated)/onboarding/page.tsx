'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Aurora, GlassPanel } from '@/components/ui/glass'
import { CheckCircle, Mail, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type OnboardingStep = 'welcome' | 'email' | 'complete'

const STEPS: { key: OnboardingStep; title: string; description: string }[] = [
  {
    key: 'welcome',
    title: 'Welcome to Trackd',
    description: 'Get started in just a few steps',
  },
  {
    key: 'email',
    title: 'Email Sync',
    description: 'Automatically track status updates from emails',
  },
  {
    key: 'complete',
    title: "You're all set",
    description: 'Start tracking your applications',
  },
]

function getInitialStep(stepParam: string | null): OnboardingStep {
  if (stepParam && STEPS.find((s) => s.key === stepParam)) {
    return stepParam as OnboardingStep
  }
  return 'welcome'
}

function OnboardingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const stepParam = searchParams.get('step')

  const [currentStep, setCurrentStep] = useState<OnboardingStep>(() =>
    getInitialStep(stepParam)
  )
  const supabase = createClient()

  const steps = STEPS
  const currentStepIndex = steps.findIndex((s) => s.key === currentStep)
  const progress = ((currentStepIndex + 1) / steps.length) * 100

  useEffect(() => {
    if (stepParam) {
      window.history.replaceState({}, '', '/onboarding')
    }
  }, [stepParam])

  const markOnboardingComplete = async () => {
    try {
      await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      })
    } catch {
      // Non-blocking; user can still continue even if metadata update fails
    }
  }

  const handleNext = async () => {
    if (currentStep === 'complete') {
      await markOnboardingComplete()
      router.push('/jobs')
      return
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key as OnboardingStep)
    }
  }

  const handleSkip = async () => {
    await handleNext()
  }

  return (
    <div className="dark relative min-h-screen w-full flex items-center justify-center bg-background text-foreground overflow-hidden">
      <Aurora />

      <div className="relative z-10 w-full max-w-3xl px-4 md:px-6 py-8 md:py-12">
        {/* Progress rail — cobalt, thin. */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="tabular-nums">
              Step {currentStepIndex + 1} / {steps.length}
            </span>
            <span>{steps[currentStepIndex].title}</span>
          </div>
          <div className="h-[2px] w-full rounded-full bg-foreground/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-700 ease-[var(--ease-ios)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step content — glass card, slide+crossfade between steps */}
        <GlassPanel
          key={currentStep}
          variant="strong"
          className="rounded-3xl p-6 md:p-10 min-h-[520px] flex flex-col trackd-route-enter"
        >
          {currentStep === 'welcome' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
                <Sparkles className="size-7 text-primary" />
              </div>
              <h1 className="text-4xl font-semibold tracking-tight mb-3">
                Welcome to Trackd
              </h1>
              <p className="text-base text-muted-foreground mb-8 max-w-xl">
                Your job application tracker that stays up to date automatically.
                Never maintain a spreadsheet again.
              </p>
              <div className="space-y-3 mb-8 text-left max-w-md w-full">
                <Feature
                  title="Automatic status tracking"
                  body="Get updates from your emails automatically."
                />
                <Feature
                  title="One-click job saving"
                  body="Save jobs from any site with our browser extension."
                />
                <Feature
                  title="Never miss a deadline"
                  body="Track interviews and follow-ups in one place."
                />
              </div>
              <Button onClick={handleNext} size="lg" className="rounded-full">
                Get started
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 'email' && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Mail className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Connect your email
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Automatically track status updates from job board emails.
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-5">
                <div className="rounded-2xl glass glass-subtle p-5">
                  <h3 className="text-sm font-semibold tracking-tight mb-2 text-foreground/80">
                    How it works
                  </h3>
                  <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                    <li>
                      We scan emails from job boards like LinkedIn, Indeed, and
                      Greenhouse.
                    </li>
                    <li>Status updates are automatically tracked.</li>
                    <li>
                      You can review and approve changes before they&apos;re
                      applied.
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">
                      Easy setup{' '}
                      <span className="text-muted-foreground font-normal">
                        (recommended)
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      One-click connection — no passwords needed.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const redirectTo = '/onboarding?step=complete'
                        window.location.href = `/api/auth/email/oauth?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`
                      }}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl',
                        'glass glass-subtle hover:bg-foreground/[0.04]',
                        'transition-[background-color,transform] duration-150 ease-[var(--ease-ios)] hover:-translate-y-0.5'
                      )}
                    >
                      <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span className="font-medium text-sm">Google</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const redirectTo = '/onboarding?step=complete'
                        window.location.href = `/api/auth/email/oauth?provider=microsoft&redirect_to=${encodeURIComponent(redirectTo)}`
                      }}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl',
                        'glass glass-subtle hover:bg-foreground/[0.04]',
                        'transition-[background-color,transform] duration-150 ease-[var(--ease-ios)] hover:-translate-y-0.5'
                      )}
                    >
                      <svg
                        className="size-5 shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3z"
                          fill="#0078D4"
                        />
                        <path
                          d="M12 8.25L6 12.75v5.25h12V12.75L12 8.25z"
                          fill="white"
                        />
                        <path
                          d="M12 8.25l6 4.5V6H6v6.75l6-4.5z"
                          fill="#28A8EA"
                        />
                      </svg>
                      <span className="font-medium text-sm">Outlook</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/60"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-background/0 text-muted-foreground text-xs">
                        Or use a custom email
                      </span>
                    </div>
                  </div>

                  <Link href="/settings/integrations" className="block">
                    <button
                      type="button"
                      className={cn(
                        'w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl',
                        'glass glass-subtle hover:bg-foreground/[0.04]',
                        'transition-[background-color,transform] duration-150 ease-[var(--ease-ios)] hover:-translate-y-0.5'
                      )}
                    >
                      <Mail className="size-5 shrink-0" />
                      <span className="font-medium text-sm">
                        Use IMAP (custom domain)
                      </span>
                    </button>
                  </Link>

                  <p className="text-xs text-muted-foreground text-center">
                    For custom domains, Google Workspace, Outlook, or any email
                    provider.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="size-16 rounded-2xl bg-success-bg border border-success/20 flex items-center justify-center mb-6">
                <CheckCircle className="size-7 text-success-text" />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight mb-3">
                You&apos;re all set
              </h2>
              <p className="text-base text-muted-foreground mb-8 max-w-xl">
                You&apos;re ready to start tracking your job applications. Your
                email is connected and will automatically sync status updates.
              </p>
              <Button onClick={handleNext} size="lg" className="rounded-full">
                Go to jobs
                <ArrowRight className="size-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Set up later Button */}
          {currentStep !== 'complete' && currentStep !== 'welcome' && (
            <div className="mt-8 pt-6 border-t border-border/60 text-center">
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Set up later
              </button>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle className="size-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="font-medium text-sm text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-sm text-muted-foreground">
            Loading…
          </div>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  )
}
