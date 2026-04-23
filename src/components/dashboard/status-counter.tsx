import { JobStatus } from '@prisma/client'
import { STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusCounterProps {
  status: JobStatus
  count: number
  total: number
  isActive?: boolean
}

// Map status → single color token used for the ring + label tint.
// All tokens are desaturated OKLCH values defined in globals.css.
const STATUS_TOKEN: Record<JobStatus, string> = {
  SAVED: 'var(--saved)',
  APPLIED: 'var(--info)',
  INTERVIEW: 'var(--interview)',
  OFFER: 'var(--success)',
  REJECTED: 'var(--error)',
  ARCHIVED: 'var(--warning)',
}

const STATUS_LABEL_CLASS: Record<JobStatus, string> = {
  SAVED: 'text-saved',
  APPLIED: 'text-info',
  INTERVIEW: 'text-interview',
  OFFER: 'text-success',
  REJECTED: 'text-error',
  ARCHIVED: 'text-warning',
}

export function StatusCounter({
  status,
  count,
  total,
  isActive = false,
}: StatusCounterProps) {
  const pct = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0
  const color = STATUS_TOKEN[status]

  return (
    <div
      className={cn(
        'glass glass-subtle rounded-2xl p-4 flex items-center gap-3',
        'transition-[transform,box-shadow] duration-200 ease-[var(--ease-ios)]',
        'hover:-translate-y-0.5',
        isActive && 'ring-1 ring-primary/40'
      )}
    >
      {/* Progress ring around the number */}
      <div className="relative shrink-0 size-11 grid place-items-center">
        <svg
          aria-hidden
          className="absolute inset-0 -rotate-90"
          viewBox="0 0 44 44"
        >
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            strokeWidth="3"
            stroke="var(--border)"
          />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            strokeWidth="3"
            stroke={color}
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 113.1} 113.1`}
            className="transition-[stroke-dasharray] duration-500 ease-[var(--ease-ios)]"
          />
        </svg>
        <span className="relative text-sm font-semibold tabular-nums">
          {count}
        </span>
      </div>

      <div className="min-w-0">
        <div
          className={cn(
            'text-[11px] uppercase tracking-wider font-medium',
            STATUS_LABEL_CLASS[status]
          )}
        >
          {STATUS_LABELS[status]}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {pct}% of total
        </div>
      </div>
    </div>
  )
}
