'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Job, Activity } from '@prisma/client'
import { EditJobModal } from './edit-job-modal'
import { JobTimeline } from './job-timeline'
import { StatusDropdown } from './status-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
} from 'lucide-react'
import { formatDate, formatRelativeTime } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, PRIORITY_LABELS } from '@/lib/constants'

interface JobDetailViewProps {
  job: Job & { activities: Activity[] }
}

export function JobDetailView({ job }: JobDetailViewProps) {
  const router = useRouter()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const statusColorClass = STATUS_COLORS[job.status]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="hover:bg-accent shrink-0"
              >
                <ArrowLeft className="size-4 mr-2" />
                Back
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold mb-2 break-words">{job.title}</h1>
                <p className="text-lg text-muted-foreground">{job.company}</p>
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
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Information */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-medium break-words">{SOURCE_LABELS[job.source]}</p>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatRelativeTime(job.savedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {job.notes && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Notes</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-muted-foreground break-words overflow-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    {job.notes}
                  </div>
                </div>
              </div>
            )}

            {/* Next Action */}
            {job.nextAction && (
              <div className="bg-card border border-border rounded-lg p-6 border-orange-500/20 bg-orange-500/5">
                <div className="flex items-start gap-3">
                  <Target className="size-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold mb-2">Next Action</h2>
                    <p className="text-orange-600 dark:text-orange-400 break-words">{job.nextAction}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Activity Timeline</h2>
              <JobTimeline activities={job.activities} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {job.url && (
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    asChild
                  >
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-4 mr-2" />
                      View Job Posting
                    </a>
                  </Button>
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
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Contact</h2>
                <div className="space-y-3">
                  {job.contactName && (
                    <div className="flex items-start gap-3">
                      <User className="size-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{job.contactName}</p>
                      </div>
                    </div>
                  )}
                  {job.contactEmail && (
                    <div className="flex items-start gap-3">
                      <Mail className="size-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <a
                          href={`mailto:${job.contactEmail}`}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
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
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Metadata</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDate(job.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span className="font-medium">{formatRelativeTime(job.updatedAt)}</span>
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

