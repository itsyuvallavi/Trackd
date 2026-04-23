'use client'

import { JobsPageContent } from './jobs-page-content'

interface Job {
  id: string
  company: string
  title: string
  source: string
  location: string | null
  status: string
  notes: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

interface JobsPageWrapperProps {
  jobs: Job[]
}

export function JobsPageWrapper({ jobs }: JobsPageWrapperProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
        <div className="w-full max-w-[1160px]">
          <JobsPageContent jobs={jobs} />
        </div>
      </div>
    </div>
  )
}
