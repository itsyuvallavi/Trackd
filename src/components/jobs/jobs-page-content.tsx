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

const JOB_RENDER_PAGE_SIZE = 50

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
  initialTotal: number
  totalApplications: number
  statusCounts: {
    SAVED: number
    APPLIED: number
    INTERVIEW: number
    OFFER: number
    REJECTED: number
    ARCHIVED: number
  }
}

type JobsListResponse = {
  jobs: Job[]
  total: number | null
  hasMore: boolean
}

export function JobsPageContent({
  jobs,
  initialTotal,
  totalApplications: initialTotalApplications,
  statusCounts: initialStatusCounts,
}: JobsPageContentProps) {
  const [listJobs, setListJobs] = useState<Job[]>(jobs)
  const [currentTotal, setCurrentTotal] = useState(initialTotal)
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts)
  const [totalApplications, setTotalApplications] = useState(
    initialTotalApplications
  )
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const { visibleColumns, setVisibleColumns, isHydrated } = useColumnVisibility()

  // Keep client list in sync when the server payload changes (e.g. after
  // add/delete or a completed router.refresh()).
  useEffect(() => {
    setListJobs(jobs)
    setCurrentTotal(initialTotal)
    setStatusCounts(initialStatusCounts)
    setTotalApplications(initialTotalApplications)
  }, [jobs, initialStatusCounts, initialTotal, initialTotalApplications])

  useEffect(() => {
    setSelectedIds((prev) => {
      const available = new Set(listJobs.map((job) => job.id))
      const next = new Set([...prev].filter((id) => available.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [listJobs])

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedSearchQuery(searchQuery.trim()),
      250
    )
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  const fetchJobsPage = useCallback(
    async ({
      append = false,
      offset = 0,
    }: { append?: boolean; offset?: number } = {}) => {
      setIsPageLoading(true)
      setPageError(null)

      const params = new URLSearchParams({
        status: activeStatus,
        limit: String(JOB_RENDER_PAGE_SIZE),
        offset: String(offset),
      })
      if (append) {
        params.set('includeTotal', 'false')
      }
      if (debouncedSearchQuery) {
        params.set('q', debouncedSearchQuery)
      }

      try {
        const response = await fetch(`/api/jobs/list?${params.toString()}`)
        if (!response.ok) throw new Error('Could not load applications')
        const payload = (await response.json()) as JobsListResponse
        setListJobs((prev) => (append ? [...prev, ...payload.jobs] : payload.jobs))
        if (payload.total !== null) {
          setCurrentTotal(payload.total)
        }
      } catch (error) {
        console.error('[jobs] List page fetch failed:', error)
        setPageError('Could not refresh applications. Try again.')
      } finally {
        setIsPageLoading(false)
      }
    },
    [activeStatus, debouncedSearchQuery]
  )

  useEffect(() => {
    if (activeStatus === 'all' && debouncedSearchQuery === '') {
      setListJobs(jobs)
      setCurrentTotal(initialTotal)
      return
    }
    void fetchJobsPage()
  }, [activeStatus, debouncedSearchQuery, fetchJobsPage, initialTotal, jobs])

  const totalActiveJobs = useMemo(
    () => statusCounts.APPLIED + statusCounts.INTERVIEW + statusCounts.OFFER,
    [statusCounts]
  )

  const filteredJobs = listJobs
  const visibleJobs = filteredJobs
  const hasMoreFilteredJobs = listJobs.length < currentTotal

  const visibleJobIds = useMemo(
    () => visibleJobs.map((job) => job.id),
    [visibleJobs]
  )
  const selectedVisibleIds = useMemo(
    () => visibleJobIds.filter((id) => selectedIds.has(id)),
    [selectedIds, visibleJobIds]
  )
  const selectedVisibleCount = selectedVisibleIds.length
  const allVisibleSelected =
    visibleJobIds.length > 0 && selectedVisibleCount === visibleJobIds.length

  // Debounced search handler
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const handleStatusChange = useCallback((status: string) => {
    setActiveStatus(status)
  }, [])

  const applyStatusToJob = useCallback(
    (jobId: string, next: JobStatus) => {
      let previousStatus: JobStatus | null = null
      setListJobs((prev) =>
        prev
          .map((j) => {
            if (j.id !== jobId) return j
            previousStatus = j.status as JobStatus
            return { ...j, status: next }
          })
          .filter((j) =>
            activeStatus === 'all'
              ? isActiveApplicationStatus(j.status)
              : j.status === activeStatus
          )
      )
      if (previousStatus && previousStatus !== next) {
        const previousKey = previousStatus
        setStatusCounts((prev) => ({
          ...prev,
          [previousKey]: Math.max(0, prev[previousKey] - 1),
          [next]: prev[next] + 1,
        }))
        const stayedVisible =
          activeStatus === 'all'
            ? isActiveApplicationStatus(next)
            : next === activeStatus
        if (!stayedVisible) {
          setCurrentTotal((total) => Math.max(0, total - 1))
        }
      }
    },
    [activeStatus]
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
      const previousListJobs = listJobs
      const previousStatusCounts = statusCounts
      const previousCurrentTotal = currentTotal
      setBulkBusy(true)
      setBulkMessage(null)
      setListJobs((prev) =>
        prev
          .map((job) => (ids.includes(job.id) ? { ...job, status } : job))
          .filter((job) =>
            activeStatus === 'all'
              ? isActiveApplicationStatus(job.status)
              : job.status === activeStatus
          )
      )
      setStatusCounts((prev) => {
        const next = { ...prev }
        for (const previous of previousStatuses.values()) {
          if (previous === status) continue
          const previousKey = previous as JobStatus
          next[previousKey] = Math.max(0, next[previousKey] - 1)
          next[status] += 1
        }
        return next
      })
      const rowsLeavingCurrentFilter = [...previousStatuses.values()].filter(
        (previous) => {
          if (previous === status) return false
          return activeStatus === 'all'
            ? !isActiveApplicationStatus(status)
            : status !== activeStatus
        }
      ).length
      if (rowsLeavingCurrentFilter > 0) {
        setCurrentTotal((total) => Math.max(0, total - rowsLeavingCurrentFilter))
      }

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
        setListJobs(previousListJobs)
        setStatusCounts(previousStatusCounts)
        setCurrentTotal(previousCurrentTotal)
        setBulkMessage('Bulk update failed. No saved status changes were kept.')
      } finally {
        setBulkBusy(false)
      }
    },
    [
      activeStatus,
      bulkBusy,
      currentTotal,
      listJobs,
      selectedVisibleIds,
      statusCounts,
    ]
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
        <div className="mb-4 hidden flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/45 px-3 py-2 text-sm md:flex">
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
      {pageError && (
        <div className="mb-3 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-sm text-error-text">
          {pageError}
        </div>
      )}

      {/* Table */}
      <div>
          {totalApplications === 0 && activeStatus === 'all' && !searchQuery.trim() ? (
            <EmptyState
              onManualAdd={() => setIsAddModalOpen(true)}
              onUrlAdd={() => setIsAddUrlModalOpen(true)}
            />
          ) : filteredJobs.length === 0 && !isPageLoading ? (
            <div className="glass glass-subtle rounded-2xl text-center py-12">
              <div className="mx-auto w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-3">
                <Search className="size-6 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">No results found</h3>
              <p className="text-xs text-muted-foreground">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="glass glass-subtle rounded-2xl py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="mx-auto mb-3 size-5 animate-spin text-primary" />
              Loading applications...
            </div>
          ) : (
            <>
              {/* Mobile: Card View */}
              <div className="md:hidden space-y-2">
                {visibleJobs.map((job, index) => (
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
                  {visibleJobs.map((job) => (
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
              {hasMoreFilteredJobs && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Showing {visibleJobs.length} of {currentTotal} matching applications.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      void fetchJobsPage({
                        append: true,
                        offset: listJobs.length,
                      })
                    }
                    disabled={isPageLoading}
                    className="inline-flex items-center rounded-full border border-border/70 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    {isPageLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
      </div>
    </>
  )
}
