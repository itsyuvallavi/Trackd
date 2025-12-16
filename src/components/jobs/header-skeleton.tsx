export function HeaderSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title Section */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 bg-muted rounded w-48 mb-2"></div>
          <div className="h-4 bg-muted rounded w-64"></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-8">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="pb-3 px-1">
              <div className="h-4 bg-muted rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Filters Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="flex-1 max-w-sm">
          <div className="h-10 bg-muted rounded"></div>
        </div>

        {/* Right Side: Date Range Picker and Filters */}
        <div className="flex items-center gap-3">
          <div className="h-10 bg-muted rounded w-48"></div>
          <div className="h-10 bg-muted rounded w-24"></div>
        </div>
      </div>
    </div>
  )
}
