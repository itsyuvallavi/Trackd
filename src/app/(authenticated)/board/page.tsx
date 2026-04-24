import { requireAuth } from '@/lib/auth'
import { AppShell } from '@/components/layout/app-shell'
import dynamic from 'next/dynamic'
import { Activity, Job, JobStatus } from '@prisma/client'
import { serializeForClient } from '@/lib/serialize-for-client'
import { getUserJobs } from '@/lib/cached-queries'

const KanbanBoard = dynamic(
  () => import('@/components/board/kanban-board').then((mod) => ({ default: mod.KanbanBoard })),
  {
    loading: () => (
      <div className="glass glass-subtle rounded-2xl animate-pulse text-center py-16 text-muted-foreground">
        Loading board…
      </div>
    ),
  }
)

export const revalidate = 60

// Columns are now defined in the client component itself; this list stays
// here for completeness but is derived from the redesign tokenized palette.
const COLUMNS: { status: JobStatus; label: string }[] = [
  { status: 'SAVED', label: 'Saved' },
  { status: 'APPLIED', label: 'Applied' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'ARCHIVED', label: 'Archived' },
]

export default async function BoardPage() {
  const user = await requireAuth()

  // Cached list (tag-invalidated); no per-row activities to avoid huge payloads.
  // Board cards show "last activity" when present — empty until we add lazy load.
  const jobs = await getUserJobs(user.id, 200)
  const withActivities = jobs.map(
    (j) =>
      ({
        ...j,
        activities: [] as Activity[],
      }) as Job & { activities: Activity[] }
  )
  const plainJobs = serializeForClient(withActivities) as (Job & {
    activities: Activity[]
  })[]

  const jobsByStatus = COLUMNS.reduce((acc, column) => {
    acc[column.status] = plainJobs.filter((job) => job.status === column.status)
    return acc
  }, {} as Record<JobStatus, typeof plainJobs>)

  const totalJobs = plainJobs.length
  const activeJobs = plainJobs.filter((j) =>
    ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER'].includes(j.status)
  ).length

  return (
    <AppShell>
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight mb-1">Board</h1>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums">{totalJobs}</span> total jobs ·{' '}
              <span className="tabular-nums">{activeJobs}</span> active
            </p>
          </header>

          <KanbanBoard columns={COLUMNS} jobsByStatus={jobsByStatus} />
        </div>
      </div>
    </AppShell>
  )
}
