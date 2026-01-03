import { Job, Activity, JobStatus } from '@prisma/client'
import { BoardCard } from '@/components/board/board-card'

interface BoardColumnProps {
  status: JobStatus
  label: string
  color: string
  jobs: (Job & { activities: Activity[] })[]
}

export function BoardColumn({ status, label, color, jobs }: BoardColumnProps) {
  // Map status to content area background color (matching the header but more subtle)
  const contentBgColor = {
    'SAVED': 'bg-muted/50',
    'APPLIED': 'bg-info-bg/50',
    'INTERVIEW': 'bg-purple-100/50 dark:bg-purple-900/20',
    'OFFER': 'bg-success-bg/50',
    'REJECTED': 'bg-error-bg/50',
    'ARCHIVED': 'bg-warning-bg/50',
  }[status] || 'bg-muted/50'

  return (
    <div className="flex flex-col h-full">
      <div className={`${color} border border-border rounded-t-lg px-4 py-3 font-semibold flex items-center justify-between`}>
        <span>{label}</span>
        <span className="text-sm font-normal opacity-70">{jobs.length}</span>
      </div>
      <div className={`flex-1 border-x border-b border-border rounded-b-lg p-2 ${contentBgColor} min-h-[500px] space-y-2`}>
        {jobs.map((job) => (
          <BoardCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-8 text-sm text-foreground/40">
            No jobs
          </div>
        )}
      </div>
    </div>
  )
}
