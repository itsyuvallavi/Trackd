import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InterviewSessionPageContent } from '@/components/interview/interview-session-page-content'
import { AppShell } from '@/components/layout/app-shell'
import { serializeForClient } from '@/lib/serialize-for-client'

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const user = await requireAuth()
  const { sessionId } = await params

  const session = await prisma.interviewSession.findFirst({
    where: {
      id: sessionId,
      userId: user.id,
    },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          notes: true,
          url: true,
          interviewAt: true,
        },
      },
      messages: {
        orderBy: {
          timestamp: 'asc',
        },
      },
    },
  })

  if (!session) {
    redirect('/interview-prep')
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="w-full flex justify-center px-4 md:px-8 py-4 md:py-6">
          <div className="w-full max-w-[1160px]">
            <InterviewSessionPageContent session={serializeForClient(session)} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}

