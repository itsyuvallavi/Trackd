'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Loader2, Play, AlertCircle, X } from 'lucide-react'
import type { ResumeReadinessSource } from '@/lib/bot/profile-source-labels'
import type { SetupReadiness } from '@/lib/bot/setup-readiness'
import {
  BOT_RUN_COMPLETE_EVENT,
  BOT_RUN_STARTED_EVENT,
} from '@/lib/constants'

interface BotStatusStripProps {
  isActive: boolean
  frequencyLabel: string
  lastRun: {
    startedAt: string
    jobsFound: number
    jobsNew: number
    jobsApproved: number
  } | null
  canRun: boolean
  runDisabledReason?: string
  resumeReadiness: {
    totalCount: number
    source: ResumeReadinessSource
  }
  setupReadiness?: SetupReadiness
}

type RunCompleteDetail = {
  startedAt?: string
  jobsFound: number
  jobsNew: number
  jobsApproved: number
}

function isRunCompleteEvent(event: Event): event is CustomEvent<RunCompleteDetail> {
  return event.type === BOT_RUN_COMPLETE_EVENT && 'detail' in event
}

type ManualRunStartResponse = {
  success?: boolean
  runId?: string
  error?: string
  fatal?: string
  jobsFound?: number
  jobsNew?: number
  jobsApproved?: number
  jobsHardFiltered?: number
  jobsSkippedLowScore?: number
  jobsEvaluationFailed?: number
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function sourceBadgeClass(source: ResumeReadinessSource): string {
  switch (source.tone) {
    case 'ready':
      return 'border-success/25 bg-success-bg text-success-text'
    case 'missing':
      return 'border-error/25 bg-error-bg/50 text-error-text'
    case 'limited':
      return 'border-warning/25 bg-warning-bg text-warning-text'
  }
}

function sourceWarningText(source: ResumeReadinessSource): string {
  switch (source.kind) {
    case 'raw_resume_fallback':
      return 'Scoring is using extracted resume text because parsed fields are unavailable.'
    case 'application_identity_fallback':
      return 'Run now will score with saved profile details and search preferences until a usable Job Search resume is available.'
    case 'settings_fallback':
      return 'Run now will score with search preferences only until a usable Job Search resume is available.'
    case 'none':
      return 'Run now needs a resume or profile details before scoring can use candidate context.'
    case 'parsed_resume':
      return source.description
  }
}

export function BotStatusStrip({
  isActive,
  frequencyLabel,
  lastRun,
  canRun,
  runDisabledReason,
  resumeReadiness,
  setupReadiness,
}: BotStatusStripProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [liveLastRun, setLiveLastRun] = useState(lastRun)
  const [toast, setToast] = useState<
    | { kind: 'done'; ok: boolean; msg: string }
    | null
  >(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLiveLastRun(lastRun)
  }, [lastRun])

  useEffect(() => {
    const onRunComplete = (event: Event) => {
      setRunning(false)
      if (isRunCompleteEvent(event) && event.detail) {
        setLiveLastRun({
          startedAt: event.detail.startedAt ?? new Date().toISOString(),
          jobsFound: event.detail.jobsFound,
          jobsNew: event.detail.jobsNew,
          jobsApproved: event.detail.jobsApproved,
        })
      }
      router.refresh()
    }

    window.addEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
    return () => window.removeEventListener(BOT_RUN_COMPLETE_EVENT, onRunComplete)
  }, [router])

  useEffect(() => {
    if (toast?.kind !== 'done') return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  function responseError(
    payload: ManualRunStartResponse | Record<string, unknown>,
    fallback: string
  ) {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error
    }
    if (typeof payload.fatal === 'string' && payload.fatal.trim()) {
      return payload.fatal
    }
    return fallback
  }

  async function handleRun() {
    if (running) return
    setRunning(true)

    try {
      const response = await fetch('/api/bot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const res = (await response.json().catch(() => ({}))) as ManualRunStartResponse

      if (response.status === 202 && res.success && res.runId) {
        window.dispatchEvent(
          new CustomEvent(BOT_RUN_STARTED_EVENT, { detail: { runId: res.runId } })
        )
        router.refresh()
        return
      }

      if (response.status === 409 && res.runId) {
        window.dispatchEvent(
          new CustomEvent(BOT_RUN_STARTED_EVENT, { detail: { runId: res.runId } })
        )
        router.refresh()
        return
      }

      setRunning(false)
      router.refresh()
      setToast({
        kind: 'done',
        ok: false,
        msg: responseError(res, 'Search could not be started.'),
      })
    } catch (error) {
      console.error('[bot] Manual search request failed:', error)
      setRunning(false)
      router.refresh()
      setToast({
        kind: 'done',
        ok: false,
        msg: 'Search request was interrupted before it could be queued. Check Runs before starting another run.',
      })
    }
  }

  const profileSource = resumeReadiness.source
  const showSourceWarning = profileSource.tone !== 'ready'
  const resumeActionLabel =
    resumeReadiness.totalCount > 0 ? 'Review resume' : 'Add resume'

  const setupIncomplete = setupReadiness && !setupReadiness.isComplete

  return (
    <div className="flex flex-col gap-2 text-sm">
      {setupIncomplete && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Setup:</span>
          {!setupReadiness.hasResume && (
            <Link href="/bot/setup?section=resume" className="underline hover:text-foreground">
              Add resume
            </Link>
          )}
          {!setupReadiness.hasSearchTerms && (
            <>
              {!setupReadiness.hasResume && <span aria-hidden>·</span>}
              <Link href="/bot/setup?section=search" className="underline hover:text-foreground">
                Add search terms
              </Link>
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span
            aria-hidden
            className={cn(
              'relative inline-flex size-2 rounded-full',
              isActive ? 'bg-success' : 'bg-muted-foreground/50'
            )}
          >
            {isActive && (
              <span className="absolute inset-0 rounded-full bg-success/50 trackd-breath" />
            )}
          </span>
          <span className="font-medium">
            {isActive ? 'Active' : 'Paused'}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{frequencyLabel}</span>
        </span>

        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
            sourceBadgeClass(profileSource)
          )}
          title={profileSource.description}
        >
          Scoring: {profileSource.label}
        </span>

        {liveLastRun && (
          <>
            <span aria-hidden className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">
              Last run{' '}
              <span className="text-foreground" suppressHydrationWarning>
                {mounted ? relativeTime(liveLastRun.startedAt) : 'recently'}
              </span>
              {' · '}
              <span className="text-foreground tabular-nums">{liveLastRun.jobsFound}</span> found
              {' · '}
              <span className="text-foreground tabular-nums">{liveLastRun.jobsNew}</span> new
              {liveLastRun.jobsApproved > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground tabular-nums">{liveLastRun.jobsApproved}</span> approved
                </>
              )}
            </span>
          </>
        )}

        <div className="flex items-center gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !canRun}
            title={!canRun ? runDisabledReason : undefined}
            className={cn(
              'inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium sm:w-auto',
              'bg-primary text-primary-foreground transition-[transform,background-color] duration-150',
              'ease-[var(--ease-ios)] hover:bg-primary/90 active:scale-[0.98]',
              'disabled:opacity-50 disabled:hover:bg-primary disabled:active:scale-100'
            )}
          >
            {running ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" fill="currentColor" />
            )}
            {running ? 'Running…' : 'Run now'}
          </button>
        </div>
      </div>

      {showSourceWarning && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 text-xs',
            profileSource.tone === 'missing'
              ? 'border-error/25 bg-error-bg/50 text-error-text'
              : 'border-warning/25 bg-warning-bg/60 text-warning-text'
          )}
        >
          <AlertCircle className="size-3.5 shrink-0" />
          <span className="font-medium">
            {profileSource.requiresResumeWarning
              ? 'No usable Job Search resume.'
              : 'Scoring limited.'}
          </span>
          <span>{sourceWarningText(profileSource)}</span>
          <Link
            href="/bot/setup?section=resume"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            {resumeActionLabel}
          </Link>
        </div>
      )}

      {toast && (
        <SearchToast toast={toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}

function SearchToast({
  toast,
  onDismiss,
}: {
  toast: { kind: 'done'; ok: boolean; msg: string }
  onDismiss: () => void
}) {
  const isError = !toast.ok

  return (
    <div
      role="status"
      aria-live="polite"
      className="!fixed top-4 right-4 z-[100] max-w-sm w-[min(100%-2rem,22rem)] pointer-events-auto animate-in slide-in-from-top-2 fade-in duration-200"
    >
      <div
        className={cn(
          'glass glass-subtle rounded-xl shadow-lg',
          'px-4 py-3 flex items-start gap-3'
        )}
      >
        <span
          className={cn(
            'shrink-0 mt-0.5',
            isError && 'text-error-text'
          )}
        >
          <AlertCircle className="size-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isError
                ? 'Search failed'
                : 'Search complete'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {toast.msg}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1 rounded-md hover:bg-foreground/[0.04]"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
