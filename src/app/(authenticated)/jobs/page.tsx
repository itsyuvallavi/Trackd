import { requireAuth } from '@/lib/auth'
import { JobsPageWrapper } from '@/components/jobs/jobs-page-wrapper'
import { AppShell } from '@/components/layout/app-shell'
import { getEmailIntegration, getUserJobs } from '@/lib/cached-queries'
import { Suspense } from 'react'
import { JobsListSkeleton } from '@/components/jobs/jobs-list-skeleton'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()

  // Use cached queries - React cache deduplicates requests within the same render
  // This significantly improves TTFB by avoiding duplicate database queries
  const [jobs, emailIntegration] = await Promise.all([
    getUserJobs(user.id),
    getEmailIntegration(user.id),
  ])

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsPageWrapper jobs={jobs} />
      </Suspense>
    </AppShell>
  )
}
