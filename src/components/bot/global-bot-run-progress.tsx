'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import {
  BOT_RUN_COMPLETE_EVENT,
  BOT_RUN_STARTED_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

type RunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'

type RunSnapshot = {
  id: string
  status: RunStatus
  jobsFound: number
  jobsNew: number
  jobsEvaluated: number
  jobsApproved: number
  startedAt?: string
  errors?: unknown
}

type ActiveRunResponse = {
  run: RunSnapshot | null
}

type StartedEvent = CustomEvent<{ runId: string }>

function isStartedEvent(event: Event): event is StartedEvent {
  return (
    event.type === BOT_RUN_STARTED_EVENT &&
    'detail' in event &&
    typeof (event as StartedEvent).detail?.runId === 'string'
  )
}

function runningMessage(run: RunSnapshot): string {
  if (run.jobsFound > 0) {
    return `${run.jobsEvaluated}/${run.jobsFound} scored · ${run.jobsNew} saved`
  }
  return 'Searching providers'
}

function completedMessage(run: RunSnapshot): string {
  if (run.status === 'FAILED') return 'Search failed'
  return `${run.jobsFound} found · ${run.jobsNew} saved · ${run.jobsApproved} approved`
}

function elapsedSeconds(startedAt?: string): number | null {
  if (!startedAt) return null
  const started = new Date(startedAt).getTime()
  if (!Number.isFinite(started)) return null
  return Math.max(0, Math.round((Date.now() - started) / 1000))
}

function elapsedLabel(startedAt?: string): string | null {
  const seconds = elapsedSeconds(startedAt)
  if (seconds === null) return null
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

function activeStep(run: RunSnapshot): 'search' | 'score' | 'save' | 'done' {
  if (run.status !== 'RUNNING') return 'done'
  if (run.jobsFound === 0) return 'search'
  if (run.jobsEvaluated < run.jobsFound) return 'score'
  return 'save'
}

function stepState(
  step: 'search' | 'score' | 'save',
  current: ReturnType<typeof activeStep>,
): 'complete' | 'active' | 'pending' {
  const order = { search: 0, score: 1, save: 2, done: 3 }
  if (order[step] < order[current]) return 'complete'
  if (step === current) return 'active'
  return 'pending'
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as T | null
}

export function GlobalBotRunProgress() {
  const [run, setRun] = useState<RunSnapshot | null>(null)
  const [dismissedRunId, setDismissedRunId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadActiveRun() {
      const payload = await fetchJson<ActiveRunResponse>('/api/bot/run/active')
      if (!cancelled && payload?.run) {
        setRun(payload.run)
        setDismissedRunId(null)
      }
    }

    void loadActiveRun()

    const onStarted = (event: Event) => {
      if (!isStartedEvent(event)) return
      setDismissedRunId(null)
      setRun({
        id: event.detail.runId,
        status: 'RUNNING',
        jobsFound: 0,
        jobsNew: 0,
        jobsEvaluated: 0,
        jobsApproved: 0,
        startedAt: new Date().toISOString(),
      })
    }

    window.addEventListener(BOT_RUN_STARTED_EVENT, onStarted)
    return () => {
      cancelled = true
      window.removeEventListener(BOT_RUN_STARTED_EVENT, onStarted)
    }
  }, [])

  useEffect(() => {
    if (!run?.id || run.status !== 'RUNNING') return

    let cancelled = false
    const runId = run.id
    const interval = window.setInterval(async () => {
      const payload = await fetchJson<RunSnapshot>(`/api/bot/run/${encodeURIComponent(runId)}`)
      if (cancelled || !payload) return

      setRun(payload)
      if (payload.status !== 'RUNNING') {
        window.dispatchEvent(new CustomEvent(BOT_RUN_COMPLETE_EVENT))
        window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
      }
    }, 3000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [run?.id, run?.status])

  useEffect(() => {
    if (!run || run.status === 'RUNNING') return
    const timeout = window.setTimeout(() => setDismissedRunId(run.id), 10_000)
    return () => window.clearTimeout(timeout)
  }, [run])

  const visible = run && dismissedRunId !== run.id
  const message = useMemo(() => {
    if (!run) return ''
    return run.status === 'RUNNING' ? runningMessage(run) : completedMessage(run)
  }, [run])
  const step = run ? activeStep(run) : 'search'
  const scoreProgress =
    run && run.jobsFound > 0
      ? Math.min(100, Math.round((run.jobsEvaluated / run.jobsFound) * 100))
      : 0
  const elapsed = run ? elapsedLabel(run.startedAt) : null

  if (!visible) return null

  const failed = run.status === 'FAILED'
  const running = run.status === 'RUNNING'

  return (
    <div className="fixed bottom-24 right-4 z-[90] w-[min(100%-2rem,22rem)] md:bottom-5">
      <div
        className={cn(
          'glass glass-subtle rounded-xl border px-3.5 py-3 shadow-lg',
          failed ? 'border-error/25' : 'border-border/70'
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 shrink-0',
              running && 'text-primary',
              !running && !failed && 'text-success',
              failed && 'text-error-text'
            )}
          >
            {running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : failed ? (
              <AlertCircle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {running ? 'Job search running' : failed ? 'Job search failed' : 'Job search complete'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {message}
              {elapsed && running ? ` · ${elapsed}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-1.5" aria-label="Job search progress">
              {(['search', 'score', 'save'] as const).map((item) => {
                const state = stepState(item, step)
                return (
                  <span
                    key={item}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors',
                      state === 'complete' && 'bg-success/75',
                      state === 'active' && 'bg-primary',
                      state === 'pending' && 'bg-muted',
                      failed && 'bg-error/60',
                    )}
                  />
                )
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{step === 'search' ? 'Searching' : step === 'score' ? 'Scoring' : step === 'save' ? 'Saving' : 'Done'}</span>
              {running && run.jobsFound > 0 && (
                <span className="tabular-nums">{scoreProgress}% scored</span>
              )}
            </div>
            <Link
              href="/bot/runs"
              className="mt-1.5 inline-flex text-xs font-medium text-foreground underline underline-offset-2"
            >
              View run log
            </Link>
          </div>
          {!running && (
            <button
              type="button"
              onClick={() => setDismissedRunId(run.id)}
              className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
            >
              Hide
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
