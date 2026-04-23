'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { scrapeJobUrl, ScrapedJobData } from '../scrape-actions'
import { createJob } from '../actions'
import { Button } from '@/components/ui/button'
import { GlassPanel, GlassPill, Aurora } from '@/components/ui/glass'
import { JobSource, JobStatus, JobPriority } from '@prisma/client'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Link2, Loader2, Sparkles, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'

type Step = 'paste' | 'review'

// Shared input style so every field in the stepper looks tokenized and matches
// the rest of the glass system.
const inputClasses =
  'w-full rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 disabled:opacity-60'

export function NewUrlForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isScraping, setIsScraping] = useState(false)
  const [scrapedData, setScrapedData] = useState<ScrapedJobData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [justScraped, setJustScraped] = useState(false)

  const step: Step = scrapedData ? 'review' : 'paste'

  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    source: 'MANUAL' as JobSource,
    status: 'SAVED' as JobStatus,
    priority: 'B' as JobPriority,
    notes: '',
    salary: '',
    contactName: '',
    contactEmail: '',
    nextAction: '',
    url: '',
  })

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setScrapedData(null)
    setIsScraping(true)

    try {
      const result = await scrapeJobUrl(url)

      if (result.success && result.data) {
        setScrapedData(result.data)
        setFormData({
          title: result.data.title,
          company: result.data.company,
          location: result.data.location || '',
          source: result.data.source,
          status: 'SAVED',
          priority: 'B',
          notes: result.data.description || '',
          salary: result.data.salary || '',
          contactName: '',
          contactEmail: '',
          nextAction: '',
          url: result.data.url,
        })
        setJustScraped(true)
        // Clear the pulse after the animation completes so it doesn't linger.
        setTimeout(() => setJustScraped(false), 1400)
      } else {
        setError(result.error || 'Failed to scrape job URL')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsScraping(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const formDataObj = new FormData()
    Object.entries(formData).forEach(([key, value]) => {
      formDataObj.append(key, value)
    })

    startTransition(async () => {
      try {
        await createJob(formDataObj)
        router.push('/jobs')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create job')
      }
    })
  }

  const enterManually = () => {
    setError(null)
    setFormData((fd) => ({
      ...fd,
      title: '',
      company: '',
      url: url,
    }))
    setScrapedData({} as ScrapedJobData)
  }

  const resetAll = () => {
    setScrapedData(null)
    setUrl('')
    setError(null)
    setFormData({
      title: '',
      company: '',
      location: '',
      source: 'MANUAL',
      status: 'SAVED',
      priority: 'B',
      notes: '',
      salary: '',
      contactName: '',
      contactEmail: '',
      nextAction: '',
      url: '',
    })
  }

  return (
    <div className="relative flex-1 overflow-auto">
      {/* Subtle aurora underlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
        <Aurora />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/jobs')}
            className="h-8 -ml-2 mb-3 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            <span className="text-xs md:text-sm">Back to jobs</span>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight mb-1">
            Add job
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste a job URL — we&apos;ll extract the details for you to review.
          </p>
        </div>

        {/* Stepper pills */}
        <div className="mb-5 flex items-center gap-2">
          <GlassPill
            variant={step === 'paste' ? 'default' : 'subtle'}
            className={cn(
              'text-[11px] tabular-nums transition-colors',
              step === 'paste' && 'ring-1 ring-primary/30'
            )}
          >
            <span className="font-semibold">1</span>
            <span className="opacity-70">Paste URL</span>
          </GlassPill>
          <span aria-hidden className="h-px w-6 bg-border/60" />
          <GlassPill
            variant={step === 'review' ? 'default' : 'subtle'}
            className={cn(
              'text-[11px] tabular-nums transition-colors',
              step === 'review' && 'ring-1 ring-primary/30'
            )}
          >
            <span className="font-semibold">2</span>
            <span className="opacity-70">Review & save</span>
          </GlassPill>
        </div>

        {/* Single glass card — smooth height transition between steps */}
        <GlassPanel
          className={cn(
            'rounded-3xl p-5 md:p-7 relative overflow-hidden transition-[box-shadow] duration-500',
            justScraped && 'ring-1 ring-primary/50 shadow-[0_0_0_8px_oklch(from_var(--primary)_l_c_h_/_0.08)]'
          )}
        >
          {/* Cobalt success pulse */}
          {justScraped && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-3xl"
              style={{
                background:
                  'radial-gradient(600px circle at 50% 0%, oklch(from var(--primary) l c h / 0.12), transparent 60%)',
                animation: 'trackd-glow-pulse 1.4s ease-out forwards',
              }}
            />
          )}

          {/* STEP 1: Paste URL */}
          {step === 'paste' && (
            <div className="trackd-route-enter">
              <form onSubmit={handleScrape} className="space-y-4">
                <label
                  htmlFor="url"
                  className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium"
                >
                  Job URL
                </label>
                <div className="relative flex items-stretch gap-2">
                  <div className="relative flex-1">
                    <Link2
                      aria-hidden
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70"
                    />
                    <input
                      id="url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/jobs/view/..."
                      className={cn(inputClasses, 'pl-10 py-3')}
                      required
                      disabled={isScraping}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isScraping || !url}
                    className="rounded-xl px-5 shrink-0"
                  >
                    {isScraping ? (
                      <>
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                        Scraping…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 mr-1.5" />
                        Extract
                      </>
                    )}
                  </Button>
                </div>

                {error && (
                  <div className="mt-1 rounded-xl border border-error/30 bg-error-bg p-3 text-sm text-error-text flex items-start gap-2.5">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="break-words">{error}</p>
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={enterManually}
                          className="h-7 rounded-full text-xs"
                        >
                          Enter details manually
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Works best with LinkedIn, company career pages, and major job boards.
                </p>
              </form>
            </div>
          )}

          {/* STEP 2: Review & save */}
          {step === 'review' && scrapedData && (
            <div key="review" className="trackd-route-enter">
              {/* Success banner */}
              <div className="mb-5 flex items-center gap-2 text-sm text-success-text">
                <div className="shrink-0 size-6 rounded-full bg-success-bg border border-success/30 grid place-items-center">
                  <CheckCircle2 className="size-3.5" />
                </div>
                <span className="font-medium">Details extracted.</span>
                <span className="text-muted-foreground">Review and save.</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Job title" required>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      required
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Company" required>
                    <input
                      type="text"
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      required
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Location">
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Source">
                    <select
                      value={formData.source}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          source: e.target.value as JobSource,
                        })
                      }
                      className={inputClasses}
                    >
                      {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as JobStatus,
                        })
                      }
                      className={inputClasses}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: e.target.value as JobPriority,
                        })
                      }
                      className={inputClasses}
                    >
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Salary">
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(e) =>
                        setFormData({ ...formData, salary: e.target.value })
                      }
                      className={inputClasses}
                    />
                  </Field>

                  <Field label="Next action">
                    <input
                      type="text"
                      value={formData.nextAction}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          nextAction: e.target.value,
                        })
                      }
                      className={inputClasses}
                    />
                  </Field>
                </div>

                <Field label="Notes">
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={10}
                    className={cn(inputClasses, 'resize-y')}
                  />
                </Field>

                {error && (
                  <div className="rounded-xl border border-error/30 bg-error-bg p-3 text-sm text-error-text flex items-start gap-2.5">
                    <AlertCircle className="size-4 mt-0.5 shrink-0" />
                    <p className="break-words">{error}</p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetAll}
                    disabled={isPending}
                    className="rounded-full"
                  >
                    Start over
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="rounded-full px-6"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save job'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
