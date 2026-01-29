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
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom' })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect()
      const dropdownHeight = 240 // Approximate height of dropdown with all options
      const spacing = 4 // Gap between button and dropdown
      const viewportPadding = 16 // Padding from viewport edges
      
      // Check vertical boundaries
      const spaceBelow = window.innerHeight - buttonRect.bottom - spacing - viewportPadding
      const spaceAbove = buttonRect.top - spacing - viewportPadding
      
      // Flip to top if not enough space below, but enough space above
      const buffer = 50
      const shouldPlaceOnTop = spaceBelow < dropdownHeight + buffer && spaceAbove > dropdownHeight + buffer
      
      let top: number
      let placement: 'top' | 'bottom'
      
      if (shouldPlaceOnTop) {
        // Position above the button
        const availableSpaceAbove = spaceAbove
        top = buttonRect.top - Math.min(dropdownHeight, availableSpaceAbove) - spacing
        if (top < viewportPadding) {
          top = viewportPadding
        }
        placement = 'top'
      } else {
        // Position below the button (default)
        top = buttonRect.bottom + spacing
        // Ensure it doesn't go below viewport
        const availableSpaceBelow = window.innerHeight - top - viewportPadding
        if (availableSpaceBelow < dropdownHeight) {
          top = window.innerHeight - Math.min(dropdownHeight, availableSpaceBelow) - viewportPadding
        }
        placement = 'bottom'
      }
      
      setPosition({
        top,
        left: Math.max(viewportPadding, buttonRect.left),
        placement,
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
              initial={{ opacity: 0, scale: 0.95, y: position.placement === 'top' ? 10 : -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: position.placement === 'top' ? 10 : -5 }}
              transition={{ 
                duration: 0.15,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="fixed z-50 w-40 rounded-md bg-background border border-foreground/20 shadow-lg overflow-y-auto"
              style={{ 
                top: `${position.top}px`, 
                left: `${position.left}px`,
                maxHeight: position.placement === 'top' 
                  ? `${Math.max(200, position.top - 16)}px` 
                  : `${Math.max(200, window.innerHeight - position.top - 16)}px`
              }}
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
