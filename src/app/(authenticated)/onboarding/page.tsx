'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle, Mail, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

type OnboardingStep = 'welcome' | 'email' | 'complete'

export default function OnboardingPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome')
  const [skippedSteps, setSkippedSteps] = useState<Set<OnboardingStep>>(new Set())

  const steps: { key: OnboardingStep; title: string; description: string }[] = [
    { key: 'welcome', title: 'Welcome to Trackd', description: 'Get started in just a few steps' },
    { key: 'email', title: 'Email Sync', description: 'Automatically track status updates from emails' },
    { key: 'complete', title: "You're All Set!", description: 'Start tracking your applications' },
  ]

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep)

  // Check for step parameter in URL (e.g., after OAuth redirect)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const stepParam = params.get('step') as OnboardingStep | null
      if (stepParam && steps.find(s => s.key === stepParam)) {
        setCurrentStep(stepParam)
        // Clean up URL
        window.history.replaceState({}, '', '/onboarding')
      }
    }
  }, [steps])

  const handleNext = () => {
    if (currentStep === 'complete') {
      router.push('/jobs')
      return
    }

    const nextIndex = currentStepIndex + 1
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key as OnboardingStep)
    }
  }

  const handleSkip = () => {
    setSkippedSteps((prev) => new Set([...prev, currentStep]))
    handleNext()
  }

  const handleSkipAll = () => {
    router.push('/jobs')
  }


  return (
    <div className="size-full flex">
      <div className="flex-1 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto p-8">
          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="relative flex items-start mb-4">
              {steps.map((step, index) => (
                <div key={step.key} className="flex flex-col items-center flex-1 relative z-10">
                  {/* Circle */}
                  <div
                    className={`size-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 shrink-0 ${
                      index <= currentStepIndex
                        ? 'bg-primary border-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20'
                        : 'border-foreground/20 text-foreground/40 scale-100'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <CheckCircle className="size-5 animate-in fade-in zoom-in duration-300" />
                    ) : (
                      <span className="text-sm font-semibold transition-all duration-300">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Text Label */}
                  <span className="text-xs mt-2 text-center text-muted-foreground h-10 flex items-center justify-center px-1">
                    {step.title}
                  </span>
                  
                  {/* Connector Line - positioned absolutely between circles */}
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute top-5 left-[calc(50%+1.25rem)] h-0.5 w-[calc(100%-2.5rem)] transition-all duration-700 ease-out ${
                        index < currentStepIndex ? 'bg-primary' : 'bg-foreground/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div 
            key={currentStep}
            className="bg-card border border-border rounded-lg p-8 min-h-[500px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-500"
          >
            {currentStep === 'welcome' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="size-10 text-primary" />
                </div>
                <h1 className="text-4xl font-bold mb-4">Welcome to Trackd!</h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
                  Your job application tracker that automatically stays up to date. Never maintain a spreadsheet again.
                </p>
                <div className="space-y-4 mb-8 text-left max-w-md">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Automatic Status Tracking</p>
                      <p className="text-sm text-muted-foreground">
                        Get updates from your emails automatically
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">One-Click Job Saving</p>
                      <p className="text-sm text-muted-foreground">
                        Save jobs from any website with our browser extension
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="size-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Never Miss a Deadline</p>
                      <p className="text-sm text-muted-foreground">
                        Track interviews and follow-ups in one place
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleNext} size="lg">
                    Get Started
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {currentStep === 'email' && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="size-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Connect Your Email</h2>
                    <p className="text-muted-foreground">
                      Automatically track status updates from job board emails
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-6">
                  <div className="p-6 border border-border rounded-lg bg-accent/50">
                    <h3 className="font-semibold mb-2">How it works:</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      <li>We scan emails from job boards like LinkedIn, Indeed, Greenhouse</li>
                      <li>Status updates are automatically tracked</li>
                      <li>You can review and approve changes before they're applied</li>
                    </ul>
                  </div>

                  {/* OAuth Options */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-3">Easy Setup (Recommended)</p>
                      <p className="text-xs text-muted-foreground mb-4">
                        One-click connection - no passwords needed
                      </p>
                    </div>

                    {/* Google and Microsoft side by side */}
                    <div className="grid grid-cols-2 gap-3">
                    {/* Google OAuth Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const redirectTo = '/onboarding?step=complete'
                        window.location.href = `/api/auth/email/oauth?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-accent/50 transition-colors group"
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

                      {/* Outlook OAuth Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const redirectTo = '/onboarding?step=complete'
                          window.location.href = `/api/auth/email/oauth?provider=microsoft&redirect_to=${encodeURIComponent(redirectTo)}`
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                      >
                        <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
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
                        <div className="w-full border-t border-border"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-card text-muted-foreground">Or use a custom email</span>
                      </div>
                    </div>

                    {/* IMAP Option */}
                    <Link href="/settings/integrations" className="block">
                      <button
                        type="button"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-accent/50 transition-colors group"
                      >
                        <Mail className="size-5 shrink-0" />
                        <span className="font-medium text-sm">Use IMAP (Custom Domain)</span>
                      </button>
                    </Link>

                    <p className="text-xs text-muted-foreground text-center">
                      For custom domains, Google Workspace, Outlook, or any email provider
                    </p>
                  </div>
                </div>
              </div>
            )}


            {currentStep === 'complete' && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="size-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
                  <CheckCircle className="size-10 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-3xl font-bold mb-4">You're All Set!</h2>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl">
                  You're ready to start tracking your job applications. Your email is now connected and will automatically sync status updates.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={handleNext} size="lg">
                    Go to Dashboard
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Set up later Button */}
            {currentStep !== 'complete' && currentStep !== 'welcome' && (
              <div className="mt-8 pt-6 border-t border-border text-center">
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Set up later
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

