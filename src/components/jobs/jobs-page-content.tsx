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
import { useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { JobActionsMenu } from '@/components/jobs/job-actions-menu'
import { StatusDropdown } from '@/components/jobs/status-dropdown'
import { ApplicationsHeader } from '@/components/jobs/applications-header'
import { EmptyState } from '@/components/jobs/empty-state'
import { ExtensionPopup } from '@/components/jobs/extension-popup'
import { Tooltip } from '@/components/ui/tooltip'
import { STATUS_LABELS } from '@/lib/constants'
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

// Status badge styling - using more unique shades
const statusStyles = {
  SAVED: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  APPLIED: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  INTERVIEW: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  OFFER: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  REJECTED: 'bg-red-600/10 text-red-300 border-red-600/20',
  ARCHIVED: 'bg-amber-600/10 text-amber-300 border-amber-600/20',
}

// Status color indicators (for left side of job title) - more unique shades
const statusColorIndicators = {
  SAVED: 'bg-slate-500',           // Slate gray
  APPLIED: 'bg-indigo-500',        // Indigo blue
  INTERVIEW: 'bg-violet-500',      // Violet purple
  OFFER: 'bg-emerald-500',         // Emerald green
  REJECTED: 'bg-red-600',          // Crimson red
  ARCHIVED: 'bg-amber-600',         // Amber orange
}

interface Job {
  id: string
  company: string
  title: string
  source: string
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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddUrlModalOpen, setIsAddUrlModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
  const { visibleColumns, setVisibleColumns, isHydrated } = useColumnVisibility()

  // Filter jobs based on search query, status, and date range
  // By default, exclude archived and rejected jobs unless explicitly viewing them
  const filteredJobs = useMemo(() => {
    let filtered = jobs.filter(job => {
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
      filtered = filtered.filter(job =>
        job.company.toLowerCase().includes(query) ||
        job.title.toLowerCase().includes(query) ||
        job.location?.toLowerCase().includes(query) ||
        job.source.toLowerCase().includes(query) ||
        (job.notes?.toLowerCase().includes(query) ?? false)
      )
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
  }, [jobs, searchQuery, activeStatus, dateRange])

  // Calculate status counts from active jobs only (excluding ARCHIVED and REJECTED for "all" count)
  const statusCounts = jobs.reduce((acc, job) => {
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
  const totalActiveJobs = jobs.filter(job => 
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
          {jobs.length === 0 ? (
            <EmptyState
              onManualAdd={() => setIsAddModalOpen(true)}
              onUrlAdd={() => setIsAddUrlModalOpen(true)}
            />
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12 border border-border bg-card">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
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
                  <JobCardMobile key={job.id} job={job} index={index} />
                ))}
              </div>

              {/* Desktop: Table View */}
              <div className="hidden md:block border border-border bg-card overflow-hidden">
                {!isHydrated ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : (
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-b border-border">
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
                          style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}
                        >
                          Source
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
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      {visibleColumns.has('role') && (
                        <TableCell className="py-1.5" style={{ width: '250px', minWidth: '250px', maxWidth: '250px' }}>
                          <div className="flex items-center gap-2">
                            <div className={`w-0.5 h-4 rounded-full shrink-0 ${statusColorIndicators[job.status as keyof typeof statusColorIndicators]}`} />
                            {job.title.length > 30 ? (
                              <Tooltip content={job.title} scrollable={job.title.length > 120}>
                                <Link 
                                  href={`/jobs/${job.id}`}
                                  className="text-sm font-medium hover:text-primary transition-colors truncate"
                                >
                                  {job.title.substring(0, 30)}...
                                </Link>
                              </Tooltip>
                            ) : (
                              <Link 
                                href={`/jobs/${job.id}`}
                                className="text-sm font-medium hover:text-primary transition-colors"
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
                          className="text-xs text-muted-foreground py-1.5"
                          style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}
                        >
                          {job.source}
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
                              currentStatus={job.status as any}
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
                          <JobActionsMenu jobId={job.id} />
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
