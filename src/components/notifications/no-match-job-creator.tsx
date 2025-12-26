'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createJob } from '@/app/(authenticated)/jobs/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import { Mail, Calendar, Building2, Briefcase, MapPin, ExternalLink } from 'lucide-react'
import { JobSource, JobStatus, JobPriority } from '@prisma/client'

interface NoMatchJobCreatorProps {
  notificationId: string
  emailSubject: string
  emailFrom: string
  emailDate: string
  company?: string
  title?: string
  emailTextBody?: string
}

export function NoMatchJobCreator({
  notificationId,
  emailSubject,
  emailFrom,
  emailDate,
  company,
  title,
  emailTextBody,
}: NoMatchJobCreatorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        await createJob(formData)
        
        // Mark notification as read
        await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        })

        // Redirect to jobs page
        router.push('/jobs')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create job')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Create Job from Email</h1>
        <p className="text-muted-foreground">
          We couldn't automatically match this email to an existing job. Please fill in the details below to create a new job.
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
          <details className="mt-4">
            <summary className="cursor-pointer text-primary hover:underline font-medium text-sm">
              View email content
            </summary>
            <div className="mt-3 p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-96 overflow-y-auto border border-border">
              {emailTextBody ? (
                emailTextBody
              ) : (
                <p className="text-muted-foreground italic">
                  Email content not available. This notification was created before email content storage was enabled.
                </p>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* Job Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Job Information</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1.5">
                Job Title <span className="text-error">*</span>
              </label>
              <Input
                id="title"
                name="title"
                defaultValue={title || ''}
                required
                placeholder="e.g., Software Engineer"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium mb-1.5">
                Company <span className="text-error">*</span>
              </label>
              <Input
                id="company"
                name="company"
                defaultValue={company || ''}
                required
                placeholder="e.g., Acme Corp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="location" className="block text-sm font-medium mb-1.5">
                  Location
                </label>
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g., San Francisco, CA"
                />
              </div>

              <div>
                <label htmlFor="url" className="block text-sm font-medium mb-1.5">
                  Job URL
                </label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="source" className="block text-sm font-medium mb-1.5">
                  Source
                </label>
                <select
                  id="source"
                  name="source"
                  defaultValue={JobSource.RECRUITER}
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1.5">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  defaultValue={JobStatus.APPLIED}
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="priority" className="block text-sm font-medium mb-1.5">
                  Priority
                </label>
                <select
                  id="priority"
                  name="priority"
                  defaultValue={JobPriority.B}
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-1.5">
                Notes
              </label>
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Add any additional notes about this job..."
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="border border-error rounded-lg p-4 bg-error-bg text-error-text">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
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
            disabled={isPending}
          >
            Dismiss
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Job'}
          </Button>
        </div>
      </form>
    </div>
  )
}
