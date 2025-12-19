import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { SimpleTopBar } from '@/components/layout/simple-top-bar'
import { KanbanBoard } from '@/components/board/kanban-board'
import { JobStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'SAVED', label: 'Saved', color: 'bg-gray-100 dark:bg-gray-800' },
  { status: 'APPLIED', label: 'Applied', color: 'bg-blue-100 dark:bg-blue-900' },
  { status: 'INTERVIEW', label: 'Interview', color: 'bg-purple-100 dark:bg-purple-900' },
  { status: 'OFFER', label: 'Offer', color: 'bg-green-100 dark:bg-green-900' },
  { status: 'REJECTED', label: 'Rejected', color: 'bg-red-100 dark:bg-red-900' },
  { status: 'GHOSTED', label: 'Ghosted', color: 'bg-orange-100 dark:bg-orange-900' },
]

export default async function BoardPage() {
  const user = await requireAuth()

  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Group jobs by status
  const jobsByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.status] = jobs.filter(job => job.status === column.status)
    return acc
  }, {} as Record<JobStatus, typeof jobs>)

  const totalJobs = jobs.length
  const activeJobs = jobs.filter(j => ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status)).length

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
            <div className="mb-8">
              <h1 className="text-3xl font-bold">Board</h1>
              <p className="text-foreground/60 mt-1">
                {totalJobs} total jobs • {activeJobs} active
              </p>
            </div>

            <KanbanBoard columns={COLUMNS} jobsByStatus={jobsByStatus} />
          </div>
        </div>
      </div>
    </div>
  )
}
