'use client'

import { useState } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
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
    GHOSTED: number
  }
  onSearchChange: (query: string) => void
  onStatusChange: (status: string) => void
  onDateRangeChange: (range: DateRange) => void
  searchQuery: string
  activeStatus: string
  dateRange: DateRange
}

export function ApplicationsHeader({
  totalJobs,
  statusCounts,
  onSearchChange,
  onStatusChange,
  onDateRangeChange,
  searchQuery,
  activeStatus,
  dateRange
}: ApplicationsHeaderProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const tabs = [
    { id: 'all', label: 'All Applications', count: totalJobs },
    { id: 'SAVED', label: 'Saved', count: statusCounts.SAVED },
    { id: 'APPLIED', label: 'Applied', count: statusCounts.APPLIED },
    { id: 'INTERVIEW', label: 'Interview', count: statusCounts.INTERVIEW },
    { id: 'OFFER', label: 'Offer', count: statusCounts.OFFER },
    { id: 'REJECTED', label: 'Rejected', count: statusCounts.REJECTED },
    { id: 'GHOSTED', label: 'Ghosted', count: statusCounts.GHOSTED },
  ]

  return (
    <div className="space-y-6">
      {/* Title Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Applications</h1>
          <p className="text-muted-foreground mt-2 text-base">View all of your job applications.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onStatusChange(tab.id)}
              className={cn(
                'pb-4 px-2 text-sm font-semibold transition-all duration-200 relative whitespace-nowrap',
                activeStatus === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              <span className={cn(
                "ml-2 px-2 py-0.5 rounded-full text-xs font-medium",
                activeStatus === tab.id
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              )}>{tab.count}</span>
              {activeStatus === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Filters Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for Applications"
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value)
              onSearchChange(e.target.value)
            }}
            className="pl-9 h-10 bg-background border-border"
          />
        </div>

        {/* Right Side: Date Range Picker and Filters */}
        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <DateRangePicker
            value={dateRange}
            onChange={onDateRangeChange}
          />

          {/* Filters Button */}
          <Button
            variant="outline"
            className="h-10 px-4 gap-2 text-foreground hover:bg-accent"
          >
            <SlidersHorizontal className="size-4" />
            <span className="text-sm">Filters</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
