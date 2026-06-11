import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, MailWarning, XCircle } from 'lucide-react'
import { NotificationType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import type { EmailSyncOutcome } from '@/lib/email-sync-outcomes'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Email sync log — Trackd' }

type FindingMetadata = {
  emailSubject?: string
  emailFrom?: string
  emailDate?: string
  emailType?: string
  suggestedStatus?: string
  company?: string
  title?: string
  hasInsufficientInfo?: boolean
  matchedJobs?: Array<{ id: string; title: string; company: string }>
  emailTextBody?: string
  kind?: string
}

type SyncLogDetails = {
  emailOutcomes?: EmailSyncOutcome[]
}

function metadataObject(value: Prisma.JsonValue | null): FindingMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as FindingMetadata
}

function logDetails(value: Prisma.JsonValue | null): SyncLogDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as SyncLogDetails
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

function findingLabel(type: NotificationType, metadata: FindingMetadata): string {
  if (type === 'AMBIGUOUS_MATCH') return 'Needs review'
  if (metadata.hasInsufficientInfo) return 'Unmatched email'
  if (type === 'NEW_JOB_DETECTED') return 'Untracked application'
  if (type === 'SYNC_ERROR') return 'Sync error'
  return 'Sync summary'
}

function findingClass(type: NotificationType, metadata: FindingMetadata): string {
  if (type === 'SYNC_ERROR') return 'border-error/25 bg-error-bg text-error-text'
  if (type === 'AMBIGUOUS_MATCH') return 'border-warning/25 bg-warning-bg text-warning-text'
  if (metadata.hasInsufficientInfo) return 'border-info/25 bg-info-bg text-info-text'
  return 'border-success/25 bg-success-bg text-success-text'
}

function syncReviewCount(log: {
  ambiguousMatches: number
  newJobsDetected: number
  noMatches: number
}): number {
  return log.ambiguousMatches + log.newJobsDetected + log.noMatches
}

function SyncLogMetric({
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

function sourceLabel(source: string): string {
  if (source === 'manual') return 'Manual'
  if (source === 'cron') return 'Scheduled'
  return 'Auto'
}

function changedCount(log: {
  jobsUpdated: number
  newJobsDetected: number
}): number {
  return log.jobsUpdated + log.newJobsDetected
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

function SyncStatusBadge({
  running,
  success,
}: {
  running: boolean
  success: boolean
}) {
  const styles = running
    ? 'border-info/25 bg-info-bg text-info-text'
    : success
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
      ) : success ? (
        <CheckCircle2 className="size-3" />
      ) : (
        <XCircle className="size-3" />
      )}
      {running ? 'running' : success ? 'completed' : 'failed'}
    </span>
  )
}

export default async function EmailSyncLogPage() {
  const user = await requireAuth()

  const [logs, notifications] = await Promise.all([
    prisma.emailSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { startedAt: 'desc' },
      take: 25,
    }),
    prisma.notification.findMany({
      where: {
        userId: user.id,
        type: {
          in: ['AMBIGUOUS_MATCH', 'NEW_JOB_DETECTED', 'SYNC_COMPLETE', 'SYNC_ERROR'],
        },
        NOT: {
          metadata: {
            path: ['kind'],
            equals: 'bot_run',
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  const reviewCount = notifications.filter((notification) => {
    const meta = metadataObject(notification.metadata)
    return notification.type === 'AMBIGUOUS_MATCH' || notification.type === 'NEW_JOB_DETECTED' || meta.hasInsufficientInfo
  }).length
  const reviewFindings = notifications.filter((notification) => {
    const meta = metadataObject(notification.metadata)
    return notification.type === 'AMBIGUOUS_MATCH' || notification.type === 'NEW_JOB_DETECTED' || meta.hasInsufficientInfo
  })
  const syncNotifications = notifications.filter((notification) => !reviewFindings.some((finding) => finding.id === notification.id))

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <header className="mb-6">
          <Link
            href="/settings/integrations"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-4" />
            Email integration
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Email sync log</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Review mailbox findings before creating or updating applications.
              </p>
            </div>
            <div className="text-sm text-muted-foreground tabular-nums">
              {reviewCount} finding{reviewCount === 1 ? '' : 's'} to review
            </div>
          </div>
        </header>

        <section className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-xl font-semibold tracking-tight">Needs review</h2>
            <span className="text-xs text-muted-foreground">
              Ambiguous matches, untracked jobs, and unmatched emails
            </span>
          </div>
          <div className="glass glass-subtle rounded-2xl overflow-hidden">
            {reviewFindings.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">No email findings need review.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {reviewFindings.map((notification) => {
                  const meta = metadataObject(notification.metadata)
                  const label = findingLabel(notification.type, meta)
                  const candidateCount = meta.matchedJobs?.length ?? 0
                  return (
                    <div key={notification.id} className="px-5 py-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${findingClass(notification.type, meta)}`}>
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground flex-1 min-w-[10rem]">
                          {formatDate(notification.createdAt)}
                          {meta.emailType ? ` · ${meta.emailType.toLowerCase().replaceAll('_', ' ')}` : ''}
                        </span>
                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                          >
                            {notification.type === 'AMBIGUOUS_MATCH' ? 'Resolve match' : 'Review'}
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.75fr)]">
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-semibold leading-tight">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {meta.emailDate ? formatDate(meta.emailDate) : 'Email date unavailable'}
                            </p>
                          </div>
                          <p className="text-sm text-foreground/85 whitespace-pre-line">
                            {notification.message}
                          </p>
                          {(meta.title || meta.company || meta.suggestedStatus) && (
                            <div className="grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                              {(meta.title || meta.company) && (
                                <p>
                                  Extracted job: {[meta.title, meta.company].filter(Boolean).join(' @ ')}
                                </p>
                              )}
                              {meta.suggestedStatus && <p>Suggested status: {meta.suggestedStatus}</p>}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-border/60 bg-background/35 p-3">
                          {notification.type === 'AMBIGUOUS_MATCH' ? (
                            <>
                              <p className="text-xs font-medium text-foreground">
                                Candidate jobs ({candidateCount})
                              </p>
                              {meta.matchedJobs && meta.matchedJobs.length > 0 ? (
                                <ul className="mt-2 space-y-2">
                                  {meta.matchedJobs.map((job, index) => (
                                    <li key={job.id} className="rounded-md border border-border/50 bg-card/40 px-3 py-2">
                                      <p className="text-xs font-medium">
                                        {index + 1}. {job.title}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">@ {job.company}</p>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-xs text-muted-foreground">No candidate jobs were stored.</p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-xs font-medium text-foreground">Email context</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {meta.hasInsufficientInfo
                                  ? 'The AI found a job-related email, but not enough company/title detail to safely update an existing application.'
                                  : 'The AI found a job that does not appear to exist in your application list yet.'}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <section className="mb-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold tracking-tight">Recent syncs</h2>
            <span className="text-xs text-muted-foreground">
              Latest 25 mailbox checks
            </span>
          </div>

          {logs.length === 0 ? (
            <div className="glass glass-subtle rounded-2xl px-6 py-10 text-center text-sm text-muted-foreground">
              No email syncs have run yet.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SyncSummaryCard
                  label="Recent syncs"
                  value={logs.length}
                  hint="Visible mailbox checks"
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

              {logs.map((log) => {
                const running = !log.completedAt
                const outcomes = logDetails(log.details).emailOutcomes ?? []
                const needsReview = syncReviewCount(log)
                const changes = changedCount(log)
                return (
                  <article
                    key={log.id}
                    className="glass glass-subtle rounded-2xl px-4 py-4 md:px-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <SyncStatusBadge
                            running={running}
                            success={log.success}
                          />
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
                          <SyncLogMetric label="Fetched" value={log.totalEmails} />
                          <SyncLogMetric label="Processed" value={log.processedEmails} />
                          <SyncLogMetric label="Updated" value={log.jobsUpdated} />
                          <SyncLogMetric label="New jobs" value={log.newJobsDetected} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 md:justify-end">
                        {needsReview > 0 && (
                          <SyncSignal tone="warning">
                            {needsReview} needs review
                          </SyncSignal>
                        )}
                        {changes > 0 && (
                          <SyncSignal tone="success">
                            {changes} job changes
                          </SyncSignal>
                        )}
                        {running && <SyncSignal tone="muted">In progress</SyncSignal>}
                        {!running && !log.success && (
                          <SyncSignal tone="error">Needs attention</SyncSignal>
                        )}
                        {!running && log.success && needsReview === 0 && (
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
                          <div className="grid gap-2 sm:grid-cols-3">
                            <SyncLogMetric
                              label="Matched emails"
                              value={log.exactMatches + log.fuzzyMatches}
                            />
                            <SyncLogMetric
                              label="Needs review"
                              value={needsReview}
                            />
                            <SyncLogMetric
                              label="Skipped"
                              value={log.skippedEmails}
                            />
                          </div>

                          {running && (
                            <p className="rounded-lg border border-warning/25 bg-warning-bg px-3 py-2 text-xs leading-relaxed text-warning-text">
                              This sync is still running or did not write a completion record.
                            </p>
                          )}
                          {!running && !log.success && (
                            <p className="rounded-lg border border-error/20 bg-error-bg/30 px-3 py-2 text-xs leading-relaxed text-error-text">
                              Sync failed. Technical details are hidden from the review page.
                            </p>
                          )}

                          {outcomes.length > 0 && (
                            <details className="text-xs group/outcomes">
                              <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">
                                Email outcomes ({outcomes.length})
                              </summary>
                              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border/60 bg-background/35">
                                <div className="divide-y divide-border/50">
                                  {outcomes.map((outcome) => (
                                    <div
                                      key={`${outcome.index}-${outcome.emailIdentifier}`}
                                      className="px-3 py-2"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium">
                                          {outcome.outcome.replaceAll('_', ' ')}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                                          Email {outcome.index + 1}
                                        </span>
                                        {outcome.classification?.type && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {outcome.classification.type
                                              .toLowerCase()
                                              .replaceAll('_', ' ')}
                                            {typeof outcome.classification.confidence === 'number'
                                              ? ` · ${outcome.classification.confidence}%`
                                              : ''}
                                          </span>
                                        )}
                                      </div>
                                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        {outcome.job
                                          ? `Job: ${outcome.job.title} @ ${outcome.job.company}`
                                          : 'No application was updated.'}
                                        {outcome.match
                                          ? ` · Match: ${outcome.match.confidence}`
                                          : ''}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </details>
                          )}
                        </div>
                      </details>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold tracking-tight mb-3">Sync summaries</h2>
          <div className="glass glass-subtle rounded-2xl overflow-hidden">
            {syncNotifications.length === 0 ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">No sync summaries yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {syncNotifications.map((notification) => {
                  const meta = metadataObject(notification.metadata)
                  const label = findingLabel(notification.type, meta)
                  return (
                    <div key={notification.id} className="px-5 py-4 space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${findingClass(notification.type, meta)}`}>
                          {label}
                        </span>
                        <span className="text-xs text-muted-foreground flex-1 min-w-[10rem]">
                          {formatDate(notification.createdAt)}
                          {meta.emailType ? ` · ${meta.emailType.toLowerCase().replaceAll('_', ' ')}` : ''}
                        </span>
                        {notification.actionUrl && (
                          <Link
                            href={notification.actionUrl}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                          >
                            Review
                            <ExternalLink className="size-3" />
                          </Link>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{notification.title}</p>
                        <p className="text-sm text-foreground/85 whitespace-pre-line mt-1">
                          {notification.message}
                        </p>
                      </div>
                      <div className="grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
                        {(meta.title || meta.company) && (
                          <p>
                            Extracted job: {[meta.title, meta.company].filter(Boolean).join(' @ ')}
                          </p>
                        )}
                        {meta.suggestedStatus && <p>Suggested status: {meta.suggestedStatus}</p>}
                      </div>
                      {meta.matchedJobs && meta.matchedJobs.length > 0 && (
                        <details className="text-xs group">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                            Candidate matches ({meta.matchedJobs.length})
                          </summary>
                          <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
                            {meta.matchedJobs.map((job) => (
                              <li key={job.id}>
                                {job.title}{' '}
                                <span className="text-muted-foreground">@ {job.company}</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <MailWarning className="size-3.5" />
          Email sync now requires AI classification and AI matching. Deterministic code only guards duplicate processing and unsafe status updates.
        </p>
      </div>
      </div>
    </AppShell>
  )
}
