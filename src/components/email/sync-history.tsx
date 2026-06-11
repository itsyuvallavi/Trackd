'use client'

import type { ReactNode } from 'react'
import { useState, useEffect } from 'react'
import { Clock, CheckCircle2, Loader2, XCircle, RefreshCw } from 'lucide-react'
import { EMAIL_SYNC_COMPLETE_EVENT } from '@/lib/constants'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SyncLog {
  id: string
  startedAt: string
  completedAt: string | null
  duration: number | null
  source: 'manual' | 'auto' | 'cron'
  totalEmails: number
  processedEmails: number
  skippedEmails: number
  exactMatches: number
  fuzzyMatches: number
  ambiguousMatches: number
  newJobsDetected: number
  noMatches: number
  jobsUpdated: number
  notificationsCreated: number
  success: boolean
  errorMessage: string | null
  createdAt: string
}

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function sourceLabel(source: SyncLog['source']): string {
  if (source === 'manual') return 'Manual'
  if (source === 'cron') return 'Scheduled'
  return 'Auto'
}

function reviewCount(log: SyncLog): number {
  return log.ambiguousMatches + log.newJobsDetected + log.noMatches
}

function changedCount(log: SyncLog): number {
  return log.jobsUpdated + log.newJobsDetected
}

function matchedCount(log: SyncLog): number {
  return log.exactMatches + log.fuzzyMatches
}

function SyncSummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: number
  hint: string
}) {
  return (
    <div className="glass glass-subtle rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function SyncMetric({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function SyncSignal({
  tone,
  children,
}: {
  tone: 'success' | 'warning' | 'error' | 'muted'
  children: ReactNode
}) {
  const styles = {
    success: 'border-success/25 bg-success-bg text-success-text',
    warning: 'border-warning/25 bg-warning-bg text-warning-text',
    error: 'border-error/25 bg-error-bg/50 text-error-text',
    muted: 'border-border bg-muted/30 text-muted-foreground',
  } satisfies Record<typeof tone, string>

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
        styles[tone]
      )}
    >
      {children}
    </span>
  )
}

function StatusBadge({ log }: { log: SyncLog }) {
  const running = !log.completedAt
  const styles = running
    ? 'border-info/25 bg-info-bg text-info-text'
    : log.success
      ? 'border-success/25 bg-success-bg text-success-text'
      : 'border-error/25 bg-error-bg text-error-text'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        styles
      )}
    >
      {running ? (
        <Loader2 className="size-3 animate-spin" />
      ) : log.success ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {running ? 'running' : log.success ? 'completed' : 'failed'}
    </span>
  )
}

function SyncDetailsOverview({ log }: { log: SyncLog }) {
  const rows = [
    { label: 'Matched emails', value: matchedCount(log) },
    { label: 'Needs review', value: reviewCount(log) },
    { label: 'Skipped', value: log.skippedEmails },
  ]

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {row.label}
          </p>
          <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">
            {row.value}
          </p>
        </div>
      ))}
    </div>
  )
}

export function SyncHistory() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void fetchLogs()
    const onSyncComplete = () => void fetchLogs()
    window.addEventListener(EMAIL_SYNC_COMPLETE_EVENT, onSyncComplete)
    return () => {
      window.removeEventListener(EMAIL_SYNC_COMPLETE_EVENT, onSyncComplete)
    }
  }, [])

  useEffect(() => {
    if (!logs.some((log) => !log.completedAt)) return
    const interval = window.setInterval(() => void fetchLogs(), 5000)
    return () => window.clearInterval(interval)
  }, [logs])

  async function fetchLogs() {
    try {
      const response = await fetch('/api/email-sync-logs')
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Error fetching sync logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="glass glass-subtle rounded-2xl p-5 md:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">Sync history</h3>
        </div>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="glass glass-subtle rounded-2xl p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h3 className="text-base font-semibold tracking-tight">
              Sync history
            </h3>
          </div>
          <button
            onClick={fetchLogs}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          No sync history yet. Syncs will appear here after they run.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="text-base font-semibold tracking-tight">
            Sync history
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/integrations/logs"
            className="inline-flex rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Review findings
          </Link>
          <button
            onClick={fetchLogs}
            className="inline-flex rounded-lg border border-border/60 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SyncSummaryCard
          label="Recent syncs"
          value={logs.length}
          hint="Latest mailbox checks"
        />
        <SyncSummaryCard
          label="Emails scanned"
          value={logs.reduce((sum, log) => sum + log.totalEmails, 0)}
          hint="Across visible syncs"
        />
        <SyncSummaryCard
          label="Job changes"
          value={logs.reduce((sum, log) => sum + changedCount(log), 0)}
          hint="Updated or detected"
        />
      </div>

      <div className="space-y-3">
        {logs.map((log) => (
          <article
            key={log.id}
            className="glass glass-subtle rounded-2xl px-4 py-4 md:px-5"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge log={log} />
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(log.startedAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {sourceLabel(log.source)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDuration(log.duration)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <SyncMetric label="Fetched" value={log.totalEmails} />
                  <SyncMetric label="Processed" value={log.processedEmails} />
                  <SyncMetric label="Updated" value={log.jobsUpdated} />
                  <SyncMetric label="New jobs" value={log.newJobsDetected} />
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 md:justify-end">
                {reviewCount(log) > 0 && (
                  <SyncSignal tone="warning">
                    {reviewCount(log)} needs review
                  </SyncSignal>
                )}
                {changedCount(log) > 0 && (
                  <SyncSignal tone="success">
                    {changedCount(log)} job changes
                  </SyncSignal>
                )}
                {!log.completedAt && (
                  <SyncSignal tone="muted">In progress</SyncSignal>
                )}
                {log.completedAt && !log.success && (
                  <SyncSignal tone="error">Needs attention</SyncSignal>
                )}
                {log.completedAt && log.success && reviewCount(log) === 0 && (
                  <SyncSignal tone="success">Clean sync</SyncSignal>
                )}
              </div>
            </div>

            <div className="mt-4">
              <details className="group rounded-xl border border-border/60 bg-background/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Sync details</span>
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                    Show review data
                  </span>
                  <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
                    Hide review data
                  </span>
                </summary>

                <div className="space-y-4 border-t border-border/60 px-3 py-3">
                  <SyncDetailsOverview log={log} />

                  {!log.completedAt && (
                    <p className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning-text">
                      This sync is still running or did not write a completion record.
                    </p>
                  )}

                  {log.completedAt && !log.success && (
                    <p className="rounded-lg border border-error/20 bg-error-bg/30 px-3 py-2 text-xs leading-relaxed text-error-text">
                      Sync failed. Technical details are hidden from the history page.
                    </p>
                  )}

                  {reviewCount(log) > 0 && (
                    <Link
                      href="/settings/integrations/logs"
                      className="inline-flex text-xs font-medium text-primary hover:text-primary/80"
                    >
                      Open review log
                    </Link>
                  )}
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
