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
import { CSS } from '@dnd-kit/utilities'
import { Job, Activity, JobStatus } from '@prisma/client'
import { BoardCard } from './board-card'
import { updateJobStatusOnBoard } from '@/app/(authenticated)/board/actions'

interface KanbanBoardProps {
  columns: { status: JobStatus; label: string; color: string }[]
  jobsByStatus: Record<JobStatus, (Job & { activities: Activity[] })[]>
}

export function KanbanBoard({ columns, jobsByStatus }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
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

    // Priority 1: Check if dropped directly on a column
    if (over.data.current?.type === 'column') {
      newStatus = over.data.current.status as JobStatus
    }
    // Priority 2: Check if over.id is a valid status (column ID)
    else {
      const validStatuses: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED']
      if (validStatuses.includes(over.id as JobStatus)) {
        newStatus = over.id as JobStatus
      }
      // Priority 3: If dropped on another job, find which column that job is in
      else if (over.data.current?.type === 'job') {
        const targetJob = over.data.current.job as Job
        newStatus = targetJob.status
      }
      // Priority 4: Try to find the column by checking all columns
      else {
        // Check if the over.id matches any job ID, then get that job's status
        for (const [status, jobs] of Object.entries(jobsByStatus)) {
          if (jobs.some((job) => job.id === over.id)) {
            newStatus = status as JobStatus
            break
          }
        }
      }
    }

    if (!newStatus) {
      return
    }

    // Find the job's current status
    let currentStatus: JobStatus | null = null
    for (const [status, jobs] of Object.entries(jobsByStatus)) {
      if (jobs.some((job) => job.id === jobId)) {
        currentStatus = status as JobStatus
        break
      }
    }

    // Only update if status actually changed
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

  // Get the active job being dragged
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
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-4">
        {columns.map((column) => (
          <div key={column.status} className="w-full">
            <DroppableColumn
              status={column.status}
              label={column.label}
              color={column.color}
              jobs={jobsByStatus[column.status]}
              isDragging={isDragging}
            />
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeJob ? (
          <div className="bg-background border border-foreground/20 rounded-lg p-3 shadow-lg opacity-95 rotate-3">
            <h3 className="font-medium text-sm mb-1">{activeJob.title}</h3>
            <p className="text-xs text-foreground/60">{activeJob.company}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface DroppableColumnProps {
  status: JobStatus
  label: string
  color: string
  jobs: (Job & { activities: Activity[] })[]
  isDragging: boolean
}

function DroppableColumn({ status, label, color, jobs, isDragging }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'column',
      status,
    },
  })

  const showDropIndicator = isOver

  return (
    <div ref={setNodeRef} className="flex flex-col h-full w-full transition-all">
      <div className={`${color} rounded-t-lg px-4 py-3 font-semibold flex items-center justify-between ${showDropIndicator ? 'ring-2 ring-primary' : ''}`}>
        <span>{label}</span>
        <span className="text-sm font-normal opacity-70">{jobs.length}</span>
      </div>
      <div
        className={`flex-1 border-x border-b border-foreground/20 rounded-b-lg p-2 bg-foreground/5 h-[calc(100vh-250px)] overflow-y-auto space-y-2 ${
          isDragging ? 'transition-colors' : ''
        } ${showDropIndicator ? 'bg-primary/10' : ''}`}
      >
        {jobs.map((job) => (
          <DraggableCard key={job.id} job={job} />
        ))}
        {jobs.length === 0 && (
          <div className="text-center py-8 text-sm text-foreground/40">
            {isDragging && showDropIndicator ? 'Drop here' : 'No jobs'}
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: job.id,
    data: {
      type: 'job',
      job,
    },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BoardCard job={job} isDragging={isDragging} />
    </div>
  )
}

