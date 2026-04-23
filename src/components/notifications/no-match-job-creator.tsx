'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createJob } from '@/app/(authenticated)/jobs/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { GlassPanel } from '@/components/ui/glass'
import { SOURCE_LABELS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import { Mail, Calendar, Loader2, MailQuestion } from 'lucide-react'
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

const selectClasses =
  'flex h-10 w-full rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/40 transition-colors duration-150'

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

        await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        })

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
        <div className="flex items-center gap-3 mb-1">
          <div className="shrink-0 size-9 rounded-xl grid place-items-center bg-info-bg border border-info/20">
            <MailQuestion className="size-4 text-info-text" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create job from email
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          We couldn&apos;t automatically match this email to an existing job.
          Fill in the details to create a new one.
        </p>
      </div>

      {/* Email Details */}
      <GlassPanel className="rounded-2xl p-5 md:p-6">
        <h2 className="text-sm font-semibold tracking-tight mb-4 flex items-center gap-2 text-foreground/80">
          <Mail className="size-4" />
          Email details
        </h2>
        <dl className="space-y-2.5 text-sm">
          <Row label="From">
            <span className="text-foreground break-words">{emailFrom}</span>
          </Row>
          <Row label="Subject">
            <span className="text-foreground break-words">{emailSubject}</span>
          </Row>
          <Row label="Date">
            <span className="text-foreground inline-flex items-center gap-1.5">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span className="tabular-nums">{formatDate(emailDate)}</span>
            </span>
          </Row>
        </dl>
        <details className="mt-4">
          <summary className="cursor-pointer text-primary hover:underline font-medium text-sm">
            View email content
          </summary>
          <div className="mt-3 p-4 rounded-xl bg-foreground/[0.04] text-sm whitespace-pre-wrap max-h-96 overflow-y-auto border border-border/60">
            {emailTextBody ? (
              emailTextBody
            ) : (
              <p className="text-muted-foreground italic">
                Email content not available. This notification was created
                before email content storage was enabled.
              </p>
            )}
          </div>
        </details>
      </GlassPanel>

      {/* Job Creation Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <GlassPanel className="rounded-2xl p-5 md:p-6">
          <h2 className="text-sm font-semibold tracking-tight mb-4 text-foreground/80">
            Job information
          </h2>

          <div className="space-y-4">
            <Field label="Job title" htmlFor="title" required>
              <Input
                id="title"
                name="title"
                defaultValue={title || ''}
                required
                placeholder="e.g. Software Engineer"
                className="rounded-xl"
              />
            </Field>

            <Field label="Company" htmlFor="company" required>
              <Input
                id="company"
                name="company"
                defaultValue={company || ''}
                required
                placeholder="e.g. Acme Corp"
                className="rounded-xl"
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Location" htmlFor="location">
                <Input
                  id="location"
                  name="location"
                  placeholder="e.g. San Francisco, CA"
                  className="rounded-xl"
                />
              </Field>
              <Field label="Job URL" htmlFor="url">
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Source" htmlFor="source">
                <select
                  id="source"
                  name="source"
                  defaultValue={JobSource.RECRUITER}
                  className={selectClasses}
                >
                  {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" htmlFor="status">
                <select
                  id="status"
                  name="status"
                  defaultValue={JobStatus.APPLIED}
                  className={selectClasses}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority" htmlFor="priority">
                <select
                  id="priority"
                  name="priority"
                  defaultValue={JobPriority.B}
                  className={selectClasses}
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notes" htmlFor="notes">
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                placeholder="Add any additional notes about this job..."
                className="rounded-xl"
              />
            </Field>
          </div>
        </GlassPanel>

        {error && (
          <div className="glass glass-subtle rounded-2xl border-error/30 bg-error-bg/50 p-4 text-error-text">
            <p className="font-medium text-sm">Error</p>
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
            className="rounded-full"
          >
            Dismiss
          </Button>
          <Button
            type="submit"
            disabled={isPending}
            className="rounded-full px-6"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Creating…
              </>
            ) : (
              'Create job'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-20 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </dt>
      <dd className="flex-1 min-w-0">{children}</dd>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5"
      >
        {label}
        {required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}
