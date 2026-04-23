'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GlassPanel, GlassPill } from '@/components/ui/glass'
import {
  AlertCircle,
  Mail,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import { JobStatus } from '@prisma/client'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { STATUS_DOT_COLOR, STATUS_LABELS } from '@/lib/constants'

interface MatchedJob {
  id: string
  title: string
  company: string
  location: string | null
  status: JobStatus
  url: string | null
  appliedAt: Date | null
  interviewAt: Date | null
}

interface AmbiguousMatchResolverProps {
  notificationId: string
  emailSubject: string
  emailFrom: string
  emailDate: string
  matchedJobs: MatchedJob[]
  suggestedStatus?: string
  emailType?: string
  emailTextBody?: string
}

export function AmbiguousMatchResolver({
  notificationId,
  emailSubject,
  emailFrom,
  emailDate,
  matchedJobs,
  suggestedStatus,
  emailTextBody,
}: AmbiguousMatchResolverProps) {
  const router = useRouter()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null)

  const handleSelectJob = async (jobId: string) => {
    if (isProcessing) return

    setSelectedJobId(jobId)
    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/notifications/${notificationId}/resolve-ambiguous`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            suggestedStatus,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resolve ambiguous match')
      }

      await response.json()

      setResolvedJobId(jobId)
      // Fade the non-selected rows before navigating away.
      setTimeout(() => {
        router.push(`/jobs/${jobId}`)
      }, 380)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsProcessing(false)
      setSelectedJobId(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="shrink-0 size-9 rounded-xl grid place-items-center bg-warning-bg border border-warning/20">
            <AlertCircle className="size-4 text-warning-text" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Resolve ambiguous match
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          An email could match multiple jobs. Pick which one it refers to.
        </p>
      </div>

      {/* Email Details */}
      <GlassPanel className="rounded-2xl p-5 md:p-6">
        <h2 className="text-sm font-semibold tracking-tight mb-4 flex items-center gap-2 text-foreground/80">
          <Mail className="size-4" />
          Email details
        </h2>
        <dl className="space-y-2.5 text-sm">
          <Row label="From">
            <span className="text-foreground break-words">{emailFrom}</span>
          </Row>
          <Row label="Subject">
            <span className="text-foreground break-words">{emailSubject}</span>
          </Row>
          <Row label="Date">
            <span className="text-foreground inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatDate(emailDate)}</span>
            </span>
          </Row>
          {suggestedStatus && (
            <Row label="Suggested">
              <span className="text-foreground capitalize">
                {suggestedStatus.toLowerCase()}
              </span>
            </Row>
          )}
        </dl>
        {emailTextBody && (
          <details className="mt-4">
            <summary className="cursor-pointer text-primary hover:underline font-medium text-sm">
              View email content
            </summary>
            <div className="mt-3 p-4 rounded-xl bg-foreground/[0.04] text-sm whitespace-pre-wrap max-h-96 overflow-y-auto border border-border/60">
              {emailTextBody}
            </div>
          </details>
        )}
      </GlassPanel>

      {/* Matched Jobs */}
      <div>
        <h2 className="text-sm font-semibold tracking-tight mb-3 text-foreground/80">
          Select the job this email refers to
        </h2>
        <ul className="space-y-2.5">
          {matchedJobs.map((job) => {
            const isSelected = selectedJobId === job.id
            const isResolvedTarget = resolvedJobId === job.id
            const isFadingOut =
              resolvedJobId !== null && resolvedJobId !== job.id

            return (
              <li
                key={job.id}
                className={cn(
                  'glass glass-subtle rounded-2xl p-4 transition-all duration-300 ease-[var(--ease-ios)]',
                  isSelected && 'ring-1 ring-primary/40 bg-primary/5',
                  isFadingOut && 'opacity-0 translate-y-1',
                  isResolvedTarget && 'ring-1 ring-success/40'
                )}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2">
                      <div className="shrink-0 size-9 rounded-xl grid place-items-center bg-foreground/[0.04] border border-border/40 mt-0.5">
                        <Building2 className="size-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-base text-foreground break-words">
                          {job.title}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {job.company}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground tabular-nums">
                          {job.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {job.location}
                            </span>
                          )}
                          <GlassPill
                            variant="subtle"
                            className="text-[10px] tabular-nums inline-flex items-center gap-1.5"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                'size-1.5 rounded-full',
                                STATUS_DOT_COLOR[job.status]
                              )}
                            />
                            {STATUS_LABELS[job.status]}
                          </GlassPill>
                          {job.appliedAt && (
                            <span suppressHydrationWarning>
                              Applied{' '}
                              {new Date(job.appliedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {job.url && (
                      <Link
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      >
                        <ExternalLink className="size-3" />
                        View job posting
                      </Link>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSelectJob(job.id)}
                    disabled={isProcessing}
                    className="shrink-0 rounded-full min-w-[108px]"
                    variant={isSelected ? 'default' : 'outline'}
                  >
                    {isResolvedTarget ? (
                      <>
                        <CheckCircle2 className="size-4 mr-1.5" />
                        Linked
                      </>
                    ) : isSelected && isProcessing ? (
                      <>
                        <Loader2 className="size-4 mr-1.5 animate-spin" />
                        Linking…
                      </>
                    ) : (
                      'Select'
                    )}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="glass glass-subtle rounded-2xl border-error/30 bg-error-bg/50 p-4 text-error-text">
          <p className="font-medium text-sm">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Cancel/Dismiss Option */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE',
              })
              router.push('/jobs')
            } catch (err) {
              console.error('Error dismissing notification:', err)
            }
          }}
          disabled={isProcessing}
          className="rounded-full"
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </dt>
      <dd className="flex-1 min-w-0">{children}</dd>
    </div>
  )
}
