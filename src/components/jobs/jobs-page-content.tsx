'use client'

import { Archive, CheckCircle2, Loader2, Search, XCircle } from 'lucide-react'
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
import type { JobSource, JobStatus } from '@prisma/client'
import { jobSourceDisplayName } from '@/lib/job-source-display'
import { JobCardMobile } from '@/components/jobs/job-card-mobile'
import { useColumnVisibility } from '@/components/jobs/column-visibility-settings'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { updateJobStatus } from '@/app/(authenticated)/jobs/actions'
import { isActiveApplicationStatus } from '@/lib/job-status-groups'

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

export function JobsPageContent({ jobs }: JobsPageContentProps) {
  const [listJobs, setListJobs] = useState<Job[]>(jobs)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const { visibleColumns, setVisibleColumns, isHydrated } = useColumnVisibility()

  // Keep client list in sync when the server payload changes (e.g. after
  // add/delete or a completed router.refresh()).
  useEffect(() => {
    setListJobs(jobs)
  }, [jobs])

  useEffect(() => {
    setSelectedIds((prev) => {
      const available = new Set(jobs.map((job) => job.id))
      const next = new Set([...prev].filter((id) => available.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [jobs])

  // Filter jobs based on search query, status, and date range
  // By default, show only real active applications. SAVED jobs are review/queue
  // items and live in their own tab.
  const filteredJobs = useMemo(() => {
    let filtered = listJobs.filter(job => {
      if (activeStatus === 'all') {
        return isActiveApplicationStatus(job.status)
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

    return filtered
  }, [listJobs, searchQuery, activeStatus])

  const visibleJobIds = useMemo(
    () => filteredJobs.map((job) => job.id),
    [filteredJobs]
  )
  const selectedVisibleIds = useMemo(
    () => visibleJobIds.filter((id) => selectedIds.has(id)),
    [selectedIds, visibleJobIds]
  )
  const selectedVisibleCount = selectedVisibleIds.length
  const allVisibleSelected =
    visibleJobIds.length > 0 && selectedVisibleCount === visibleJobIds.length

  // Calculate status counts for each explicit tab.
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
  
  const totalApplications = listJobs.length
  const totalActiveJobs = listJobs.filter((job) =>
    isActiveApplicationStatus(job.status)
  ).length

  // Debounced search handler
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleStatusChange = useCallback((status: string) => {
    setActiveStatus(status)
  }, [])

  const applyStatusToJob = useCallback(
    (jobId: string, next: JobStatus) => {
      setListJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: next } : j))
      )
    },
    []
  )

  const toggleJobSelection = useCallback((jobId: string) => {
    setBulkMessage(null)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) {
        next.delete(jobId)
      } else {
        next.add(jobId)
      }
      return next
    })
  }, [])

  const toggleVisibleSelection = useCallback(() => {
    setBulkMessage(null)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleJobIds.forEach((id) => next.delete(id))
      } else {
        visibleJobIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [allVisibleSelected, visibleJobIds])

  const clearSelection = useCallback(() => {
    setBulkMessage(null)
    setSelectedIds(new Set())
  }, [])

  const applyBulkStatus = useCallback(
    async (status: JobStatus) => {
      const ids = selectedVisibleIds
      if (ids.length === 0 || bulkBusy) return

      const previousStatuses = new Map(
        listJobs
          .filter((job) => ids.includes(job.id))
          .map((job) => [job.id, job.status])
      )
      setBulkBusy(true)
      setBulkMessage(null)
      setListJobs((prev) =>
        prev.map((job) => (ids.includes(job.id) ? { ...job, status } : job))
      )

      try {
        await Promise.all(ids.map((id) => updateJobStatus(id, status)))
        setSelectedIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.delete(id))
          return next
        })
        setBulkMessage(`${ids.length} application${ids.length === 1 ? '' : 's'} updated.`)
      } catch (error) {
        console.error('[jobs] Bulk status update failed:', error)
        setListJobs((prev) =>
          prev.map((job) => {
            const previous = previousStatuses.get(job.id)
            return previous ? { ...job, status: previous } : job
          })
        )
        setBulkMessage('Bulk update failed. No saved status changes were kept.')
      } finally {
        setBulkBusy(false)
      }
    },
    [bulkBusy, listJobs, selectedVisibleIds]
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
            totalApplications={totalApplications}
            statusCounts={statusCounts}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            searchQuery={searchQuery}
            activeStatus={activeStatus}
            onManualAdd={() => setIsAddModalOpen(true)}
            onUrlAdd={() => setIsAddUrlModalOpen(true)}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />

      {filteredJobs.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/45 px-3 py-2 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleVisibleSelection}
              disabled={bulkBusy}
              className="size-4 rounded border-border bg-background accent-primary"
              aria-label="Select visible applications"
            />
            <span>Select visible</span>
          </label>
          <span className="text-muted-foreground">
            <span className="tabular-nums text-foreground">{selectedVisibleCount}</span> selected
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkMessage && (
              <span className="text-xs text-muted-foreground">{bulkMessage}</span>
            )}
            <button
              type="button"
              onClick={() => applyBulkStatus('APPLIED')}
              disabled={selectedVisibleCount === 0 || bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {bulkBusy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              Mark applied
            </button>
            <button
              type="button"
              onClick={() => applyBulkStatus('ARCHIVED')}
              disabled={selectedVisibleCount === 0 || bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Archive className="size-3.5" />
              Archive
            </button>
            <button
              type="button"
              onClick={() => applyBulkStatus('REJECTED')}
              disabled={selectedVisibleCount === 0 || bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.04] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <XCircle className="size-3.5" />
              Reject
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedVisibleCount === 0 || bulkBusy}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
                      <TableHead className="py-1.5 pl-3 pr-1 w-10 min-w-10 max-w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleVisibleSelection}
                          disabled={bulkBusy}
                          className="size-4 rounded border-border bg-background accent-primary"
                          aria-label="Select visible applications"
                        />
                      </TableHead>
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
                      <TableHead
                        className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 px-2 text-center align-middle w-20 min-w-20 max-w-20"
                        scope="col"
                      >
                        <span className="block w-full text-center">Notes</span>
                      </TableHead>
                    )}
                    <TableHead
                      className="text-muted-foreground font-medium text-xs uppercase tracking-wider py-1.5 px-2 text-center align-middle w-20 min-w-20 max-w-20"
                      scope="col"
                    >
                      <span className="block w-full text-center">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      className={cn(
                        'border-b border-border/40 last:border-b-0 hover:bg-foreground/[0.03] transition-colors duration-150',
                        selectedIds.has(job.id) && 'bg-primary/5'
                      )}
                    >
                      <TableCell className="py-2 pl-3 pr-1 w-10 min-w-10 max-w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(job.id)}
                          onChange={() => toggleJobSelection(job.id)}
                          disabled={bulkBusy}
                          className="size-4 rounded border-border bg-background accent-primary"
                          aria-label={`Select ${job.title} at ${job.company}`}
                        />
                      </TableCell>
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
                        <TableCell className="w-20 min-w-20 max-w-20 py-1.5 px-2 text-center align-middle">
                          {job.notes ? (
                            <Tooltip content={job.notes} scrollable>
                              <div className="flex min-h-6 w-full items-center justify-center">
                                <CheckCircle2 className="size-4 text-muted-foreground hover:text-foreground transition-colors cursor-help" aria-label="Has notes" />
                              </div>
                            </Tooltip>
                          ) : (
                            <div className="flex min-h-6 w-full items-center justify-center">
                              <span className="text-xs text-muted-foreground/50">-</span>
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="w-20 min-w-20 max-w-20 py-1.5 px-2 text-center align-middle">
                        <div className="flex min-h-6 w-full items-center justify-center">
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
