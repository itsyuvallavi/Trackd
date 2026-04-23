import { JobStatus } from '@prisma/client'
import { StatusCounter } from './status-counter'

interface StatusStatsProps {
  counts: Record<JobStatus, number>
  activeStatus?: JobStatus
}

const STATUS_ORDER: JobStatus[] = [
  'SAVED',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'ARCHIVED',
]

export function StatusStats({ counts, activeStatus }: StatusStatsProps) {
  const totalJobs = Object.values(counts).reduce((sum, c) => sum + c, 0)
  const activeJobs =
    counts.SAVED + counts.APPLIED + counts.INTERVIEW + counts.OFFER

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">{totalJobs}</span> total jobs ·{' '}
            <span className="tabular-nums">{activeJobs}</span> active
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATUS_ORDER.map((status) => (
          <StatusCounter
            key={status}
            status={status}
            count={counts[status]}
            total={totalJobs}
            isActive={activeStatus === status}
          />
        ))}
      </div>
    </section>
  )
}
