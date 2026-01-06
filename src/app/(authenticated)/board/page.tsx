import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import dynamic from 'next/dynamic'
import { JobStatus } from '@prisma/client'
import { getEmailIntegration } from '@/lib/cached-queries'

// Lazy load KanbanBoard since it's a heavy component with drag-and-drop
const KanbanBoard = dynamic(() => import('@/components/board/kanban-board').then(mod => ({ default: mod.KanbanBoard })), {
  loading: () => <div className="animate-pulse text-center py-8 text-muted-foreground">Loading board...</div>,
})

export const revalidate = 60 // Revalidate every 60 seconds

const COLUMNS: { status: JobStatus; label: string; color: string }[] = [
  { status: 'SAVED', label: 'Saved', color: 'bg-muted' },
  { status: 'APPLIED', label: 'Applied', color: 'bg-info-bg' },
  { status: 'INTERVIEW', label: 'Interview', color: 'bg-purple-100 dark:bg-purple-900/30' },
  { status: 'OFFER', label: 'Offer', color: 'bg-success-bg' },
  { status: 'REJECTED', label: 'Rejected', color: 'bg-error-bg' },
  { status: 'ARCHIVED', label: 'Archived', color: 'bg-warning-bg' },
]

export default async function BoardPage() {
  const user = await requireAuth()

  // Fetch jobs and email integration in parallel
  const [jobs, emailIntegration] = await Promise.all([
    prisma.job.findMany({
      where: { userId: user.id },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    getEmailIntegration(user.id),
  ])

  // Group jobs by status
  const jobsByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.status] = jobs.filter(job => job.status === column.status)
    return acc
  }, {} as Record<JobStatus, typeof jobs>)

  const totalJobs = jobs.length
  const activeJobs = jobs.filter(j => ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status)).length

  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold mb-2">Board</h1>
            <p className="text-sm text-muted-foreground">
              {totalJobs} total jobs • {activeJobs} active
            </p>
          </div>

          <KanbanBoard columns={COLUMNS} jobsByStatus={jobsByStatus} />
        </div>
      </div>
    </AppShell>
  )
}
