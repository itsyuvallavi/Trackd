'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Play, X, AlertCircle } from 'lucide-react'
import type { ResumeReadinessSource } from '@/lib/bot/profile-source-labels'
import {
  BOT_RUN_COMPLETE_EVENT,
  BOT_RUN_STARTED_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
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

type ManualRunStatusResponse = {
  id: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED'
  jobsFound: number
  jobsNew: number
  jobsEvaluated: number
  jobsApproved: number
  errors?: unknown
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
      return 'Run now will score with Application Identity and search preferences until a usable Job Search resume is available.'
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
}: BotStatusStripProps) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [toast, setToast] = useState<
    | { kind: 'running'; msg?: string }
    | { kind: 'done'; ok: boolean; msg: string }
    | null
  >(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (toast?.kind !== 'done') return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  function completionMessage(res: {
    jobsFound?: number
    jobsNew?: number
    jobsApproved?: number
    jobsHardFiltered?: number
    jobsSkippedLowScore?: number
    jobsEvaluationFailed?: number
  }) {
    const found = res.jobsFound ?? 0
    const saved = res.jobsNew ?? 0
    const approved = res.jobsApproved ?? 0
    const hardFiltered = res.jobsHardFiltered ?? 0
    const belowScore = res.jobsSkippedLowScore ?? 0
    const evalFailed = res.jobsEvaluationFailed ?? 0

    if (evalFailed > 0 && saved === 0) {
      return `Search found ${found} listing${found === 1 ? '' : 's'}, but AI scoring failed. Open Runs for details.`
    }

    if (saved === 0) {
      if (belowScore > 0) {
        const aiLowScore = Math.max(0, belowScore - hardFiltered)
        if (hardFiltered > 0 && aiLowScore === 0) {
          return `Search found ${found} listing${found === 1 ? '' : 's'}, but all matches were filtered by location or seniority. Open Runs for details.`
        }
        return `Search found ${found} listing${found === 1 ? '' : 's'}, but none met your match threshold. Open Runs for reasoning.`
      }
      return `Search finished: ${found} listing${found === 1 ? '' : 's'} found, 0 saved. Open Runs for details.`
    }

    return `Search saved ${saved} new job${saved === 1 ? '' : 's'}${approved > 0 ? `, ${approved} approved` : ''}.`
  }

  function statusMessage(run: ManualRunStatusResponse) {
    if (run.jobsFound > 0) {
      return `Scoring in background: ${run.jobsEvaluated}/${run.jobsFound} evaluated, ${run.jobsNew} saved so far.`
    }
    return 'Search is running in the background. You can leave this page; progress is saved in Runs.'
  }

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

  async function pollRun(runId: string) {
    const deadline = Date.now() + 15 * 60_000
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2500))

      const statusResponse = await fetch(`/api/bot/run/${encodeURIComponent(runId)}`, {
        cache: 'no-store',
      })
      const payload = (await statusResponse.json().catch(() => ({}))) as
        | ManualRunStatusResponse
        | { error?: string }

      if (!statusResponse.ok || !('status' in payload)) {
        throw new Error(responseError(payload, 'Could not read job search status.'))
      }

      if (payload.status === 'RUNNING') {
        setToast({ kind: 'running', msg: statusMessage(payload) })
        continue
      }

      window.dispatchEvent(new CustomEvent(BOT_RUN_COMPLETE_EVENT))
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
      router.refresh()
      setRunning(false)
      setToast({
        kind: 'done',
        ok: payload.status === 'COMPLETED',
        msg:
          payload.status === 'COMPLETED'
            ? completionMessage(payload)
            : responseError(
                payload.errors && typeof payload.errors === 'object'
                  ? (payload.errors as Record<string, unknown>)
                  : {},
                'Search failed. Open Runs for details.'
              ),
      })
      return
    }

    router.refresh()
    setRunning(false)
    setToast({
      kind: 'done',
      ok: false,
      msg: 'Search is still running in the background. Open Runs for live counters before starting another run.',
    })
  }

  async function handleRun() {
    if (running) return
    setRunning(true)
    setToast({ kind: 'running', msg: 'Starting background search…' })

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
        setToast({
          kind: 'running',
          msg: 'Search queued. You can leave this page; progress is saved in Runs.',
        })
        router.refresh()
        await pollRun(res.runId)
        return
      }

      if (response.status === 409 && res.runId) {
        window.dispatchEvent(
          new CustomEvent(BOT_RUN_STARTED_EVENT, { detail: { runId: res.runId } })
        )
        setToast({
          kind: 'running',
          msg: 'A search is already running. Watching that run now.',
        })
        await pollRun(res.runId)
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
    resumeReadiness.totalCount > 0 ? 'Review resumes' : 'Add resume'

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2">
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

        {lastRun && (
          <>
            <span aria-hidden className="text-muted-foreground/50">·</span>
            <span className="text-muted-foreground">
              Last run{' '}
              <span className="text-foreground" suppressHydrationWarning>
                {mounted ? relativeTime(lastRun.startedAt) : 'recently'}
              </span>
              {' · '}
              <span className="text-foreground tabular-nums">{lastRun.jobsFound}</span> found
              {' · '}
              <span className="text-foreground tabular-nums">{lastRun.jobsNew}</span> new
              {lastRun.jobsApproved > 0 && (
                <>
                  {' · '}
                  <span className="text-foreground tabular-nums">{lastRun.jobsApproved}</span> approved
                </>
              )}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRun}
            disabled={running || !canRun}
            title={!canRun ? runDisabledReason : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium',
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
            href="/bot/resumes"
            className="font-medium underline underline-offset-2 hover:text-foreground"
          >
            {resumeActionLabel}
          </Link>
          {profileSource.kind === 'application_identity_fallback' && (
            <>
              <span aria-hidden className="opacity-50">·</span>
              <Link
                href="/bot/identity"
                className="font-medium underline underline-offset-2 hover:text-foreground"
              >
                Identity
              </Link>
            </>
          )}
        </div>
      )}

      {mounted && toast && createPortal(
        <SearchToast toast={toast} onDismiss={() => setToast(null)} />,
        document.body
      )}
    </div>
  )
}

function SearchToast({
  toast,
  onDismiss,
}: {
  toast:
    | { kind: 'running'; msg?: string }
    | { kind: 'done'; ok: boolean; msg: string }
  onDismiss: () => void
}) {
  const isRunning = toast.kind === 'running'
  const isError = toast.kind === 'done' && !toast.ok

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
            isRunning && 'text-primary',
            !isRunning && !isError && 'text-success',
            isError && 'text-error-text'
          )}
        >
          {isRunning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isError ? (
            <AlertCircle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {isRunning
              ? 'Job search running'
              : isError
                ? 'Search failed'
                : 'Search complete'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRunning
              ? toast.msg ?? 'This can take a few minutes; progress is saved in Runs.'
              : toast.kind === 'done'
                ? toast.msg
                : ''}
          </p>
        </div>
        {!isRunning && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors -mr-1 -mt-1 p-1 rounded-md hover:bg-foreground/[0.04]"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
