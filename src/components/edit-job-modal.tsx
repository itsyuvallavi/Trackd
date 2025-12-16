'use client'

import { useState, useTransition } from 'react'
import { Job } from '@prisma/client'
import { updateJob, deleteJob } from '@/app/jobs/actions'
import { Button } from '@/components/ui/button'
import { JobSource, JobStatus, JobPriority } from '@prisma/client'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'

interface EditJobModalProps {
  job: Job
  isOpen: boolean
  onClose: () => void
}

export function EditJobModal({ job, isOpen, onClose }: EditJobModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await updateJob(job.id, formData)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update job')
      }
    })
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${job.title}" at ${job.company}?`)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteJob(job.id)
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete job')
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-background border border-foreground/20 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Edit Job</h2>
          <button
            onClick={onClose}
            className="text-foreground/60 hover:text-foreground"
            disabled={isPending}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-title"
                name="title"
                required
                defaultValue={job.title}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-company" className="block text-sm font-medium mb-1">
                Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-company"
                name="company"
                required
                defaultValue={job.company}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-url" className="block text-sm font-medium mb-1">
                Job URL
              </label>
              <input
                type="url"
                id="edit-url"
                name="url"
                defaultValue={job.url || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-location" className="block text-sm font-medium mb-1">
                Location
              </label>
              <input
                type="text"
                id="edit-location"
                name="location"
                defaultValue={job.location || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-source" className="block text-sm font-medium mb-1">
                Source
              </label>
              <select
                id="edit-source"
                name="source"
                defaultValue={job.source}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              >
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-priority" className="block text-sm font-medium mb-1">
                Priority
              </label>
              <select
                id="edit-priority"
                name="priority"
                defaultValue={job.priority}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-salary" className="block text-sm font-medium mb-1">
                Salary
              </label>
              <input
                type="text"
                id="edit-salary"
                name="salary"
                defaultValue={job.salary || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-nextAction" className="block text-sm font-medium mb-1">
                Next Action
              </label>
              <input
                type="text"
                id="edit-nextAction"
                name="nextAction"
                defaultValue={job.nextAction || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-contactName" className="block text-sm font-medium mb-1">
                Contact Name
              </label>
              <input
                type="text"
                id="edit-contactName"
                name="contactName"
                defaultValue={job.contactName || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>

            <div>
              <label htmlFor="edit-contactEmail" className="block text-sm font-medium mb-1">
                Contact Email
              </label>
              <input
                type="email"
                id="edit-contactEmail"
                name="contactEmail"
                defaultValue={job.contactEmail || ''}
                className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-notes" className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="edit-notes"
              name="notes"
              rows={12}
              defaultValue={job.notes || ''}
              className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
            >
              Delete Job
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
