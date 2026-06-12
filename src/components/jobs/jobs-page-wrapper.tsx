'use client'

import { JobsPageContent } from './jobs-page-content'

interface Job {
  id: string
  company: string
  title: string
  source: string
  importSource?: string | null
  importJobBoard?: string | null
  tags?: string[]
  location: string | null
  status: string
  notes: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

type StatusCounts = {
  SAVED: number
  APPLIED: number
  INTERVIEW: number
  OFFER: number
  REJECTED: number
  ARCHIVED: number
}

interface JobsPageWrapperProps {
  jobs: Job[]
  initialTotal: number
  statusCounts: StatusCounts
  totalApplications: number
}

export function JobsPageWrapper({
  jobs,
  initialTotal,
  statusCounts,
  totalApplications,
}: JobsPageWrapperProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
        <div className="w-full max-w-[1160px]">
          <JobsPageContent
            jobs={jobs}
            initialTotal={initialTotal}
            statusCounts={statusCounts}
            totalApplications={totalApplications}
          />
        </div>
      </div>
    </div>
  )
}
