'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Job, Activity } from '@prisma/client'
import { EditJobModal } from './edit-job-modal'
import { JobTimeline } from './job-timeline'
import { StatusDropdown } from './status-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { formatDate } from '@/lib/utils'
import { useRelativeTime } from '@/hooks/use-relative-time'
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_LABELS } from '@/lib/constants'
import { jobSourceDisplayName } from '@/lib/job-source-display'
import { updateJobNotes } from '@/app/(authenticated)/jobs/actions'

interface JobDetailViewProps {
  job: Job & { activities: Activity[] }
}

export function JobDetailView({ job }: JobDetailViewProps) {
  const router = useRouter()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(job.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const savedAtRelative = useRelativeTime(job.savedAt)
  const updatedAtRelative = useRelativeTime(job.updatedAt)

  const statusColorClass = STATUS_COLORS[job.status]

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
    <div className="w-full bg-background">
      {/* Header - Matches /jobs page title position */}
      <div className="mb-6 border-b border-border pb-4 md:pb-6">
        {/* Mobile: Stacked layout */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/jobs')}
              className="hover:bg-accent shrink-0 p-2"
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold break-words line-clamp-2">{job.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusDropdown jobId={job.id} currentStatus={job.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              disabled={isPending}
              className="flex-1"
            >
              <Edit className="size-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Desktop: Original layout */}
        <div className="hidden md:flex items-start justify-between gap-6">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/jobs')}
              className="hover:bg-accent shrink-0"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold mb-2 break-words">{job.title}</h1>
              <p className="text-sm text-muted-foreground">{job.company}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StatusDropdown jobId={job.id} currentStatus={job.status} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
              disabled={isPending}
            >
              <Edit className="size-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Key Information */}
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Details</h2>
              <div className="grid grid-cols-1 gap-3 md:gap-4">
                {job.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="font-medium break-words">{job.location}</p>
                    </div>
                  </div>
                )}

                {job.source && (
                  <div className="flex items-start gap-3">
                    <FileText className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">Fetched via (API)</p>
                      <p className="font-medium break-words">
                        {jobSourceDisplayName(job.importSource, job.source, job.importJobBoard, {
                          tags: job.tags ?? [],
                          activities: job.activities,
                        })}
                      </p>
                    </div>
                  </div>
                )}

                {job.salary && (
                  <div className="flex items-start gap-3">
                    <DollarSign className="size-5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-muted-foreground">Salary</p>
                      <p className="font-medium break-words">{job.salary}</p>
                    </div>
                  </div>
                )}

                {job.appliedAt && (
                  <div className="flex items-start gap-3">
                    <Calendar className="size-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Applied Date</p>
                      <p className="font-medium">{formatDate(job.appliedAt)}</p>
                    </div>
                  </div>
                )}

                {job.interviewAt && (
                  <div className="flex items-start gap-3">
                    <Calendar className="size-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Interview Date</p>
                      <p className="font-medium">{formatDate(job.interviewAt)}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Calendar className="size-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Saved</p>
                    <p className="font-medium">{formatDate(job.savedAt)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                      {savedAtRelative}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes - Always visible and editable */}
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <h2 className="text-base md:text-lg font-semibold flex items-center gap-2">
                  <StickyNote className="size-4 md:size-5" />
                  Notes
                </h2>
                {!isEditingNotes && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                    className="text-xs"
                  >
                    <Edit className="size-3 mr-1" />
                    <span className="hidden sm:inline">{notes ? 'Edit' : 'Add Notes'}</span>
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
                    className="min-h-[120px] resize-y bg-background border-border text-foreground"
                    autoFocus
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelNotes}
                      disabled={isSavingNotes}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes}
                    >
                      {isSavingNotes ? (
                        <>
                          <Save className="size-3 mr-1 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="size-3 mr-1" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {notes ? (
                    <div className="whitespace-pre-wrap text-foreground break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                      {notes}
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No notes yet. Click "Add Notes" to add your thoughts about this job application.</p>
                  )}
                </div>
              )}
            </div>

            {/* Next Action */}
            {job.nextAction && (
              <div className="bg-card border border-border rounded-lg p-4 md:p-6 border-orange-500/20 bg-orange-500/5">
                <div className="flex items-start gap-3">
                  <Target className="size-4 md:size-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base md:text-lg font-semibold mb-2">Next Action</h2>
                    <p className="text-sm md:text-base text-orange-600 dark:text-orange-400 break-words">{job.nextAction}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Activity Timeline</h2>
              <JobTimeline activities={job.activities} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 md:space-y-6">
            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {job.url && (
                  <a href={job.url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <ExternalLink className="size-4 mr-2" />
                      View Job Posting
                    </Button>
                  </a>
                )}
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit className="size-4 mr-2" />
                  Edit Details
                </Button>
              </div>
            </div>

            {/* Contact Information */}
            {(job.contactName || job.contactEmail) && (
              <div className="bg-card border border-border rounded-lg p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Contact</h2>
                <div className="space-y-3">
                  {job.contactName && (
                    <div className="flex items-start gap-3">
                      <User className="size-4 md:size-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm text-muted-foreground">Name</p>
                        <p className="text-sm md:text-base font-medium break-words">{job.contactName}</p>
                      </div>
                    </div>
                  )}
                  {job.contactEmail && (
                    <div className="flex items-start gap-3">
                      <Mail className="size-4 md:size-5 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs md:text-sm text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${job.contactEmail}`}
                          className="text-sm md:text-base font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {job.contactEmail}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-card border border-border rounded-lg p-4 md:p-6">
              <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Metadata</h2>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDate(job.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium" suppressHydrationWarning>{updatedAtRelative}</span>
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

