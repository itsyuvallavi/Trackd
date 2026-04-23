'use client'

import { Search, StickyNote, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useState, useMemo, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { JobActionsMenu } from '@/components/jobs/job-actions-menu'
import { StatusDropdown } from '@/components/jobs/status-dropdown'
import { ApplicationsHeader } from '@/components/jobs/applications-header'
import { EmptyState } from '@/components/jobs/empty-state'
import { ExtensionPopup } from '@/components/jobs/extension-popup'
import { Tooltip } from '@/components/ui/tooltip'
import { STATUS_LABELS } from '@/lib/constants'
import type { JobSource, JobStatus } from '@prisma/client'
import { jobSourceDisplayName } from '@/lib/job-source-display'
import { JobCardMobile } from '@/components/jobs/job-card-mobile'
import { useColumnVisibility, type ColumnKey } from '@/components/jobs/column-visibility-settings'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Lazy load modals since they're not immediately visible
const AddJobModal = dynamic(() => import('@/components/jobs/add-job-modal').then(mod => ({ default: mod.AddJobModal })), {
  ssr: false,
})

const AddJobFromUrlModal = dynamic(() => import('@/components/jobs/add-job-from-url-modal').then(mod => ({ default: mod.AddJobFromUrlModal })), {
  ssr: false,
})

// Tokenized status accent bar (left of each row) — drives the redesign's
// colored hairline. All values are OKLCH variables defined in globals.css.
const statusColorIndicators: Record<string, string> = {
  SAVED: 'bg-saved',
  APPLIED: 'bg-info',
  INTERVIEW: 'bg-interview',
  OFFER: 'bg-success',
  REJECTED: 'bg-error',
  ARCHIVED: 'bg-warning',
}

interface Job {
  id: string
  company: string
  title: string
  source: string
  importSource?: string | null
  importJobBoard?: string | null
  tags?: string[]
  location: string | null
  status: string
  notes: string | null
  createdAt?: Date | string
  updatedAt?: Date | string
}

interface JobsPageContentProps {
  jobs: Job[]
}

interface DateRange {
  from: Date | null
  to: Date | null
}

export function JobsPageContent({ jobs }: JobsPageContentProps) {
  const [listJobs, setListJobs] = useState<Job[]>(jobs)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const { visibleColumns, setVisibleColumns, isHydrated } = useColumnVisibility()

  // Keep client list in sync when the server payload changes (e.g. after
  // add/delete or a completed router.refresh()).
  useEffect(() => {
    setListJobs(jobs)
  }, [jobs])

  // Filter jobs based on search query, status, and date range
  // By default, exclude archived and rejected jobs unless explicitly viewing them
  const filteredJobs = useMemo(() => {
    let filtered = listJobs.filter(job => {
      // If viewing "all" (active applications), exclude archived and rejected jobs
      if (activeStatus === 'all') {
        return job.status !== 'ARCHIVED' && job.status !== 'REJECTED'
      }
      // Otherwise, show jobs matching the selected status
      return true
    })

    // Filter by status
    if (activeStatus !== 'all') {
      filtered = filtered.filter(job => job.status === activeStatus)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((job) => {
        const srcLabel = jobSourceDisplayName(
          job.importSource ?? null,
          job.source as JobSource,
          job.importJobBoard,
          { tags: job.tags }
        )
        return (
          job.company.toLowerCase().includes(query) ||
          job.title.toLowerCase().includes(query) ||
          job.location?.toLowerCase().includes(query) ||
          job.source.toLowerCase().includes(query) ||
          srcLabel.toLowerCase().includes(query) ||
          (job.importSource?.toLowerCase().includes(query) ?? false) ||
          (job.notes?.toLowerCase().includes(query) ?? false)
        )
      })
    }

    // Filter by date range
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(job => {
        if (!job.createdAt) return true // Include jobs without dates

        const jobDate = new Date(job.createdAt)

        if (dateRange.from && dateRange.to) {
          const from = new Date(dateRange.from)
          from.setHours(0, 0, 0, 0)
          const to = new Date(dateRange.to)
          to.setHours(23, 59, 59, 999)
          return jobDate >= from && jobDate <= to
        }

        if (dateRange.from) {
          const from = new Date(dateRange.from)
          from.setHours(0, 0, 0, 0)
          return jobDate >= from
        }

        if (dateRange.to) {
          const to = new Date(dateRange.to)
          to.setHours(23, 59, 59, 999)
          return jobDate <= to
        }

        return true
      })
    }

    return filtered
  }, [listJobs, searchQuery, activeStatus, dateRange])

  // Calculate status counts from active jobs only (excluding ARCHIVED and REJECTED for "all" count)
  const statusCounts = listJobs.reduce((acc, job) => {
    const status = job.status as keyof typeof acc
    if (status in acc) {
      acc[status]++
    }
    return acc
  }, {
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0,
    ARCHIVED: 0,
  })
  
  // Calculate total active jobs (excluding ARCHIVED and REJECTED)
  const totalActiveJobs = listJobs.filter(job => 
    job.status !== 'ARCHIVED' && job.status !== 'REJECTED'
  ).length

  // Debounced search handler
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleStatusChange = useCallback((status: string) => {
    setActiveStatus(status)
  }, [])

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range)
  }, [])

  const applyStatusToJob = useCallback(
    (jobId: string, next: JobStatus) => {
      setListJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: next } : j))
      )
    },
    []
  )

  return (
    <>
      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <AddJobFromUrlModal
        isOpen={isAddUrlModalOpen}
        onClose={() => setIsAddUrlModalOpen(false)}
      />
      
      {/* Extension Popup - show for first-time users */}
      <ExtensionPopup />

      {/* Applications Header with Tabs */}
      <ApplicationsHeader
            totalJobs={totalActiveJobs}
            statusCounts={statusCounts}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onDateRangeChange={handleDateRangeChange}
            searchQuery={searchQuery}
            activeStatus={activeStatus}
            dateRange={dateRange}
            onManualAdd={() => setIsAddModalOpen(true)}
            onUrlAdd={() => setIsAddUrlModalOpen(true)}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />

      {/* Table */}
      <div>
          {listJobs.length === 0 ? (
            <EmptyState
              onManualAdd={() => setIsAddModalOpen(true)}
              onUrlAdd={() => setIsAddUrlModalOpen(true)}
            />
          ) : filteredJobs.length === 0 ? (
            <div className="glass glass-subtle rounded-2xl text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
                <Search className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No results found</h3>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: Card View */}
              <div className="md:hidden space-y-2">
                {filteredJobs.map((job, index) => (
                  <JobCardMobile
                    key={job.id}
                    job={job}
                    index={index}
                    onStatusOptimistic={(s) => applyStatusToJob(job.id, s)}
                    onStatusCommitFailed={(revert) =>
                      applyStatusToJob(job.id, revert)
                    }
                  />
                ))}
              </div>

              {/* Desktop: Cards-in-a-list Table */}
              <div className="hidden md:block glass glass-subtle rounded-2xl overflow-hidden">
                {!isHydrated ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : (
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border/60">
                      {visibleColumns.has('role') && (
                        <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
                          Role
                        </TableHead>
                      )}
                      {visibleColumns.has('company') && (
                        <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                          Company
                        </TableHead>
                      )}
                      {visibleColumns.has('source') && (
                        <TableHead 
                          className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5"
                          style={{ width: '220px', minWidth: '220px', maxWidth: '280px' }}
                        >
                          Fetched via (API)
                        </TableHead>
                      )}
                    {visibleColumns.has('location') && (
                      <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 text-center" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                        Location
                      </TableHead>
                    )}
                    {visibleColumns.has('status') && (
                      <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 text-center" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                        Status
                      </TableHead>
                    )}
                    {visibleColumns.has('notes') && (
                      <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 text-center" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                        Notes
                      </TableHead>
                    )}
                    <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 text-center" style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className="border-b border-border/40 last:border-b-0 hover:bg-foreground/[0.03] transition-colors duration-150"
                    >
                      {visibleColumns.has('role') && (
                        <TableCell className="py-2" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
                          <div className="flex items-center gap-2.5">
                            <div
                              aria-hidden
                              className={`w-[3px] h-6 rounded-full shrink-0 ${statusColorIndicators[job.status] || 'bg-muted'}`}
                            />
                            {job.title.length > 30 ? (
                              <Tooltip content={job.title} scrollable={job.title.length > 120}>
                                <Link
                                  href={`/jobs/${job.id}`}
                                  className="text-sm font-medium hover:text-primary transition-colors truncate"
                                  style={{ viewTransitionName: `job-title-${job.id}` }}
                                >
                                  {job.title.substring(0, 30)}...
                                </Link>
                              </Tooltip>
                            ) : (
                              <Link
                                href={`/jobs/${job.id}`}
                                className="text-sm font-medium hover:text-primary transition-colors"
                                style={{ viewTransitionName: `job-title-${job.id}` }}
                              >
                                {job.title}
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.has('company') && (
                        <TableCell className="text-sm font-medium py-1.5" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                          {job.company}
                        </TableCell>
                      )}
                      {visibleColumns.has('source') && (
                        <TableCell 
                          className="text-xs text-muted-foreground py-1.5 break-words"
                          style={{ width: '220px', minWidth: '220px', maxWidth: '280px' }}
                        >
                          {jobSourceDisplayName(
                            job.importSource ?? null,
                            job.source as JobSource,
                            job.importJobBoard,
                            { tags: job.tags }
                          )}
                        </TableCell>
                      )}
                      {visibleColumns.has('location') && (
                        <TableCell className="text-xs text-muted-foreground text-center py-1.5" style={{ width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                          {job.location || '-'}
                        </TableCell>
                      )}
                      {visibleColumns.has('status') && (
                        <TableCell className="text-center py-1.5" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                          <div className="flex justify-center">
                            <StatusDropdown
                              jobId={job.id}
                              currentStatus={job.status as JobStatus}
                              onOptimisticStatus={(s) =>
                                applyStatusToJob(job.id, s)
                              }
                              onStatusCommitFailed={(revert) =>
                                applyStatusToJob(job.id, revert)
                              }
                            />
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.has('notes') && (
                        <TableCell className="py-1.5 text-center" style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}>
                          {job.notes ? (
                            <Tooltip content={job.notes} scrollable>
                              <div className="flex items-center justify-center">
                                <CheckCircle2 className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" aria-label="Has notes" />
                              </div>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">-</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-center py-1.5" style={{ width: '64px', minWidth: '64px', maxWidth: '64px' }}>
                        <div className="flex justify-center">
                          <JobActionsMenu
                            jobId={job.id}
                            jobTitle={job.title}
                            jobCompany={job.company}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                )}
              </div>
            </>
          )}
      </div>
    </>
  )
}
