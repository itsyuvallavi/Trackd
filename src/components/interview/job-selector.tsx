'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Briefcase } from 'lucide-react'

interface Job {
  id: string
  title: string
  company: string
  status: string
}

interface JobSelectorProps {
  value?: string
  onValueChange: (jobId: string | undefined) => void
  placeholder?: string
  jobs?: Job[]
}

export function JobSelector({
  value,
  onValueChange,
  placeholder = 'Select a job (optional)',
  jobs: providedJobs,
}: JobSelectorProps) {
  const [jobs, setJobs] = useState<Job[]>(providedJobs || [])
  const [isLoading, setIsLoading] = useState(!providedJobs)

  useEffect(() => {
    if (providedJobs) {
      setJobs(providedJobs)
      setIsLoading(false)
    } else {
      loadJobs()
    }
  }, [providedJobs])

  const loadJobs = async () => {
    try {
      // This would need a proper API endpoint
      // For now, jobs should be passed as props from the parent
      setIsLoading(false)
    } catch (error) {
      console.error('Error loading jobs:', error)
      setIsLoading(false)
    }
  }

  return (
    <Select
      value={value || ''}
      onValueChange={(val) => onValueChange(val || undefined)}
    >
      <SelectTrigger className="w-full">
        <div className="flex items-center gap-2">
          <Briefcase className="size-4 text-muted-foreground" />
          <SelectValue>
            {value
              ? jobs.find((j) => j.id === value)?.title || placeholder
              : placeholder}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">No specific job</SelectItem>
        {isLoading ? (
          <SelectItem value="loading" disabled>
            Loading jobs...
          </SelectItem>
        ) : (
          jobs.map((job) => (
            <SelectItem key={job.id} value={job.id}>
              <div className="flex flex-col">
                <span className="font-medium">{job.title}</span>
                <span className="text-xs text-muted-foreground">
                  {job.company}
                </span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}

