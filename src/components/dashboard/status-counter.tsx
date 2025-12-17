import { JobStatus } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StatusCounterProps {
  status: JobStatus
  count: number
  isActive?: boolean
}

export function StatusCounter({ status, count, isActive = false }: StatusCounterProps) {
  const colorClass = STATUS_COLORS[status]
  
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg border border-foreground/10 bg-card hover:bg-accent/50 transition-colors">
      <Badge className={cn(colorClass, 'text-xs')}>{STATUS_LABELS[status]}</Badge>
      <span className="text-2xl font-bold">{count}</span>
    </div>
  )
}

