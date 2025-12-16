'use client'

import { useState } from 'react'
import { Job, Activity } from '@prisma/client'
import { StatusDropdown } from '@/components/status-dropdown'
import { EditJobModal } from '@/components/edit-job-modal'
import { SOURCE_LABELS, ACTIVITY_TYPE_LABELS } from '@/lib/constants'
import { formatRelativeTime } from '@/lib/utils'
import { deleteJob } from '@/app/(authenticated)/jobs/actions'

interface JobRowProps {
  job: Job & {
    activities: Activity[]
  }
}

export function JobRow({ job }: JobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isNotesExpanded, setIsNotesExpanded] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const lastActivity = job.activities[job.activities.length - 1]

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${job.title}" at ${job.company}?`)) {
      return
    }
    setIsDeleting(true)
    await deleteJob(job.id)
  }

  return (
    <>
      <tr
        className={`border-b border-foreground/10 hover:bg-foreground/5 transition-colors ${
          isDeleting ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <td className="px-4 py-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-foreground/60 hover:text-foreground"
          >
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium">{job.title}</div>
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View posting →
            </a>
          )}
        </td>
        <td className="px-4 py-3">{job.company}</td>
        <td className="px-4 py-3 text-sm text-foreground/70">{job.location || '-'}</td>
        <td className="px-4 py-3 text-sm text-foreground/70">{SOURCE_LABELS[job.source]}</td>
        <td className="px-4 py-3">
          <StatusDropdown jobId={job.id} currentStatus={job.status} />
        </td>
        <td className="px-4 py-3 text-sm text-foreground/70">
          {lastActivity ? formatRelativeTime(lastActivity.createdAt) : '-'}
        </td>
        <td className="px-4 py-3 text-sm text-foreground/70">{job.nextAction || '-'}</td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm"
              disabled={isDeleting}
            >
              Delete
            </button>
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-foreground/5">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold mb-2">Timeline</h4>
                {job.activities.length > 0 ? (
                  <div className="space-y-2">
                    {job.activities.map((activity) => (
                      <div key={activity.id} className="flex gap-2 text-sm">
                        <div className="text-foreground/60 min-w-[100px]">
                          {formatRelativeTime(activity.createdAt)}
                        </div>
                        <div>
                          <span className="font-medium">{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                          {activity.description && (
                            <span className="text-foreground/70">: {activity.description}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground/60">No activity yet</p>
                )}
              </div>

              <div>
                <h4 className="font-semibold mb-2">Details</h4>
                <div className="space-y-1 text-sm">
                  {job.salary && (
                    <div>
                      <span className="text-foreground/60">Salary:</span> {job.salary}
                    </div>
                  )}
                  {job.contactName && (
                    <div>
                      <span className="text-foreground/60">Contact:</span> {job.contactName}
                      {job.contactEmail && ` (${job.contactEmail})`}
                    </div>
                  )}
                  {job.notes && (
                    <div className="max-w-2xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-foreground/60">Notes:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsNotesExpanded(!isNotesExpanded)
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {isNotesExpanded ? '▲ Minimize' : '▼ Expand'}
                        </button>
                      </div>
                      <div
                        className="mt-1 text-foreground/80 whitespace-pre-line text-sm leading-relaxed overflow-hidden transition-all"
                        style={{
                          maxHeight: isNotesExpanded ? '2000px' : '6rem'
                        }}
                      >
                        {job.notes}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}

      <EditJobModal
        job={job}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />
    </>
  )
}
