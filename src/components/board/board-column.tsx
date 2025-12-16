import { Job, Activity, JobStatus } from '@prisma/client'
import { BoardCard } from '@/components/board/board-card'

interface BoardColumnProps {
  status: JobStatus
  label: string
  color: string
  jobs: (Job & { activities: Activity[] })[]
}

export function BoardColumn({ status, label, color, jobs }: BoardColumnProps) {
  return (
    <div className="flex flex-col h-full">
      <div className={`${color} rounded-t-lg px-4 py-3 font-semibold flex items-center justify-between`}>
        <span>{label}</span>
        <span className="text-sm font-normal opacity-70">{jobs.length}</span>
      </div>
      <div className="flex-1 border-x border-b border-foreground/20 rounded-b-lg p-2 bg-foreground/5 min-h-[500px] space-y-2">
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
