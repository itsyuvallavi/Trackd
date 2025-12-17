import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TEMP_USER_ID } from '@/lib/constants'
import { Sidebar } from '@/components/layout/Sidebar'
import { JobDetailView } from '@/components/jobs/job-detail-view'

export const dynamic = 'force-dynamic'

interface JobDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { id } = await params

  const job = await prisma.job.findUnique({
    where: { id, userId: TEMP_USER_ID },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) {
    notFound()
  }

  return (
    <div className="size-full flex dark">
      <Sidebar />
      <div className="flex-1 ml-16">
        <JobDetailView job={job} />
      </div>
    </div>
  )
}

