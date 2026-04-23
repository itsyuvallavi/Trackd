'use client'

import { Job, Activity } from '@prisma/client'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'
import { MapPin, Clock, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BoardCardProps {
  job: Job & { activities: Activity[] }
  isDragging?: boolean
}

export function BoardCard({ job, isDragging = false }: BoardCardProps) {
  const lastActivity = job.activities[0]

  return (
    <div
      className={cn(
        'group glass glass-subtle rounded-xl p-3 cursor-grab active:cursor-grabbing',
        'transition-[transform,box-shadow,opacity] duration-150 ease-[var(--ease-ios)]',
        'hover:-translate-y-0.5',
        isDragging && 'opacity-40'
      )}
    >
      <Link
        href={`/jobs/${job.id}`}
        className="block"
        onClick={(e) => {
          if (isDragging) e.preventDefault()
        }}
      >
        <h3
          className="font-medium text-sm mb-0.5 text-foreground group-hover:text-primary transition-colors line-clamp-2"
          style={{ viewTransitionName: `job-title-${job.id}` }}
        >
          {job.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-1">{job.company}</p>
      </Link>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {job.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            <span className="truncate max-w-[140px]">{job.location}</span>
          </span>
        )}
        {lastActivity && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" />
            {formatRelativeTime(lastActivity.createdAt)}
          </span>
        )}
      </div>

      {job.nextAction && (
        <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-warning">
          <Zap className="size-3" />
          <span className="truncate">{job.nextAction}</span>
        </div>
      )}
    </div>
  )
}
