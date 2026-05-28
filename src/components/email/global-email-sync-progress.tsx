'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import {
  EMAIL_SYNC_COMPLETE_EVENT,
  EMAIL_SYNC_STARTED_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

type EmailSyncStatus = 'RUNNING' | 'COMPLETED' | 'FAILED'

type EmailSyncSnapshot = {
  id: string
  status: EmailSyncStatus
  startedAt: string
  completedAt: string | null
  progressState: string
  reviewedEmails: number
  totalEmails: number
  processedEmails: number
  skippedEmails: number
  ambiguousMatches: number
  newJobsDetected: number
  noMatches: number
  jobsUpdated: number
  notificationsCreated: number
  errorMessage?: string | null
}

type ActiveEmailSyncResponse = {
  sync: EmailSyncSnapshot | null
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) return null
  return (await response.json().catch(() => null)) as T | null
}

function elapsedLabel(startedAt?: string): string | null {
  if (!startedAt) return null
  const started = new Date(startedAt).getTime()
  if (!Number.isFinite(started)) return null
  const seconds = Math.max(0, Math.round((Date.now() - started) / 1000))
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function activeStep(sync: EmailSyncSnapshot): 'fetch' | 'review' | 'write' | 'done' {
  if (sync.status !== 'RUNNING') return 'done'
  if (sync.totalEmails === 0 || sync.progressState === 'fetching') return 'fetch'
  if (sync.reviewedEmails < sync.totalEmails) return 'review'
  return 'write'
}

function stepState(
  step: 'fetch' | 'review' | 'write',
  current: ReturnType<typeof activeStep>,
): 'complete' | 'active' | 'pending' {
  const order = { fetch: 0, review: 1, write: 2, done: 3 }
  if (order[step] < order[current]) return 'complete'
  if (step === current) return 'active'
  return 'pending'
}

function runningMessage(sync: EmailSyncSnapshot): string {
  if (sync.totalEmails > 0) {
    return `${sync.reviewedEmails}/${sync.totalEmails} reviewed · ${sync.jobsUpdated} updated · ${sync.ambiguousMatches + sync.newJobsDetected + sync.noMatches} findings`
  }
  return 'Fetching messages'
}

function completedMessage(sync: EmailSyncSnapshot): string {
  if (sync.status === 'FAILED') return sync.errorMessage || 'Email sync failed'
  return `${sync.processedEmails} job-related · ${sync.jobsUpdated} updated · ${sync.ambiguousMatches + sync.newJobsDetected + sync.noMatches} findings`
}

function pendingSnapshot(): EmailSyncSnapshot {
  return {
    id: 'pending-email-sync',
    status: 'RUNNING',
    startedAt: new Date().toISOString(),
    completedAt: null,
    progressState: 'fetching',
    reviewedEmails: 0,
    totalEmails: 0,
    processedEmails: 0,
    skippedEmails: 0,
    ambiguousMatches: 0,
    newJobsDetected: 0,
    noMatches: 0,
    jobsUpdated: 0,
    notificationsCreated: 0,
  }
}

export function GlobalEmailSyncProgress() {
  const [sync, setSync] = useState<EmailSyncSnapshot | null>(null)
  const [dismissedSyncId, setDismissedSyncId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadActiveSync() {
      const payload = await fetchJson<ActiveEmailSyncResponse>('/api/email-sync/active')
      if (!cancelled && payload?.sync?.status === 'RUNNING') {
        setSync(payload.sync)
        setDismissedSyncId(null)
      }
    }

    void loadActiveSync()

    const onStarted = () => {
      setDismissedSyncId(null)
      setSync(pendingSnapshot())
      window.setTimeout(async () => {
        const payload = await fetchJson<ActiveEmailSyncResponse>('/api/email-sync/active')
        if (payload?.sync) setSync(payload.sync)
      }, 1200)
    }

    window.addEventListener(EMAIL_SYNC_STARTED_EVENT, onStarted)
    return () => {
      cancelled = true
      window.removeEventListener(EMAIL_SYNC_STARTED_EVENT, onStarted)
    }
  }, [])

  useEffect(() => {
    if (!sync || sync.status !== 'RUNNING') return

    let cancelled = false
    const interval = window.setInterval(async () => {
      const payload = await fetchJson<ActiveEmailSyncResponse>('/api/email-sync/active')
      if (cancelled) return

      if (payload?.sync) {
        setSync(payload.sync)
        if (payload.sync.status !== 'RUNNING') {
          window.dispatchEvent(new CustomEvent(EMAIL_SYNC_COMPLETE_EVENT))
          window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
        }
      }
    }, 2500)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [sync?.id, sync?.status])

  useEffect(() => {
    if (!sync || sync.status === 'RUNNING') return
    const timeout = window.setTimeout(() => setDismissedSyncId(sync.id), 12_000)
    return () => window.clearTimeout(timeout)
  }, [sync])

  const visible = sync && dismissedSyncId !== sync.id
  const step = sync ? activeStep(sync) : 'fetch'
  const progress =
    sync && sync.totalEmails > 0
      ? Math.min(100, Math.round((sync.reviewedEmails / sync.totalEmails) * 100))
      : 0
  const elapsed = sync ? elapsedLabel(sync.startedAt) : null
  const message = useMemo(() => {
    if (!sync) return ''
    return sync.status === 'RUNNING' ? runningMessage(sync) : completedMessage(sync)
  }, [sync])

  if (!visible) return null

  const running = sync.status === 'RUNNING'
  const failed = sync.status === 'FAILED'

  return (
    <div className="fixed right-4 top-24 z-[91] w-[min(100%-2rem,22rem)] md:right-5">
      <div
        className={cn(
          'glass glass-subtle rounded-xl border px-3.5 py-3 shadow-lg',
          failed ? 'border-error/25' : 'border-border/70',
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'mt-0.5 shrink-0',
              running && 'text-primary',
              !running && !failed && 'text-success',
              failed && 'text-error-text',
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
              {running ? 'Email sync running' : failed ? 'Email sync failed' : 'Email sync complete'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {message}
              {elapsed && running ? ` · ${elapsed}` : ''}
            </p>
            <div className="mt-2 flex items-center gap-1.5" aria-label="Email sync progress">
              {(['fetch', 'review', 'write'] as const).map((item) => {
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
              <span>
                {step === 'fetch' ? 'Fetching' : step === 'review' ? 'AI reviewing' : step === 'write' ? 'Saving' : 'Done'}
              </span>
              {running && sync.totalEmails > 0 && (
                <span className="tabular-nums">{progress}% reviewed</span>
              )}
            </div>
            <Link
              href="/settings/integrations/logs"
              className="mt-1.5 inline-flex text-xs font-medium text-foreground underline underline-offset-2"
            >
              View sync log
            </Link>
          </div>
          {!running && (
            <button
              type="button"
              onClick={() => setDismissedSyncId(sync.id)}
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
