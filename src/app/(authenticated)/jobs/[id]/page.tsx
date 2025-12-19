import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { JobDetailView } from '@/components/jobs/job-detail-view'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params
  const user = await requireAuth()

  const job = await prisma.job.findUnique({
    where: { id, userId: user.id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) {
    notFound()
  }

  // Check if user has email integration
  const emailIntegration = await prisma.emailIntegration.findFirst({
    where: { userId: user.id },
  })

  return (
    <div className="size-full flex dark">
      <SimpleTopBar showEmailNotification={!emailIntegration} />
      <Sidebar />
      <div className="flex-1 ml-16 pt-20">
        <JobDetailView job={job} />
      </div>
    </div>
  )
}

