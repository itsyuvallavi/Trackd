'use client'

import Link from 'next/link'
import { MapPin, StickyNote } from 'lucide-react'
import { StatusDropdown } from './status-dropdown'
import { JobActionsMenu } from './job-actions-menu'

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
}

export function JobCardMobile({ job }: JobCardMobileProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      {/* Header: Title + Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
        </Link>
        <JobActionsMenu jobId={job.id} />
      </div>

      {/* Status + Location Row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <StatusDropdown jobId={job.id} currentStatus={job.status as any} />
        {job.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            <span className="truncate max-w-[120px]">{job.location}</span>
          </div>
        )}
      </div>

      {/* Source + Notes Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{job.source}</span>
        {job.notes && (
          <div className="flex items-center gap-1">
            <StickyNote className="size-3" />
            <span>Has notes</span>
          </div>
        )}
      </div>
    </div>
  )
}
