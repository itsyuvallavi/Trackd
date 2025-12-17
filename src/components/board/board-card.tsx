'use client'

import { Job, Activity } from '@prisma/client'
import { formatRelativeTime } from '@/lib/utils'
import Link from 'next/link'

interface BoardCardProps {
  job: Job & { activities: Activity[] }
  isDragging?: boolean
}

export function BoardCard({ job, isDragging = false }: BoardCardProps) {
  const lastActivity = job.activities[0]

  return (
    <div
      className={`bg-background border border-foreground/20 rounded-lg p-3 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <Link
        href={`/jobs/${job.id}`}
        className="block"
        onClick={(e) => {
          // Prevent navigation when dragging
          if (isDragging) {
            e.preventDefault()
          }
        }}
      >
        <h3 className="font-medium text-sm mb-1 hover:text-blue-600 dark:hover:text-blue-400">
          {job.title}
        </h3>
        <p className="text-xs text-foreground/60 mb-2">{job.company}</p>
      </Link>

      {job.location && (
        <p className="text-xs text-foreground/50 mt-2">📍 {job.location}</p>
      )}

      {lastActivity && (
        <p className="text-xs text-foreground/40 mt-2">
          {formatRelativeTime(lastActivity.createdAt)}
        </p>
      )}

      {job.nextAction && (
        <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
          ⚡ {job.nextAction}
        </p>
      )}
    </div>
  )
}
