'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InterviewDatePicker } from './interview-date-picker'
import { X } from 'lucide-react'
import { updateInterviewDate } from '@/app/(authenticated)/calendar/actions'
import { useRouter } from 'next/navigation'
import { JobStatus } from '@prisma/client'

interface Job {
  id: string
  title: string
  company: string
  status: JobStatus
}

interface AddInterviewModalProps {
  isOpen: boolean
  initialDate: Date
  onClose: () => void
  onInterviewAdded: () => void
}

export function AddInterviewModal({
  isOpen,
  initialDate,
  onClose,
  onInterviewAdded,
}: AddInterviewModalProps) {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedDateTime, setSelectedDateTime] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchJobs()
      // Initialize date/time from initialDate
      const defaultDate = initialDate || new Date()
      const [hours, minutes] = [defaultDate.getHours(), defaultDate.getMinutes()]
      setSelectedDateTime(new Date(
        defaultDate.getFullYear(),
        defaultDate.getMonth(),
        defaultDate.getDate(),
        hours,
        minutes
      ))
    } else {
      // Reset when modal closes
      setSelectedJobId('')
      setSelectedDateTime(null)
    }
  }, [isOpen, initialDate])

  const fetchJobs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        // Filter to jobs without interviews or that could have interviews
        const availableJobs = data.jobs.filter(
          (job: Job) => job.status !== 'ARCHIVED' && job.status !== 'REJECTED'
        )
        setJobs(availableJobs)
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDateTimeChange = useCallback((dateTime: Date | null) => {
    setSelectedDateTime(dateTime)
  }, [])

  const handleSave = async () => {
    if (!selectedJobId || !selectedDateTime) {
      alert('Please select a job and date/time')
      return
    }

    setIsSubmitting(true)
    try {
      await updateInterviewDate(selectedJobId, selectedDateTime)
      onInterviewAdded()
    } catch (error) {
      console.error('Failed to add interview:', error)
      alert('Failed to add interview. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Add Interview</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Job Selector */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Select Job
            </label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-2">Loading jobs...</div>
            ) : jobs.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">No jobs available</div>
            ) : (
              <Select
                value={selectedJobId || ''}
                onValueChange={(value) => setSelectedJobId(value || '')}
                disabled={isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Choose a job...</SelectItem>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} at {job.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date/Time Picker */}
          <InterviewDatePicker
            initialDate={initialDate}
            onSave={async () => {}}
            onCancel={onClose}
            isSubmitting={isSubmitting}
            showSaveButton={false}
            onChange={handleDateTimeChange}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || !selectedJobId || !selectedDateTime}
          >
            {isSubmitting ? 'Adding...' : 'Add Interview'}
          </Button>
        </div>
      </div>
    </div>
  )
}

