'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createJob } from '@/app/(authenticated)/jobs/actions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JobSource, JobStatus, JobPriority } from '@prisma/client'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'

interface AddJobModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddJobModal({ isOpen, onClose }: AddJobModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<JobSource>('MANUAL')
  const [status, setStatus] = useState<JobStatus>('SAVED')
  const [priority, setPriority] = useState<JobPriority>('B')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await createJob(formData)
        onClose()
        e.currentTarget.reset()
        // Reset Select values
        setSource('MANUAL')
        setStatus('SAVED')
        setPriority('B')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create job')
      }
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ 
                duration: 0.2,
                ease: [0.16, 1, 0.3, 1]
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-lg bg-card border border-border shadow-2xl max-h-[90vh] flex flex-col md:max-w-2xl"
            >
            {/* Header - Fixed */}
            <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
              <h2 className="text-2xl font-bold">Add New Job</h2>
              <button
                onClick={onClose}
                className="text-foreground/60 hover:text-foreground"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1 min-h-0">
              {error && (
                <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-200">
                  {error}
                </div>
              )}

              <form id="add-job-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Hidden inputs for Select values */}
                <input type="hidden" name="source" value={source} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="priority" value={priority} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium mb-1">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    required
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="Senior Software Engineer"
                  />
                </div>

                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-1">
                    Company <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    required
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <label htmlFor="url" className="block text-sm font-medium mb-1">
                    Job URL
                  </label>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="https://..."
                  />
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="San Francisco, CA"
                  />
                </div>

                <div>
                  <label htmlFor="source" className="block text-sm font-medium mb-1">
                    Source
                  </label>
                  <Select value={source} onValueChange={(value) => setSource(value as JobSource)}>
                    <SelectTrigger id="source" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium mb-1">
                    Status
                  </label>
                  <Select value={status} onValueChange={(value) => setStatus(value as JobStatus)}>
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <Select value={priority} onValueChange={(value) => setPriority(value as JobPriority)}>
                    <SelectTrigger id="priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label htmlFor="salary" className="block text-sm font-medium mb-1">
                    Salary
                  </label>
                  <input
                    type="text"
                    id="salary"
                    name="salary"
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="$120k - $150k"
                  />
                </div>

                <div>
                  <label htmlFor="contactName" className="block text-sm font-medium mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    id="contactName"
                    name="contactName"
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="Jane Smith"
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="block text-sm font-medium mb-1">
                    Contact Email
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    name="contactEmail"
                    className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                    placeholder="jane@company.com"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="nextAction" className="block text-sm font-medium mb-1">
                  Next Action
                </label>
                <input
                  type="text"
                  id="nextAction"
                  name="nextAction"
                  className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  placeholder="Follow up with recruiter"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/50"
                  placeholder="Additional notes about this job..."
                />
              </div>

              </form>
            </div>
            
            {/* Footer - Fixed */}
            <div className="p-6 border-t border-border shrink-0">
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  form="add-job-form"
                  disabled={isPending}
                >
                  {isPending ? 'Creating...' : 'Create Job'}
                </Button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
