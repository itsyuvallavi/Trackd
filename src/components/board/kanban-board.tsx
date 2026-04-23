'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { Job, Activity, JobStatus } from '@prisma/client'
import { BoardCard } from './board-card'
import { updateJobStatusOnBoard } from '@/app/(authenticated)/board/actions'
import { STATUS_DOT_COLOR, STATUS_LABELS } from '@/lib/constants'
import { GlassPill } from '@/components/ui/glass'
import { cn } from '@/lib/utils'

interface KanbanColumn {
  status: JobStatus
  label: string
}

interface KanbanBoardProps {
  columns: KanbanColumn[]
  jobsByStatus: Record<JobStatus, (Job & { activities: Activity[] })[]>
}

export function KanbanBoard({ columns, jobsByStatus }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setIsDragging(true)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setIsDragging(false)

    if (!over) return

    const jobId = active.id as string
    let newStatus: JobStatus | null = null

    if (over.data.current?.type === 'column') {
      newStatus = over.data.current.status as JobStatus
    } else {
      const validStatuses: JobStatus[] = [
        'SAVED',
        'APPLIED',
        'INTERVIEW',
        'OFFER',
        'REJECTED',
        'ARCHIVED',
      ]
      if (validStatuses.includes(over.id as JobStatus)) {
        newStatus = over.id as JobStatus
      } else if (over.data.current?.type === 'job') {
        newStatus = (over.data.current.job as Job).status
      } else {
        for (const [status, jobs] of Object.entries(jobsByStatus)) {
          if (jobs.some((job) => job.id === over.id)) {
            newStatus = status as JobStatus
            break
          }
        }
      }
    }

    if (!newStatus) return

    let currentStatus: JobStatus | null = null
    for (const [status, jobs] of Object.entries(jobsByStatus)) {
      if (jobs.some((job) => job.id === jobId)) {
        currentStatus = status as JobStatus
        break
      }
    }

    if (currentStatus && currentStatus !== newStatus) {
      try {
        await updateJobStatusOnBoard(jobId, newStatus)
      } catch (error) {
        console.error('Failed to update job status:', error)
      }
    }
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setIsDragging(false)
  }

  const activeJob = activeId
    ? Object.values(jobsByStatus)
        .flat()
        .find((job) => job.id === activeId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Mobile: horizontal snap-scroll columns */}
      <div className="md:hidden overflow-x-auto mobile-scroll-x pb-4 -mx-4 px-4">
        <div className="flex gap-3" style={{ width: `${columns.length * 288}px` }}>
          {columns.map((column) => (
            <div key={column.status} className="w-[272px] flex-shrink-0 snap-start">
              <DroppableColumn
                status={column.status}
                label={column.label}
                jobs={jobsByStatus[column.status]}
                isDragging={isDragging}
                isMobile
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: 6-column grid */}
      <div className="hidden md:grid md:grid-cols-3 xl:grid-cols-6 gap-3">
        {columns.map((column) => (
          <DroppableColumn
            key={column.status}
            status={column.status}
            label={column.label}
            jobs={jobsByStatus[column.status]}
            isDragging={isDragging}
          />
        ))}
      </div>

      <DragOverlay>
        {activeJob ? (
          <div className="glass glass-strong rounded-2xl p-3 opacity-95 rotate-1 shadow-[var(--shadow-lg)]">
            <h3 className="font-medium text-sm mb-0.5">{activeJob.title}</h3>
            <p className="text-xs text-muted-foreground">{activeJob.company}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface DroppableColumnProps {
  status: JobStatus
  label: string
  jobs: (Job & { activities: Activity[] })[]
  isDragging: boolean
  isMobile?: boolean
}

function DroppableColumn({
  status,
  label,
  jobs,
  isDragging,
  isMobile,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: { type: 'column', status },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col w-full rounded-2xl glass glass-subtle overflow-hidden',
        'transition-[box-shadow,transform] duration-200 ease-[var(--ease-ios)]',
        isOver && 'ring-1 ring-primary/50 shadow-[var(--shadow-blue)]'
      )}
    >
      <header className="flex items-center justify-between px-3 md:px-4 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className={cn('size-2 rounded-full shrink-0', STATUS_DOT_COLOR[status])}
          />
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="sr-only">{STATUS_LABELS[status]}</span>
        </div>
        <GlassPill variant="subtle" className="text-[10px] tabular-nums px-2 py-0">
          {jobs.length}
        </GlassPill>
      </header>

      <div
        className={cn(
          'flex-1 p-2 space-y-2 overflow-y-auto overscroll-contain',
          isMobile ? 'h-[60vh] min-h-[300px]' : 'h-[calc(100vh-260px)]'
        )}
      >
        {jobs.map((job) => (
          <DraggableCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && (
          <div
            className={cn(
              'mt-2 rounded-xl border-2 border-dashed border-border/50 py-8 px-3 text-center text-xs text-muted-foreground/70',
              isDragging && isOver && 'border-primary/50 text-primary bg-primary/5'
            )}
          >
            {isDragging && isOver ? 'Drop to move here' : 'No jobs'}
          </div>
        )}
      </div>
    </div>
  )
}

interface DraggableCardProps {
  job: Job & { activities: Activity[] }
}

function DraggableCard({ job }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
      data: { type: 'job', job },
    })

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        transition: isDragging ? 'none' : 'transform 200ms var(--ease-ios)',
      }
    : undefined

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BoardCard job={job} isDragging={isDragging} />
    </div>
  )
}
