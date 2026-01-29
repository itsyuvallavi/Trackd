'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteJob } from '@/app/(authenticated)/jobs/actions'

interface JobActionsMenuProps {
  jobId: string
}

export function JobActionsMenu({ jobId }: JobActionsMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [position, setPosition] = useState({ top: 0, right: 0, placement: 'bottom' as 'top' | 'bottom' })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const dropdownWidth = 160 // w-40 = 160px
      const estimatedHeight = 140 // Approximate height for 3 menu items
      const spacing = 4 // Gap between button and dropdown
      const viewportPadding = 16
      
      // Calculate horizontal position (right-aligned from button)
      const right = window.innerWidth - rect.right
      
      // Check vertical boundaries and determine placement
      const spaceBelow = window.innerHeight - rect.bottom - spacing - viewportPadding
      const spaceAbove = rect.top - spacing - viewportPadding
      
      // Place above if not enough space below, but enough space above
      const buffer = 30
      const shouldPlaceAbove = spaceBelow < estimatedHeight + buffer && spaceAbove > estimatedHeight + buffer
      
      let top: number
      let placement: 'top' | 'bottom'
      
      if (shouldPlaceAbove) {
        // Position above the button
        const availableSpaceAbove = spaceAbove
        top = rect.top - Math.min(estimatedHeight, availableSpaceAbove) - spacing
        if (top < viewportPadding) {
          top = viewportPadding
        }
        placement = 'top'
      } else {
        // Position below the button (default)
        top = rect.bottom + spacing
        // Ensure it doesn't go below viewport
        const availableSpaceBelow = window.innerHeight - top - viewportPadding
        if (availableSpaceBelow < estimatedHeight) {
          top = window.innerHeight - Math.min(estimatedHeight, availableSpaceBelow) - viewportPadding
        }
        placement = 'bottom'
      }
      
      setPosition({ top, right, placement })
    }
  }, [isOpen])

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return

    setIsDeleting(true)
    try {
      await deleteJob(jobId)
      router.refresh()
    } catch (error) {
      console.error('Failed to delete job:', error)
      alert('Failed to delete job')
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-foreground hover:text-foreground hover:bg-accent"
        onClick={() => setIsOpen(!isOpen)}
      >
        <MoreHorizontal className="size-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div 
            ref={dropdownRef}
            className={`fixed z-50 w-40 bg-card border border-border rounded-lg shadow-xl py-1 animate-in fade-in duration-150 ${
              position.placement === 'top' ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
            }`}
            style={{ 
              top: `${position.top}px`, 
              right: `${position.right}px`,
              maxHeight: position.placement === 'top'
                ? `${Math.max(140, position.top - 16)}px`
                : `${Math.max(140, window.innerHeight - position.top - 16)}px`
            }}
          >
            <Link
              href={`/jobs/${jobId}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Eye className="size-4" />
              View
            </Link>

            <Link
              href={`/jobs/${jobId}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Edit className="size-4" />
              Edit
            </Link>

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-accent transition-colors w-full text-left disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
