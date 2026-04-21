'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  ExternalLink,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Building2,
  DollarSign,
  Loader2,
  RefreshCw,
  Inbox,
  UserCircle,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface QueueJob {
  id: string
  title: string
  company: string
  location: string | null
  url: string | null
  salary: string | null
  /** Human-readable API product (e.g. "JSearch (RapidAPI)", "Jobs Search API (RapidAPI) · LinkedIn") */
  sourceDisplayName: string
  botScore: number | null
  botReasoning: string | null
  coverLetter: string | null
  createdAt: string
  duplicate: { appliedAt: string; existingId: string } | null
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-green-500/10 text-green-600 border-green-500/20'
      : score >= 60
        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
        : score >= 40
          ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
          : 'bg-red-500/10 text-red-600 border-red-500/20'

  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Possible' : 'Weak'

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border', color)}>
      <span className="font-bold tabular-nums">{score}</span>
      <span className="opacity-70">{label}</span>
    </span>
  )
}

function JobCard({
  job,
  onApply,
  onSkip,
  onDelete,
}: {
  job: QueueJob
  onApply: (id: string) => Promise<void>
  onSkip: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [showLetter, setShowLetter] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regeneratingLetter, setRegeneratingLetter] = useState(false)
  const [coverLetter, setCoverLetter] = useState<string | null>(job.coverLetter)
  const [applying, setApplying] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateLetter = async () => {
    if (coverLetter) {
      setShowLetter((v) => !v)
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/bot/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      })
      const data = await res.json() as { coverLetter?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCoverLetter(data.coverLetter ?? null)
      setShowLetter(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate cover letter')
    } finally {
      setGenerating(false)
    }
  }

  const regenerateLetter = async () => {
    setRegeneratingLetter(true)
    setError(null)
    try {
      const res = await fetch('/api/bot/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, regenerate: true }),
      })
      const data = await res.json() as { coverLetter?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCoverLetter(data.coverLetter ?? null)
      setShowLetter(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate cover letter')
    } finally {
      setRegeneratingLetter(false)
    }
  }

  const handleApply = async () => {
    setApplying(true)
    setError(null)
    try {
      await onApply(job.id)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setApplying(false)
    }
  }

  const handleSkip = async () => {
    setSkipping(true)
    setError(null)
    try {
      await onSkip(job.id)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to skip')
    } finally {
      setSkipping(false)
    }
  }

  const handleConfirmRemove = async () => {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(job.id)
      setRemoveDialogOpen(false)
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove')
    } finally {
      setDeleting(false)
    }
  }

  if (done) return null

  return (
    <>
    <div className={cn(
      'rounded-xl border bg-card p-5 flex flex-col gap-4 transition-all',
      job.duplicate && 'border-yellow-500/30 bg-yellow-500/5'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-base truncate">{job.title}</h3>
            {job.botScore !== null && <ScoreBadge score={job.botScore} />}
            {job.duplicate && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                <AlertTriangle className="size-3" />
                Already applied
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Building2 className="size-3.5" />
              {job.company}
            </span>
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {job.location}
              </span>
            )}
            {job.salary && (
              <span className="flex items-center gap-1">
                <DollarSign className="size-3.5" />
                {job.salary}
              </span>
            )}
            <span className="text-xs text-muted-foreground/90" title="Search provider">
              {job.sourceDisplayName}
            </span>
          </div>
        </div>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title="Open job posting"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
      </div>

      {/* Duplicate warning */}
      {job.duplicate && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            You already applied to this position on{' '}
            {new Date(job.duplicate.appliedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            . Applying again will create a duplicate entry.
          </span>
        </div>
      )}

      {/* AI Reasoning */}
      {job.botReasoning && (
        <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground leading-relaxed border border-border/50">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground/70 uppercase tracking-wide mb-1.5">
            <Bot className="size-3" />
            AI Assessment
          </span>
          <p>{job.botReasoning}</p>
        </div>
      )}

      {/* Cover Letter */}
      {coverLetter && showLetter && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <FileText className="size-3" />
              Cover Letter
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => void regenerateLetter()}
                disabled={regeneratingLetter || generating}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                title="Regenerate cover letter"
                aria-label="Regenerate cover letter"
              >
                {regeneratingLetter ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RefreshCw className="size-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowLetter(false)}
                className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                title="Hide cover letter"
                aria-label="Hide cover letter"
              >
                <ChevronUp className="size-4" />
              </button>
            </div>
          </div>
          <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-foreground/90">
            {coverLetter}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Actions */}
      <div className="flex w-full flex-wrap items-center gap-2">
        <button
          onClick={handleApply}
          disabled={applying || skipping || deleting}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors',
            job.duplicate && 'border-yellow-500/30 text-yellow-700',
            (applying || skipping || deleting) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {applying ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle className="size-4" />
          )}
          {job.duplicate ? 'Apply anyway' : 'Mark as Applied'}
        </button>

        <button
          onClick={generateLetter}
          disabled={generating || regeneratingLetter || applying || skipping || deleting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : coverLetter && showLetter ? (
            <ChevronUp className="size-4" />
          ) : coverLetter ? (
            <ChevronDown className="size-4" />
          ) : (
            <FileText className="size-4" />
          )}
          {generating
            ? 'Generating…'
            : coverLetter && showLetter
              ? 'Hide Letter'
              : coverLetter
                ? 'Show Letter'
                : 'Cover Letter'}
        </button>

        <button
          onClick={handleSkip}
          disabled={applying || skipping || deleting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {skipping ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <XCircle className="size-4" />
          )}
          Skip
        </button>

        <button
          type="button"
          onClick={() => setRemoveDialogOpen(true)}
          disabled={applying || skipping || deleting}
          className={cn(
            'ml-auto shrink-0 inline-flex items-center justify-center rounded-lg border border-red-500/45 bg-red-500/[0.06] p-2 text-red-600 hover:bg-red-500/12 hover:text-red-700 transition-colors',
            'dark:text-red-400 dark:hover:text-red-300 disabled:opacity-40 disabled:pointer-events-none'
          )}
          title="Remove from Trackd"
          aria-label="Remove from Trackd"
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
        </button>
      </div>
    </div>

    <AlertDialog
      open={removeDialogOpen}
      onOpenChange={(open) => {
        if (deleting) return
        setRemoveDialogOpen(open)
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove from Trackd?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the job from your tracker permanently. It does not withdraw an application on the employer&apos;s site.
          </AlertDialogDescription>
          <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-sm text-foreground">
            <div className="font-medium line-clamp-2">{job.title}</div>
            <div className="text-muted-foreground text-xs mt-0.5">{job.company}</div>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={(e) => {
              e.preventDefault()
              void handleConfirmRemove()
            }}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Removing…
              </span>
            ) : (
              'Remove'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

export function BotQueueContent() {
  const [jobs, setJobs] = useState<QueueJob[]>([])
  const [profileComplete, setProfileComplete] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bot/queue')
      const data = await res.json() as { jobs?: QueueJob[]; profileComplete?: boolean; error?: string }
      if (res.status === 401) {
        throw new Error('Session expired — please sign in again.')
      }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load queue')
      setJobs(data.jobs ?? [])
      setProfileComplete(data.profileComplete ?? true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleApply = async (jobId: string) => {
    const res = await fetch('/api/bot/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json() as { error?: string; message?: string }
    if (!res.ok) {
      throw new Error(data.message ?? data.error ?? 'Failed to apply')
    }
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const handleSkip = async (jobId: string) => {
    const res = await fetch('/api/bot/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Failed to skip')
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const handleDelete = async (jobId: string) => {
    const res = await fetch('/api/bot/queue/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    const data = await res.json() as { error?: string }
    if (!res.ok) throw new Error(data.error ?? 'Failed to remove')
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  const duplicateCount = jobs.filter((j) => j.duplicate).length

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot className="size-5 text-primary" />
            <h1 className="text-xl font-semibold">Bot Queue</h1>
            {!loading && jobs.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold tabular-nums">
                {jobs.length}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Jobs the bot found and approved for you to review
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Incomplete profile warning */}
      {!profileComplete && !loading && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <UserCircle className="size-4 mt-0.5 shrink-0" />
          <span>
            <strong>Your application profile is incomplete.</strong> The bot needs your phone, location, and work authorization to fill forms automatically.{' '}
            <Link href="/profile" className="underline hover:text-amber-900 dark:hover:text-amber-200">
              Complete your profile →
            </Link>
          </span>
        </div>
      )}

      {/* Duplicate notice */}
      {duplicateCount > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            <strong>{duplicateCount} job{duplicateCount > 1 ? 's' : ''}</strong> in your queue{' '}
            {duplicateCount > 1 ? 'match positions' : 'matches a position'} you already applied to.
            The bot won&apos;t re-apply automatically.
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="size-5 animate-spin" />
          <span>Loading queue…</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20 text-red-500 gap-2">
          <AlertTriangle className="size-5" />
          <span>{error}</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center text-muted-foreground">
          <Inbox className="size-10 opacity-30" />
          <div>
            <p className="font-medium text-foreground">Queue is empty</p>
            <p className="text-sm mt-1">
              Run the bot from{' '}
              <a href="/settings/bot" className="underline hover:text-foreground">
                Settings → Bot
              </a>{' '}
              to find new jobs.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onApply={handleApply}
              onSkip={handleSkip}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
