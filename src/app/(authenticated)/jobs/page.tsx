import { requireAuth } from '@/lib/auth'
import { JobsPageWrapper } from '@/components/jobs/jobs-page-wrapper'
import { AppShell } from '@/components/layout/app-shell'
import { getUserJobsListRows } from '@/lib/cached-queries'
import { serializeForClient } from '@/lib/serialize-for-client'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()
  const jobs = await getUserJobsListRows(user.id)

  return (
    <AppShell>
      <JobsPageWrapper jobs={serializeForClient(jobs)} />
    </AppShell>
  )
}
