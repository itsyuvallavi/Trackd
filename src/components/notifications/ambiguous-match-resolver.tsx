'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertCircle, Mail, Calendar, Building2, MapPin, ExternalLink } from 'lucide-react'
import { JobStatus } from '@prisma/client'
import Link from 'next/link'

interface MatchedJob {
  id: string
  title: string
  company: string
  location: string | null
  status: JobStatus
  url: string | null
  appliedAt: Date | null
  interviewAt: Date | null
}

interface AmbiguousMatchResolverProps {
  notificationId: string
  emailSubject: string
  emailFrom: string
  emailDate: string
  matchedJobs: MatchedJob[]
  suggestedStatus?: string
  emailType?: string
}

export function AmbiguousMatchResolver({
  notificationId,
  emailSubject,
  emailFrom,
  emailDate,
  matchedJobs,
  suggestedStatus,
  emailType,
}: AmbiguousMatchResolverProps) {
  const router = useRouter()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectJob = async (jobId: string) => {
    if (isProcessing) return

    setSelectedJobId(jobId)
    setIsProcessing(true)
    setError(null)

    try {
      const response = await fetch(`/api/notifications/${notificationId}/resolve-ambiguous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          suggestedStatus,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resolve ambiguous match')
      }

      const data = await response.json()
      
      // Redirect to the job page
      router.push(`/jobs/${jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsProcessing(false)
      setSelectedJobId(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getStatusColor = (status: JobStatus) => {
    const colors = {
      SAVED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      APPLIED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      INTERVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      OFFER: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      GHOSTED: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    }
    return colors[status] || colors.SAVED
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="size-6 text-warning" />
          <h1 className="text-3xl font-bold">Resolve Ambiguous Match</h1>
        </div>
        <p className="text-muted-foreground">
          An email could match multiple jobs. Please select which job this email refers to.
        </p>
      </div>

      {/* Email Details */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Mail className="size-5" />
          Email Details
        </h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="font-medium text-muted-foreground">From:</span>{' '}
            <span className="text-foreground">{emailFrom}</span>
          </div>
          <div>
            <span className="font-medium text-muted-foreground">Subject:</span>{' '}
            <span className="text-foreground">{emailSubject}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Date:</span>{' '}
            <span className="text-foreground">{formatDate(emailDate)}</span>
          </div>
          {suggestedStatus && (
            <div>
              <span className="font-medium text-muted-foreground">Suggested Status:</span>{' '}
              <span className="text-foreground capitalize">{suggestedStatus.toLowerCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Matched Jobs */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Select the job this email refers to:
        </h2>
        <div className="space-y-3">
          {matchedJobs.map((job) => (
            <div
              key={job.id}
              className={`border rounded-lg p-4 transition-all ${
                selectedJobId === job.id
                  ? 'border-primary bg-primary-lightest'
                  : 'border-border bg-card hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <Building2 className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground mb-1">
                        {job.title}
                      </h3>
                      <p className="text-muted-foreground mb-2">{job.company}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {job.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="size-4" />
                            <span>{job.location}</span>
                          </div>
                        )}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.appliedAt && (
                          <span>Applied {new Date(job.appliedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {job.url && (
                    <Link
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                    >
                      <ExternalLink className="size-3" />
                      View job posting
                    </Link>
                  )}
                </div>
                <Button
                  onClick={() => handleSelectJob(job.id)}
                  disabled={isProcessing}
                  className="shrink-0"
                  variant={selectedJobId === job.id ? 'primary' : 'outline'}
                >
                  {selectedJobId === job.id && isProcessing
                    ? 'Processing...'
                    : selectedJobId === job.id
                    ? 'Selected'
                    : 'Select'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="border border-error rounded-lg p-4 bg-error-bg text-error-text">
          <p className="font-medium">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Cancel/Dismiss Option */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              await fetch(`/api/notifications/${notificationId}`, {
                method: 'DELETE',
              })
              router.push('/jobs')
            } catch (err) {
              console.error('Error dismissing notification:', err)
            }
          }}
          disabled={isProcessing}
        >
          Dismiss
        </Button>
      </div>
    </div>
  )
}
