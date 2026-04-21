'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { deleteJob } from '@/app/(authenticated)/jobs/actions'

interface JobActionsMenuProps {
  jobId: string
  /** Shown in the delete confirmation dialog */
  jobTitle: string
  jobCompany: string
}

export function JobActionsMenu({ jobId, jobTitle, jobCompany }: JobActionsMenuProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
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

  const handleConfirmDelete = async () => {
    setDeleteError(null)
    setIsDeleting(true)
    try {
      await deleteJob(jobId)
      setDeleteDialogOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to delete job:', error)
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete job')
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <>
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
              type="button"
              onClick={() => {
                setIsOpen(false)
                setDeleteDialogOpen(true)
              }}
              disabled={isDeleting}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-accent transition-colors w-full text-left disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>

    <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
      if (isDeleting) return
      setDeleteDialogOpen(open)
      if (!open) setDeleteError(null)
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this job?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              This removes{' '}
              <span className="font-medium text-foreground">{jobTitle}</span>
              {' '}at{' '}
              <span className="font-medium text-foreground">{jobCompany}</span>
              {' '}from Trackd permanently.
            </span>
            <span className="block text-muted-foreground">
              This does not withdraw an application on the employer&apos;s site.
            </span>
          </AlertDialogDescription>
          {deleteError ? (
            <p className="text-sm text-red-600 dark:text-red-400 pt-1">{deleteError}</p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            onClick={(e) => {
              e.preventDefault()
              void handleConfirmDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </span>
            ) : (
              'Delete job'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
