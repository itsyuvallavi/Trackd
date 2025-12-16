'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteJob } from '@/app/(authenticated)/jobs/actions'

interface JobActionsMenuProps {
  jobId: string
}

export function JobActionsMenu({ jobId }: JobActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this job?')) return

    setIsDeleting(true)
    try {
      await deleteJob(jobId)
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
            className="fixed inset-0 z-10 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-xl z-20 py-1 animate-in slide-in-from-top-2 fade-in duration-150">
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
