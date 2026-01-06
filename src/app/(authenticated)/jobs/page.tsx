import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { JobsPageContent } from '@/components/jobs/jobs-page-content'
import { AppShell } from '@/components/layout/app-shell'
import { getEmailIntegration } from '@/lib/cached-queries'

export const revalidate = 60 // Revalidate every 60 seconds

export default async function JobsPage() {
  const user = await requireAuth()

  // Fetch jobs and email integration - minimal queries for performance
  // Removed auto-archive to reduce database writes and connection usage
  const [jobs, emailIntegration] = await Promise.all([
    prisma.job.findMany({
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
      },
      orderBy: { savedAt: 'desc' },
      take: 100,
    }),
    getEmailIntegration(user.id),
  ])

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6 min-h-0">
          <div className="w-full max-w-[1160px]">
            <JobsPageContent jobs={jobs} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
