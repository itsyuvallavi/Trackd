import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()

  // Pagination: Load first 100 jobs initially (sufficient for most users)
  // For users with 100+ jobs, this reduces initial load time significantly
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      status: true,
      priority: true,
      source: true,
      url: true,
      savedAt: true,
      appliedAt: true,
      interviewAt: true,
      nextAction: true,
      tags: true,
      notes: true,
      salary: true,
      contactName: true,
      contactEmail: true,
      createdAt: true,
      updatedAt: true,
      activities: {
        orderBy: { createdAt: 'asc' },
        take: 5, // Limit to 5 most recent activities for initial load
        select: {
          id: true,
          type: true,
          fromStatus: true,
          toStatus: true,
          createdAt: true,
          description: true,
        },
      },
    },
    orderBy: { savedAt: 'desc' },
    take: 100, // Initial page size
  })

  const emailIntegration = await prisma.emailIntegration.findUnique({
    where: { userId: user.id },
  })

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <JobsPageContent jobs={jobs} />
        </div>
      </div>
    </AppShell>
  )
}
