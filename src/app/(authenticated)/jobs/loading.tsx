import { Skeleton, TableSkeleton, JobCardSkeleton } from '@/components/ui/skeleton'

// Jobs page loading skeleton - shows instantly during navigation
export default function JobsLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar placeholder - hidden on mobile */}
      <div className="hidden md:flex h-16 border-b border-border bg-background items-center px-4 gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      <div className="flex flex-1">
        {/* Left sidebar placeholder - desktop only */}
        <div className="hidden md:flex w-16 border-r border-border flex-col py-4 px-2 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>

        {/* Main content area */}
        <main className="flex-1 px-3 md:px-8 py-3 md:py-6 pb-16 md:pb-6">
          <div className="w-full max-w-[1160px] mx-auto">
            {/* Title Section */}
            <div className="mb-6">
              <Skeleton className="h-8 w-40 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Tabs skeleton - desktop */}
            <div className="hidden md:block mb-3 border-b border-border">
              <div className="flex items-center gap-4 pb-2">
                {['Active Applications', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected', 'Archived'].map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-5 w-6 rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile dropdown skeleton */}
            <div className="md:hidden mb-3">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>

            {/* Search bar skeleton */}
            <div className="mb-3 flex flex-col md:flex-row md:items-center gap-2">
              <Skeleton className="h-9 md:h-8 w-full md:max-w-sm rounded-md" />
              <div className="hidden md:flex items-center gap-1.5">
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>

            {/* Desktop: Table skeleton */}
            <div className="hidden md:block">
              <TableSkeleton rows={8} />
            </div>

            {/* Mobile: Card skeleton */}
            <div className="md:hidden space-y-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <JobCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

