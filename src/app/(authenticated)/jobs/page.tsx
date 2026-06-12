import { requireAuth } from '@/lib/auth'
import { JobsPageWrapper } from '@/components/jobs/jobs-page-wrapper'
import { AppShell } from '@/components/layout/app-shell'
import { getUserJobsListRows, getUserStatusCounts } from '@/lib/cached-queries'
import { serializeForClient } from '@/lib/serialize-for-client'
import { ACTIVE_APPLICATION_STATUSES } from '@/lib/job-status-groups'

export const revalidate = 60 // Revalidate every 60 seconds
const INITIAL_JOBS_LIMIT = 25

export default async function JobsPage() {
  const user = await requireAuth()
  const [jobs, statusCounts] = await Promise.all([
    getUserJobsListRows(user.id, { limit: INITIAL_JOBS_LIMIT }),
    getUserStatusCounts(user.id),
  ])
  const totalActiveJobs = [...ACTIVE_APPLICATION_STATUSES].reduce(
    (sum, status) => sum + statusCounts[status],
    0,
  )
  const totalApplications = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  )

  return (
    <AppShell>
      <JobsPageWrapper
        jobs={serializeForClient(jobs)}
        initialTotal={totalActiveJobs}
        statusCounts={statusCounts}
        totalApplications={totalApplications}
      />
    </AppShell>
  )
}
