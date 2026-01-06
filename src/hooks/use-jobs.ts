'use client'

import useSWR from 'swr'
import { JobStatus } from '@prisma/client'

export interface Job {
  id: string
  title: string
  company: string
  location: string | null
  status: JobStatus
  priority: string | null
  source: string
  url: string | null
  savedAt: string
  appliedAt: string | null
  interviewAt: string | null
  nextAction: string | null
  tags: string[]
  notes: string | null
  salary: string | null
  contactName: string | null
  contactEmail: string | null
  createdAt: string
  updatedAt: string
  activities: {
    id: string
    type: string
    fromStatus: string | null
    toStatus: string | null
    createdAt: string
    description: string | null
  }[]
}

interface UseJobsOptions {
  // Disable fetching (useful when you have initial data from server)
  disabled?: boolean
  // Enable automatic polling (disabled by default to reduce server load)
  enablePolling?: boolean
  // Polling interval in milliseconds (default: 60 seconds)
  pollingInterval?: number
}

/**
 * SWR hook for fetching and caching jobs data
 * Provides instant navigation by caching data client-side
 * Polling is disabled by default to reduce database load
 */
export function useJobs(options: UseJobsOptions = {}) {
  const { disabled = false, enablePolling = false, pollingInterval = 60000 } = options

  const { data, error, isLoading, isValidating, mutate } = useSWR<{ jobs: Job[] }>(
    disabled ? null : '/api/jobs',
    {
      // Keep data fresh but allow instant display of cached data
      revalidateOnMount: true,
      // Only poll if explicitly enabled
      refreshInterval: enablePolling ? pollingInterval : 0,
    }
  )

  return {
    jobs: data?.jobs ?? [],
    isLoading,
    isValidating, // True when revalidating in background
    error,
    mutate, // Function to manually revalidate/update cache
  }
}

/**
 * Optimistic update helper for job status changes
 */
export async function updateJobStatusOptimistic(
  mutate: ReturnType<typeof useJobs>['mutate'],
  jobId: string,
  newStatus: JobStatus
) {
  // Optimistically update the cache
  mutate(
    (currentData) => {
      if (!currentData) return currentData
      return {
        jobs: currentData.jobs.map((job) =>
          job.id === jobId ? { ...job, status: newStatus } : job
        ),
      }
    },
    { revalidate: false } // Don't revalidate yet
  )

  // Make the actual API call
  try {
    await fetch(`/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    // Revalidate after successful update
    mutate()
  } catch (error) {
    // Revert on error by revalidating
    mutate()
    throw error
  }
}

