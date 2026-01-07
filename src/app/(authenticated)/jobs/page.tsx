import { requireAuth } from '@/lib/auth'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'
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
        <div className="flex-1 overflow-auto">
          <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
            <div className="w-full max-w-[1160px]">
              <JobsPageContent jobs={jobs} />
            </div>
          </div>
        </div>
      </Suspense>
    </AppShell>
  )
}
