import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'

export const dynamic = 'force-dynamic'

export default async function JobsPage() {
  const user = await requireAuth()

  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    include: {
      activities: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { savedAt: 'desc' },
  })

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <SimpleTopBar showEmailNotification={!emailIntegration} />
      <div
        className="flex-1 flex flex-col bg-muted/10"
        style={{ marginLeft: '4rem' }}
      >
        <div className="flex-1 overflow-auto pt-[88px]">
          <div className="max-w-[1600px] mx-auto px-8 py-6">
            <JobsPageContent jobs={jobs} />
          </div>
        </div>
      </div>
    </div>
  )
}
