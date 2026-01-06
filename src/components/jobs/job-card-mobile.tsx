'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
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
  index?: number
}

export function JobCardMobile({ job, index = 0 }: JobCardMobileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.02,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileTap={{ scale: 0.98 }}
      className="bg-card border border-border rounded p-3 shadow-sm active:shadow-md transition-shadow"
    >
      {/* Ultra compact single row */}
      <div className="flex items-center gap-1.5">
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <h3 className="text-xs font-medium text-foreground line-clamp-1 hover:text-primary transition-colors">
            {job.title}
          </h3>
          <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
            {job.company}{job.location && ` • ${job.location}`}
          </p>
        </Link>
        <div className="flex items-center gap-1 shrink-0">
          {job.notes && (
            <StickyNote className="size-2.5 text-muted-foreground/60" />
          )}
          <div className="min-h-[22px] flex items-center">
            <StatusDropdown jobId={job.id} currentStatus={job.status as any} />
          </div>
          <JobActionsMenu jobId={job.id} />
        </div>
      </div>
    </motion.div>
  )
}
