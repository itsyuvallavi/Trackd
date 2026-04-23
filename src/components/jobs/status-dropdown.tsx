'use client'

import { useState, useTransition, useRef, useLayoutEffect, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { JobStatus } from '@prisma/client'
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLOR } from '@/lib/constants'
import { updateJobStatus } from '@/app/(authenticated)/jobs/actions'
import { cn } from '@/lib/utils'

interface StatusDropdownProps {
  jobId: string
  currentStatus: JobStatus
  /** Fires immediately so the list can update before the server round-trip. */
  onOptimisticStatus?: (next: JobStatus) => void
  /** Fires if the server action fails — pass the previous status to revert. */
  onStatusCommitFailed?: (revertTo: JobStatus) => void
}

const statusOptions: JobStatus[] = ['SAVED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'ARCHIVED']

const DROPDOWN_WIDTH_PX = 160 // tailwind w-40
const DROPDOWN_EST_HEIGHT = 260
const VIEWPORT_PAD = 12
const GAP = 6

/** Scroll containers that are not the window (overflow on main, etc.): scroll
 *  events don't bubble, so the dropdown must listen on each. */
function getScrollableAncestors(node: Element | null): (Element | Window)[] {
  const out: (Element | Window)[] = [window]
  if (typeof document === 'undefined' || !node) return out
  let el: Element | null = node.parentElement
  while (el) {
    const { overflow, overflowX, overflowY } = getComputedStyle(el)
    if (
      [overflow, overflowX, overflowY].some((o) => /(auto|scroll|overlay)/.test(o))
    ) {
      out.push(el)
    }
    el = el.parentElement
  }
  return out
}

export function StatusDropdown({
  jobId,
  currentStatus,
  onOptimisticStatus,
  onStatusCommitFailed,
}: StatusDropdownProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
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

    const scrollTargets = buttonRef.current
      ? getScrollableAncestors(buttonRef.current)
      : [window]

    window.addEventListener('resize', update)
    for (const t of scrollTargets) {
      t.addEventListener('scroll', update, true)
    }
    return () => {
      window.removeEventListener('resize', update)
      for (const t of scrollTargets) {
        t.removeEventListener('scroll', update, true)
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    // Lock scroll on small viewports only; on desktop `overflow: hidden` on
    // body breaks tab strip / page interaction while the menu is open.
    if (typeof window === 'undefined') return
    if (window.matchMedia('(min-width: 768px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const handleStatusChange = (status: JobStatus) => {
    setActionError(null)
    const previous = currentStatus
    onOptimisticStatus?.(status)
    setIsOpen(false)
    startTransition(async () => {
      try {
        await updateJobStatus(jobId, status)
        // Re-fetch in the background; awaiting here blocked the UI for a full
        // RSC round-trip (often 10+ seconds in dev) while the list looked stale.
        void router.refresh()
      } catch (e) {
        onStatusCommitFailed?.(previous)
        setActionError(
          e instanceof Error ? e.message : 'Could not update status. Try again.'
        )
      }
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setActionError(null)
          setIsOpen((o) => !o)
        }}
        disabled={isPending}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
          'transition-[background-color,box-shadow] duration-200 ease-[var(--ease-ios)]',
          'hover:brightness-105 disabled:opacity-50',
          'touch-manipulation [-webkit-tap-highlight-color:transparent]',
          STATUS_COLORS[currentStatus]
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block size-1.5 rounded-full shrink-0',
            STATUS_DOT_COLOR[currentStatus],
            'transition-colors duration-300 ease-[var(--ease-ios)]'
          )}
        />
        {STATUS_LABELS[currentStatus]}
        <svg className="ml-0.5 h-3 w-3 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {actionError && (
        <p
          className="mt-1 max-w-40 text-[11px] text-error-text"
          role="alert"
        >
          {actionError}
        </p>
      )}

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
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    className="!fixed z-[110] w-44 rounded-2xl glass glass-strong overflow-y-auto overscroll-contain shadow-[var(--shadow-lg)]"
                    style={{
                      top: position.top,
                      left: position.left,
                      maxHeight: position.maxHeight,
                    }}
                  >
                    <div className="p-1">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            void handleStatusChange(status)
                          }}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 text-left text-sm rounded-xl',
                            'transition-colors duration-150',
                            'hover:bg-foreground/5 active:bg-foreground/10',
                            status === currentStatus && 'bg-foreground/5'
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'inline-block size-2 rounded-full shrink-0',
                              STATUS_DOT_COLOR[status]
                            )}
                          />
                          <span className="text-foreground">
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
