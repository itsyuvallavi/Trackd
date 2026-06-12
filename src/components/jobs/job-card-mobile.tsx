'use client'

import Link from 'next/link'
import { StickyNote } from 'lucide-react'
import { StatusDropdown } from './status-dropdown'
import { cn } from '@/lib/utils'
import type { JobStatus } from '@prisma/client'

const statusAccent: Record<string, string> = {
  SAVED: 'bg-saved',
  APPLIED: 'bg-info',
  INTERVIEW: 'bg-interview',
  OFFER: 'bg-success',
  REJECTED: 'bg-error',
  ARCHIVED: 'bg-warning',
}

interface Job {
  id: string
  company: string
  title: string
  source: string
  location: string | null
  status: string
  notes: string | null
}

interface JobCardMobileProps {
  job: Job
  index?: number
  onStatusOptimistic?: (status: JobStatus) => void
  onStatusCommitFailed?: (revertTo: JobStatus) => void
}

/**
 * Mobile row — glass card with status accent bar on the left.
 * The stagger-in animation uses a CSS-only keyframe (delay via style) so
 * the mobile list doesn't pull in framer-motion just to animate rows.
 */
export function JobCardMobile({
  job,
  index = 0,
  onStatusOptimistic,
  onStatusCommitFailed,
}: JobCardMobileProps) {
  return (
    <div
      className="group relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/82 p-3.5 shadow-[0_14px_42px_-28px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-[transform,border-color,background-color] duration-200 ease-[var(--ease-ios)] active:scale-[0.985] animate-in fade-in slide-in-from-bottom-1"
      style={{
        animationDelay: `${Math.min(index, 12) * 18}ms`,
        animationDuration: '260ms',
      }}
    >
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-3 left-3 w-[3px] rounded-full',
          statusAccent[job.status] || 'bg-muted'
        )}
      />
      <div className="flex items-center gap-3 pl-3">
        <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1 block">
          <h3
            className="text-sm font-semibold leading-tight text-foreground line-clamp-1 transition-colors group-hover:text-primary"
            style={{ viewTransitionName: `job-title-${job.id}` }}
          >
            {job.title}
          </h3>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-1">
            {job.company}
            {job.location && (
              <span className="text-muted-foreground/75"> · {job.location}</span>
            )}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          {job.notes && (
            <StickyNote className="size-3 text-muted-foreground/60" />
          )}
          <StatusDropdown
            jobId={job.id}
            currentStatus={job.status as JobStatus}
            onOptimisticStatus={onStatusOptimistic}
            onStatusCommitFailed={onStatusCommitFailed}
          />
        </div>
      </div>
    </div>
  )
}
