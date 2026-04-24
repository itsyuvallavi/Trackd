import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { InterviewPrepPageContent } from '@/components/interview/interview-prep-page-content'
import { AppShell } from '@/components/layout/app-shell'
import { serializeForClient } from '@/lib/serialize-for-client'

export const revalidate = 60

export default async function InterviewPrepPage() {
  const user = await requireAuth()

  const [jobs, sessions] = await Promise.all([
    prisma.job.findMany({
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
    }),
    prisma.interviewSession.findMany({
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
    }),
  ])

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-4 md:px-8 py-4 md:py-6">
          <div className="w-full max-w-[1160px]">
            <InterviewPrepPageContent
              jobs={serializeForClient(jobs)}
              sessions={serializeForClient(sessions)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

