'use client'

import Link from 'next/link'
import { StickyNote } from 'lucide-react'
import { StatusDropdown } from './status-dropdown'
import { JobActionsMenu } from './job-actions-menu'
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
      className="glass glass-subtle rounded-2xl p-3 active:scale-[0.99] transition-transform duration-150 ease-[var(--ease-ios)] animate-in fade-in"
      style={{ animationDelay: `${Math.min(index, 12) * 20}ms`, animationDuration: '260ms' }}
    >
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className={cn(
            'w-[3px] h-8 rounded-full shrink-0',
            statusAccent[job.status] || 'bg-muted'
          )}
        />
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0 block">
          <h3
            className="text-xs font-medium text-foreground line-clamp-1 hover:text-primary transition-colors"
            style={{ viewTransitionName: `job-title-${job.id}` }}
          >
            {job.title}
          </h3>
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
            {job.company}
            {job.location && ` · ${job.location}`}
          </p>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {job.notes && (
            <StickyNote className="size-2.5 text-muted-foreground/60" />
          )}
          <div className="min-h-[22px] flex items-center">
            <StatusDropdown
              jobId={job.id}
              currentStatus={job.status as JobStatus}
              onOptimisticStatus={onStatusOptimistic}
              onStatusCommitFailed={onStatusCommitFailed}
            />
          </div>
          <JobActionsMenu
            jobId={job.id}
            jobTitle={job.title}
            jobCompany={job.company}
          />
        </div>
      </div>
    </div>
  )
}
