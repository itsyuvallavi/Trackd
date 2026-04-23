import { requireAuth } from '@/lib/auth'
import { JobsPageWrapper } from '@/components/jobs/jobs-page-wrapper'
import { AppShell } from '@/components/layout/app-shell'
import { getUserJobs } from '@/lib/cached-queries'
import { serializeForClient } from '@/lib/serialize-for-client'
import { Suspense } from 'react'
import { JobsListSkeleton } from '@/components/jobs/jobs-list-skeleton'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()
  const jobs = await getUserJobs(user.id)

  return (
    <AppShell>
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsPageWrapper jobs={serializeForClient(jobs)} />
      </Suspense>
    </AppShell>
  )
}
