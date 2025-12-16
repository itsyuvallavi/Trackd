'use client'

import { Search, Download, Bell, CheckSquare } from 'lucide-react'
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
import { AddJobModal } from '@/components/jobs/add-job-modal'
import { AddJobDropdown } from '@/components/jobs/add-job-dropdown'
import { JobActionsMenu } from '@/components/jobs/job-actions-menu'
import { ApplicationsHeader } from '@/components/jobs/applications-header'
import { EmptyState } from '@/components/jobs/empty-state'
import { UserProfileMenu } from '@/components/layout/user-profile-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { STATUS_LABELS } from '@/lib/constants'

// Status badge styling
const statusStyles = {
  SAVED: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  APPLIED: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  INTERVIEW: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  OFFER: 'bg-green-500/10 text-green-300 border-green-500/20',
  REJECTED: 'bg-red-500/10 text-red-300 border-red-500/20',
  GHOSTED: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
}

// Status color indicators (for left side of job title)
const statusColorIndicators = {
  SAVED: 'bg-gray-500',
  APPLIED: 'bg-blue-500',
  INTERVIEW: 'bg-purple-500',
  OFFER: 'bg-green-500',
  REJECTED: 'bg-red-500',
  GHOSTED: 'bg-orange-500',
}

interface Job {
  id: string
  company: string
  title: string
  source: string
  location: string | null
  status: string
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
  const sidebarWidth = '4rem' // Fixed sidebar width (64px = w-16)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeStatus, setActiveStatus] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })

  // Filter jobs based on search query, status, and date range
  const filteredJobs = useMemo(() => {
    let filtered = jobs

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
        job.source.toLowerCase().includes(query)
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

  // Calculate status counts from all jobs (not filtered)
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
    GHOSTED: 0,
  })

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
      <AddJobModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

    <div className="flex-1 flex flex-col bg-muted/10" style={{ marginLeft: sidebarWidth }}>
      {/* Fixed Header */}
      <div className="fixed top-0 right-0 bg-card/95 backdrop-blur-sm border-b border-border shadow-sm z-10" style={{ left: sidebarWidth }}>
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Logo + App Name */}
            <div className="flex items-center gap-3">
              <CheckSquare className="size-6 text-foreground" strokeWidth={2.5} />
              <span className="text-xl font-semibold text-foreground">Trackd</span>
            </div>

            {/* Center: Search Bar */}
            <div className="flex-1 max-w-xl relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by company, role..."
                className="pl-9 h-10 bg-background border-border shadow-sm text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Right: Actions + Notification + User Profile */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground font-medium">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </span>

              <div className="flex items-center gap-2">
                <AddJobDropdown onManualAdd={() => setIsAddModalOpen(true)} />
                <Tooltip content="Export jobs">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-9 p-0 text-foreground hover:text-primary hover:bg-primary/10 border border-border/50 transition-all duration-200"
                  >
                    <Download className="size-4" />
                  </Button>
                </Tooltip>
              </div>

              <div className="h-8 w-px bg-border" />

              {/* Notification Bell */}
              <Tooltip content="Notifications">
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-9 p-0 text-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                >
                  <Bell className="size-5" />
                </Button>
              </Tooltip>

              {/* User Profile with Dropdown */}
              <UserProfileMenu />
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto pt-[88px]">
        <div className="px-8 py-6">
          {/* Applications Header with Tabs */}
          <ApplicationsHeader
            totalJobs={jobs.length}
            statusCounts={statusCounts}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onDateRangeChange={handleDateRangeChange}
            searchQuery={searchQuery}
            activeStatus={activeStatus}
            dateRange={dateRange}
          />

          {/* Table */}
          <div className="mt-6">
          {jobs.length === 0 ? (
            <EmptyState
              onManualAdd={() => setIsAddModalOpen(true)}
              onUrlAdd={() => window.location.href = '/jobs/new-url'}
            />
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-16 border border-border rounded-lg bg-card">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Search className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search or filters to find what you're looking for.
              </p>
            </div>
          ) : (
            <div className="border border-border rounded-lg bg-card overflow-hidden shadow-md">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2 border-border bg-muted/30">
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4">
                      Company
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4">
                      Role
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4">
                      Source
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                      Location
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                      Status
                    </TableHead>
                    <TableHead className="text-muted-foreground font-bold text-xs uppercase tracking-wider py-4 text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job, index) => (
                    <TableRow
                      key={job.id}
                      className={`
                        ${index === filteredJobs.length - 1 ? 'border-0' : ''}
                        ${index % 2 === 0 ? 'bg-card' : 'bg-muted/30'}
                        hover:bg-accent transition-colors duration-200
                      `}
                    >
                      <TableCell className="text-foreground font-medium py-4">
                        {job.company}
                      </TableCell>
                      <TableCell className="text-foreground py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-6 rounded-full ${statusColorIndicators[job.status as keyof typeof statusColorIndicators]}`} />
                          <span className="font-medium">{job.title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {job.source}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-center py-4 text-sm">
                        {job.location || '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Badge
                            className={statusStyles[job.status as keyof typeof statusStyles]}
                          >
                            {STATUS_LABELS[job.status as keyof typeof STATUS_LABELS]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <JobActionsMenu jobId={job.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
