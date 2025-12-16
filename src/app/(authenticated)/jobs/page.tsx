import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { Sidebar } from '@/components/layout/Sidebar'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const jobs = await prisma.job.findMany({
    where: { userId: TEMP_USER_ID },
    include: {
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <JobsPageContent jobs={jobs} />
    </div>
  )
}
