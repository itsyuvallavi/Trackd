'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NotificationType } from '@prisma/client'
import type { JobStatus } from '@prisma/client'
import { Info, CheckCircle2, X, ArrowRight } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import type { SyncCompleteJobChange, SyncStats } from '@/lib/notification-service'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  metadata: unknown
  isRead: boolean
  actionUrl: string | null
  createdAt: string
}

interface SyncCompleteNotificationProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
  onClose: () => void
}

function parseSyncMetadata(metadata: unknown): {
  jobChanges: SyncCompleteJobChange[]
  stats: Partial<SyncStats> | null
} {
  if (!metadata || typeof metadata !== 'object') {
    return { jobChanges: [], stats: null }
  }
  const m = metadata as { stats?: SyncStats; jobChanges?: SyncCompleteJobChange[] }
  const jobChanges = Array.isArray(m.jobChanges) ? m.jobChanges : []
  return { jobChanges, stats: m.stats ?? null }
}

function statusLabel(raw: string | null): string {
  if (!raw) return '—'
  return STATUS_LABELS[raw as JobStatus] ?? raw.replace(/_/g, ' ')
}

export function SyncCompleteNotification({
  notification,
  onMarkAsRead,
  onDismiss,
  onClose,
}: SyncCompleteNotificationProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [fallbackChanges, setFallbackChanges] = useState<SyncCompleteJobChange[] | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState(false)

  const { jobChanges, stats } = parseSyncMetadata(notification.metadata)
  const updatedJobs = stats?.updatedJobs ?? 0
  const processedEmails = stats?.processedEmails ?? null
  const canOpenDetails = updatedJobs > 0

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
    onClose()
  }

  const openDetails = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
    setDetailsOpen(true)
  }

  useEffect(() => {
    if (!detailsOpen) return
    if (jobChanges.length > 0) return
    if (updatedJobs <= 0) return

    let cancelled = false
    setFallbackLoading(true)
    setFallbackChanges(null)

    fetch(`/api/notifications/${notification.id}/sync-job-changes`)
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json() as Promise<{ jobChanges?: SyncCompleteJobChange[] }>
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.jobChanges)) {
          setFallbackChanges(data.jobChanges)
        }
      })
      .catch(() => {
        if (!cancelled) setFallbackChanges([])
      })
      .finally(() => {
        if (!cancelled) setFallbackLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [detailsOpen, notification.id, jobChanges.length, updatedJobs])

  const rows = jobChanges.length > 0 ? jobChanges : (fallbackChanges ?? [])

  return (
    <>
      <div
        className={`flex items-start gap-3 px-3 py-2.5 hover:bg-primary-lightest transition-colors border-b border-border last:border-0 ${
          !notification.isRead ? 'bg-primary-lightest/30' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <div className="mt-0.5 shrink-0">
          <Info className="size-4 text-info" />
        </div>
        <div className="flex-1 min-w-0">
          <div
            role={canOpenDetails ? 'button' : undefined}
            tabIndex={canOpenDetails ? 0 : undefined}
            onClick={(e) => {
              e.stopPropagation()
              if (canOpenDetails) openDetails()
            }}
            onKeyDown={(e) => {
              if (!canOpenDetails) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                openDetails()
              }
            }}
            className={cn(
              'rounded-md outline-none',
              canOpenDetails &&
                'cursor-pointer hover:bg-primary-lightest/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'
            )}
          >
            <p className="text-xs font-medium text-foreground">{notification.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line">
              {notification.message}
            </p>
            {canOpenDetails && (
              <p className="text-[11px] text-primary mt-1 font-medium">Tap to see what changed</p>
            )}
          </div>
          <a
            href={notification.actionUrl || '/jobs'}
            onClick={handleActionClick}
            className="text-xs text-primary hover:underline mt-1 inline-block text-left cursor-pointer relative z-10"
          >
            View jobs →
          </a>
        </div>
        <div className="flex gap-1 shrink-0">
          {!notification.isRead && (
            <button
              type="button"
              onClick={() => onMarkAsRead(notification.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Mark as read"
            >
              <CheckCircle2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => onDismiss(notification.id, e)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <AlertDialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <AlertDialogContent
          className="sm:max-w-lg max-h-[min(85vh,560px)] flex flex-col gap-0 p-0 overflow-hidden data-[size=default]:sm:max-w-lg"
          size="default"
        >
          <AlertDialogHeader className="px-4 pt-4 pb-2 text-left shrink-0 border-b border-border">
            <AlertDialogTitle className="text-sm">Sync updates</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground text-left">
              {processedEmails != null
                ? `Processed ${processedEmails} job-related email${processedEmails === 1 ? '' : 's'}${updatedJobs > 0 ? ` · ${updatedJobs} job update${updatedJobs === 1 ? '' : 's'}` : ''}`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
            {fallbackLoading && jobChanges.length === 0 ? (
              <p className="text-xs text-muted-foreground">Loading update details…</p>
            ) : rows.length > 0 ? (
              rows.map((ch) => (
                <div
                  key={`${ch.jobId}-${ch.emailSubject ?? ''}-${ch.newStatus}`}
                  className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-xs"
                >
                  <div className="font-medium text-foreground leading-snug">{ch.title}</div>
                  <div className="text-muted-foreground">{ch.company}</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {ch.oldStatus ? (
                      <>
                        <Badge className={cn('text-[10px]', STATUS_COLORS[ch.oldStatus as JobStatus])}>
                          {statusLabel(ch.oldStatus)}
                        </Badge>
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                      </>
                    ) : null}
                    <Badge className={cn('text-[10px]', STATUS_COLORS[ch.newStatus as JobStatus])}>
                      {statusLabel(ch.newStatus)}
                    </Badge>
                  </div>
                  {ch.emailSubject ? (
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/80">
                      From email: <span className="text-foreground/90">{ch.emailSubject}</span>
                    </p>
                  ) : null}
                  {ch.interviewAtIso ? (
                    <p className="text-[11px] text-muted-foreground">
                      Interview scheduled:{' '}
                      <span className="text-foreground/90">
                        {new Date(ch.interviewAtIso).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>
                  ) : null}
                  <Link
                    href={`/jobs/${ch.jobId}`}
                    className="inline-block text-[11px] text-primary font-medium hover:underline pt-0.5"
                    onClick={() => {
                      setDetailsOpen(false)
                      onClose()
                    }}
                  >
                    Open job →
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                We couldn&apos;t match this summary to timeline entries. Open the{' '}
                <Link href="/jobs" className="text-primary underline" onClick={() => setDetailsOpen(false)}>
                  jobs board
                </Link>{' '}
                and check each card&apos;s activity — or run another sync after updating the app so details
                are stored on the notification.
              </p>
            )}
          </div>

          <AlertDialogFooter className="px-4 py-3 border-t border-border shrink-0">
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
