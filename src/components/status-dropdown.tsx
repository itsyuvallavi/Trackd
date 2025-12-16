'use client'

import { useState, useTransition } from 'react'
import { JobStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { updateJobStatus } from '@/app/jobs/actions'
import { cn } from '@/lib/utils'

interface StatusDropdownProps {
  jobId: string
  currentStatus: JobStatus
}

const statusOptions: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED']

export function StatusDropdown({ jobId, currentStatus }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (status: JobStatus) => {
    startTransition(async () => {
      await updateJobStatus(jobId, status)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isPending}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          'hover:opacity-80 transition-opacity disabled:opacity-50',
          STATUS_COLORS[currentStatus]
        )}
      >
        {STATUS_LABELS[currentStatus]}
        <svg
          className="ml-1 h-3 w-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 z-20 mt-1 w-40 rounded-md bg-background border border-foreground/20 shadow-lg">
            <div className="py-1">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    'block w-full px-4 py-2 text-left text-sm hover:bg-foreground/5',
                    status === currentStatus && 'bg-foreground/10'
                  )}
                >
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
                    {STATUS_LABELS[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
