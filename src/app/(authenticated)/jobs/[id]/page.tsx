import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { JobDetailView } from '@/components/jobs/job-detail-view'
import { serializeForClient } from '@/lib/serialize-for-client'

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
        <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
          <div className="w-full max-w-[1160px]">
            <JobDetailView job={serializeForClient(job)} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

