'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { JobStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS } from '@/lib/constants'
import { updateJobStatus } from '@/app/(authenticated)/jobs/actions'
import { cn } from '@/lib/utils'

interface StatusDropdownProps {
  jobId: string
  currentStatus: JobStatus
}

const statusOptions: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED']

export function StatusDropdown({ jobId, currentStatus }: StatusDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [isOpen])

  const handleStatusChange = (status: JobStatus) => {
    startTransition(async () => {
      await updateJobStatus(jobId, status)
      setIsOpen(false)
      router.refresh() // Refresh to show updated status
    })
  }

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
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

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ 
                duration: 0.15,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="fixed z-50 w-40 rounded-md bg-background border border-foreground/20 shadow-lg"
              style={{ top: `${position.top}px`, left: `${position.left}px` }}
            >
              <div className="py-1">
                {statusOptions.map((status) => (
                  <motion.button
                    key={status}
                    whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleStatusChange(status)}
                    className={cn(
                      'block w-full px-4 py-2 text-left text-sm',
                      status === currentStatus && 'bg-foreground/10'
                    )}
                  >
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_COLORS[status])}>
                      {STATUS_LABELS[status]}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
