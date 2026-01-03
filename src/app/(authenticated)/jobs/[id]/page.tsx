import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
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
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <JobDetailView job={job} />
      </div>
    </AppShell>
  )
}

