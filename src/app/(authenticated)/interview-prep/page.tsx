import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { InterviewPrepPageContent } from '@/components/interview/interview-prep-page-content'
import { AppShell } from '@/components/layout/app-shell'

export const revalidate = 60

export default async function InterviewPrepPage() {
  const user = await requireAuth()

  // Fetch user's jobs for job selector
  const jobs = await prisma.job.findMany({
    where: {
      userId: user.id,
      status: {
        in: ['SAVED', 'APPLIED', 'INTERVIEW'],
      },
    },
    select: {
      id: true,
      title: true,
      company: true,
      status: true,
    },
    orderBy: {
      savedAt: 'desc',
    },
    take: 50,
  })

  // Fetch recent interview sessions
  const sessions = await prisma.interviewSession.findMany({
    where: {
      userId: user.id,
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  })

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-4 md:px-8 py-4 md:py-6">
          <div className="w-full max-w-[1160px]">
            <InterviewPrepPageContent jobs={jobs} sessions={sessions} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

