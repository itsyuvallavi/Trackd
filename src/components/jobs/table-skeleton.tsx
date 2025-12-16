export function TableSkeleton() {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden shadow-md">
      <div className="animate-pulse">
        {/* Table Header */}
        <div className="border-b-2 border-border bg-muted/30 px-6 py-4">
          <div className="grid grid-cols-6 gap-4">
            <div className="h-3 bg-muted rounded w-20"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
            <div className="h-3 bg-muted rounded w-24"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
            <div className="h-3 bg-muted rounded w-16"></div>
          </div>
        </div>

        {/* Table Rows */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={`px-6 py-4 border-b border-border ${
              i % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
          >
            <div className="grid grid-cols-6 gap-4 items-center">
              {/* Company */}
              <div className="h-4 bg-muted rounded w-28"></div>

              {/* Role */}
              <div className="flex items-center gap-2">
                <div className="w-1 h-6 bg-muted rounded-full"></div>
                <div className="h-4 bg-muted rounded w-32"></div>
              </div>

              {/* Source */}
              <div className="h-4 bg-muted rounded w-20"></div>

              {/* Location */}
              <div className="h-4 bg-muted rounded w-24"></div>

              {/* Status Badge */}
              <div className="flex justify-center">
                <div className="h-6 bg-muted rounded-full w-20"></div>
              </div>

              {/* Actions */}
              <div className="flex justify-center">
                <div className="h-8 w-8 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
