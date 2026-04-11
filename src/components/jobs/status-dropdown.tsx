'use client'

import { useState, useTransition, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
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

const DROPDOWN_WIDTH_PX = 160 // tailwind w-40
const DROPDOWN_EST_HEIGHT = 260
const VIEWPORT_PAD = 12
const GAP = 6

export function StatusDropdown({ jobId, currentStatus }: StatusDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, maxHeight: 280 })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Portal target only exists in the browser (avoid SSR/hydration mismatch)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount gate for createPortal(document.body)
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return

    const update = () => {
      const el = buttonRef.current
      if (!el) return

      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      const left = Math.min(
        Math.max(VIEWPORT_PAD, rect.left),
        vw - DROPDOWN_WIDTH_PX - VIEWPORT_PAD
      )

      const spaceBelow = vh - rect.bottom - GAP - VIEWPORT_PAD
      const spaceAbove = rect.top - GAP - VIEWPORT_PAD

      let top: number
      if (spaceBelow >= DROPDOWN_EST_HEIGHT || spaceBelow >= spaceAbove) {
        top = rect.bottom + GAP
        const maxH = Math.max(120, vh - top - VIEWPORT_PAD)
        setPosition({ top, left, maxHeight: maxH })
      } else {
        const desiredTop = rect.top - DROPDOWN_EST_HEIGHT - GAP
        top = Math.max(VIEWPORT_PAD, desiredTop)
        const maxH = Math.max(120, rect.top - GAP - top)
        setPosition({ top, left, maxHeight: maxH })
      }
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const handleStatusChange = (status: JobStatus) => {
    startTransition(async () => {
      await updateJobStatus(jobId, status)
      setIsOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen((o) => !o)
        }}
        disabled={isPending}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          'hover:opacity-80 transition-opacity disabled:opacity-50',
          'touch-manipulation [-webkit-tap-highlight-color:transparent]',
          STATUS_COLORS[currentStatus]
        )}
      >
        {STATUS_LABELS[currentStatus]}
        <svg className="ml-1 h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {isOpen && (
                <>
                  <motion.div
                    key="status-dropdown-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="fixed inset-0 z-[100] touch-none bg-black/20 md:bg-transparent"
                    aria-hidden
                    onClick={() => setIsOpen(false)}
                  />
                  <motion.div
                    key="status-dropdown-panel"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed z-[110] w-40 rounded-md bg-background border border-border shadow-lg overflow-y-auto overscroll-contain"
                    style={{
                      top: position.top,
                      left: position.left,
                      maxHeight: position.maxHeight,
                    }}
                  >
                    <div className="py-1">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleStatusChange(status)}
                          className={cn(
                            'block w-full px-4 py-2.5 text-left text-sm md:py-2',
                            'active:bg-muted/80 md:hover:bg-muted/60',
                            status === currentStatus && 'bg-muted/50'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                              STATUS_COLORS[status]
                            )}
                          >
                            {STATUS_LABELS[status]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  )
}
