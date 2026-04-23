'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Job, Activity } from '@prisma/client'
import { EditJobModal } from './edit-job-modal'
import { JobTimeline } from './job-timeline'
import { StatusDropdown } from './status-dropdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Edit,
  ExternalLink,
  Calendar,
  MapPin,
  DollarSign,
  Mail,
  User,
  FileText,
  Target,
  StickyNote,
  Save,
} from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'
import { useRelativeTime } from '@/hooks/use-relative-time'
import { STATUS_DOT_COLOR } from '@/lib/constants'
import { jobSourceDisplayName } from '@/lib/job-source-display'
import { updateJobNotes } from '@/app/(authenticated)/jobs/actions'

interface JobDetailViewProps {
  job: Job & { activities: Activity[] }
}

// Derive a 1-2 letter monogram from the company name for the hero avatar.
function companyMonogram(name: string | null | undefined): string {
  if (!name) return '·'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function JobDetailView({ job }: JobDetailViewProps) {
  const router = useRouter()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPending] = useTransition()
  const [notes, setNotes] = useState(job.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const savedAtRelative = useRelativeTime(job.savedAt)
  const updatedAtRelative = useRelativeTime(job.updatedAt)

  const handleSaveNotes = async () => {
    setIsSavingNotes(true)
    try {
      await updateJobNotes(job.id, notes)
      setIsEditingNotes(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to save notes:', error)
      alert('Failed to save notes. Please try again.')
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleCancelNotes = () => {
    setNotes(job.notes || '')
    setIsEditingNotes(false)
  }

  return (
    <div className="w-full">
      {/* Hero header — glass panel with status accent, monogram, title, quick actions */}
      <div className="glass glass-strong rounded-3xl p-4 md:p-6 mb-6 relative overflow-hidden">
        {/* Status accent bar */}
        <div
          aria-hidden
          className={cn(
            'absolute left-0 top-0 bottom-0 w-1 rounded-r-full',
            STATUS_DOT_COLOR[job.status]
          )}
        />

        {/* Back button */}
        <div className="mb-3 md:mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/jobs')}
            className="h-8 -ml-2 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          >
            <ArrowLeft className="size-4 mr-1.5" />
            <span className="text-xs md:text-sm">Back to jobs</span>
          </Button>
        </div>

        <div className="flex items-start gap-3 md:gap-4">
          {/* Monogram */}
          <div
            aria-hidden
            className="shrink-0 size-12 md:size-14 rounded-2xl grid place-items-center bg-foreground/[0.06] border border-border/60 text-base md:text-lg font-semibold tracking-tight text-foreground/80"
          >
            {companyMonogram(job.company)}
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-xl md:text-3xl font-semibold tracking-tight break-words line-clamp-3"
              style={{ viewTransitionName: `job-title-${job.id}` }}
            >
              {job.title}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 truncate">
              {job.company}
              {job.location && (
                <>
                  <span className="mx-2 opacity-40">·</span>
                  <span className="truncate">{job.location}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Actions row */}
        <div className="mt-4 md:mt-5 flex flex-wrap items-center gap-2">
          <StatusDropdown jobId={job.id} currentStatus={job.status} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            disabled={isPending}
            className="h-8 rounded-full"
          >
            <Edit className="size-3.5 mr-1.5" />
            Edit
          </Button>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="h-8 rounded-full">
                <ExternalLink className="size-3.5 mr-1.5" />
                <span className="hidden sm:inline">View posting</span>
                <span className="sm:hidden">Posting</span>
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Key Information */}
            <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
              <h2 className="text-sm md:text-base font-semibold tracking-tight mb-3 md:mb-4 text-foreground/80">
                Details
              </h2>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {job.location && (
                  <DetailRow icon={<MapPin className="size-4" />} label="Location">
                    {job.location}
                  </DetailRow>
                )}

                {job.source && (
                  <DetailRow icon={<FileText className="size-4" />} label="Fetched via">
                    {jobSourceDisplayName(job.importSource, job.source, job.importJobBoard, {
                      tags: job.tags ?? [],
                      activities: job.activities,
                    })}
                  </DetailRow>
                )}

                {job.salary && (
                  <DetailRow icon={<DollarSign className="size-4" />} label="Salary">
                    {job.salary}
                  </DetailRow>
                )}

                {job.appliedAt && (
                  <DetailRow icon={<Calendar className="size-4" />} label="Applied">
                    {formatDate(job.appliedAt)}
                  </DetailRow>
                )}

                {job.interviewAt && (
                  <DetailRow icon={<Calendar className="size-4" />} label="Interview">
                    {formatDate(job.interviewAt)}
                  </DetailRow>
                )}

                <DetailRow icon={<Calendar className="size-4" />} label="Saved">
                  <span className="font-medium">{formatDate(job.savedAt)}</span>
                  <span
                    className="text-xs text-muted-foreground ml-2"
                    suppressHydrationWarning
                  >
                    · {savedAtRelative}
                  </span>
                </DetailRow>
              </div>
            </div>

            {/* Notes */}
            <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-sm md:text-base font-semibold tracking-tight flex items-center gap-2 text-foreground/80">
                  <StickyNote className="size-4" />
                  Notes
                </h2>
                {!isEditingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                    className="h-7 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                  >
                    <Edit className="size-3 mr-1" />
                    <span className="hidden sm:inline">{notes ? 'Edit' : 'Add notes'}</span>
                    <span className="sm:hidden">{notes ? 'Edit' : 'Add'}</span>
                  </Button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add your notes about this job application..."
                    className="min-h-[120px] resize-y bg-background/40 border-border/60 rounded-xl"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelNotes}
                      disabled={isSavingNotes}
                      className="rounded-full"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                      className="rounded-full"
                    >
                      <Save
                        className={cn(
                          'size-3.5 mr-1.5',
                          isSavingNotes && 'animate-spin'
                        )}
                      />
                      {isSavingNotes ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {notes ? (
                    <div
                      className="whitespace-pre-wrap text-foreground break-words overflow-hidden"
                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                    >
                      {notes}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic text-sm">
                      No notes yet. Click &ldquo;Add notes&rdquo; to add your thoughts about this application.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Next Action */}
            {job.nextAction && (
              <div className="glass glass-subtle rounded-2xl p-4 md:p-6 border-warning/30 bg-warning-bg/50">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 size-9 rounded-xl grid place-items-center bg-warning-bg border border-warning/20">
                    <Target className="size-4 text-warning-text" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold tracking-tight text-warning-text mb-0.5">
                      Next action
                    </h2>
                    <p className="text-sm md:text-base text-foreground/90 break-words">
                      {job.nextAction}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
              <h2 className="text-sm md:text-base font-semibold tracking-tight mb-3 md:mb-4 text-foreground/80">
                Activity
              </h2>
              <JobTimeline activities={job.activities} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Actions */}
            <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
              <h2 className="text-sm md:text-base font-semibold tracking-tight mb-3 md:mb-4 text-foreground/80">
                Quick actions
              </h2>
              <div className="space-y-2">
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <Button
                      variant="outline"
                      className="w-full justify-start rounded-xl"
                    >
                      <ExternalLink className="size-4 mr-2" />
                      View job posting
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start rounded-xl"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit className="size-4 mr-2" />
                  Edit details
                </Button>
              </div>
            </div>

            {/* Contact Information */}
            {(job.contactName || job.contactEmail) && (
              <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
                <h2 className="text-sm md:text-base font-semibold tracking-tight mb-3 md:mb-4 text-foreground/80">
                  Contact
                </h2>
                <div className="space-y-3">
                  {job.contactName && (
                    <DetailRow icon={<User className="size-4" />} label="Name">
                      {job.contactName}
                    </DetailRow>
                  )}
                  {job.contactEmail && (
                    <DetailRow icon={<Mail className="size-4" />} label="Email">
                      <a
                        href={`mailto:${job.contactEmail}`}
                        className="text-primary hover:underline break-all font-medium"
                      >
                        {job.contactEmail}
                      </a>
                    </DetailRow>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="glass glass-subtle rounded-2xl p-4 md:p-6">
              <h2 className="text-sm md:text-base font-semibold tracking-tight mb-3 md:mb-4 text-foreground/80">
                Metadata
              </h2>
              <div className="space-y-2.5 text-xs md:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium tabular-nums">
                    {formatDate(job.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Updated</span>
                  <span
                    className="font-medium tabular-nums"
                    suppressHydrationWarning
                  >
                    {updatedAtRelative}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <EditJobModal
        job={job}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  )
}

// Small detail row helper used inside the glass info cards.
function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 size-8 rounded-lg grid place-items-center bg-foreground/[0.04] border border-border/40 text-muted-foreground mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <p className="text-sm md:text-base font-medium break-words">{children}</p>
      </div>
    </div>
  )
}
