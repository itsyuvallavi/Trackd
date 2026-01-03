'use client'

import { useState } from 'react'
import { Search, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { AddJobDropdown } from '@/components/jobs/add-job-dropdown'
import { ColumnVisibilitySettings, type ColumnKey } from '@/components/jobs/column-visibility-settings'
import { cn } from '@/lib/utils'

interface DateRange {
  from: Date | null
  to: Date | null
}

interface ApplicationsHeaderProps {
  totalJobs: number
  statusCounts: {
    SAVED: number
    APPLIED: number
    INTERVIEW: number
    OFFER: number
    REJECTED: number
    ARCHIVED: number
  }
  onSearchChange: (query: string) => void
  onStatusChange: (status: string) => void
  onDateRangeChange: (range: DateRange) => void
  searchQuery: string
  activeStatus: string
  dateRange: DateRange
  onManualAdd: () => void
  onUrlAdd: () => void
  visibleColumns: Set<ColumnKey>
  onColumnsChange: (columns: Set<ColumnKey>) => void
}

export function ApplicationsHeader({
  totalJobs,
  statusCounts,
  onSearchChange,
  onStatusChange,
  onDateRangeChange,
  searchQuery,
  activeStatus,
  dateRange,
  onManualAdd,
  onUrlAdd,
  visibleColumns,
  onColumnsChange
}: ApplicationsHeaderProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const tabs = [
    { id: 'all', label: 'Active Applications', count: totalJobs },
    { id: 'SAVED', label: 'Saved', count: statusCounts.SAVED },
    { id: 'APPLIED', label: 'Applied', count: statusCounts.APPLIED },
    { id: 'INTERVIEW', label: 'Interview', count: statusCounts.INTERVIEW },
    { id: 'OFFER', label: 'Offer', count: statusCounts.OFFER },
    { id: 'REJECTED', label: 'Rejected', count: statusCounts.REJECTED },
    { id: 'ARCHIVED', label: 'Archived', count: statusCounts.ARCHIVED },
  ]

  return (
    <>
      {/* Title Section */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">Applications</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{totalJobs} total applications</p>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-border overflow-x-auto scrollbar-hide">
        <div className="flex items-center justify-between gap-3 min-w-max md:min-w-0">
          <div className="flex gap-3 md:gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onStatusChange(tab.id)}
                className={cn(
                  'pb-2 px-1 text-xs font-medium transition-colors relative whitespace-nowrap',
                  'flex items-center gap-1.5',
                  activeStatus === tab.id
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs font-medium",
                  activeStatus === tab.id
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}>{tab.count}</span>
                {activeStatus === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-foreground" />
                )}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            <AddJobDropdown
              onManualAdd={onManualAdd}
              onUrlAdd={onUrlAdd}
            />
            <Tooltip content="Export jobs">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Search and Filters Row */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        {/* Search */}
        <div className="w-full md:flex-1 md:max-w-sm relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search applications..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value)
              onSearchChange(e.target.value)
            }}
            className="pl-8 h-8 text-sm bg-background border-border"
          />
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <ColumnVisibilitySettings
            visibleColumns={visibleColumns}
            onColumnsChange={onColumnsChange}
          />

          {/* Add button visible on mobile */}
          <div className="md:hidden">
            <AddJobDropdown
              onManualAdd={onManualAdd}
              onUrlAdd={onUrlAdd}
            />
          </div>
        </div>
      </div>
    </>
  )
}
