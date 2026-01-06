import { Skeleton, StatsSkeleton } from '@/components/ui/skeleton'

// Today page loading skeleton - shows instantly during navigation
export default function TodayLoading() {
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
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-4 md:py-6">
            {/* Title Section */}
            <div className="mb-6 md:mb-8">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>

            {/* Status Counter Widget Skeleton */}
            <div className="mb-6 md:mb-8">
              <StatsSkeleton />
            </div>

            {/* Recent Status Changes Section Skeleton */}
            <div className="space-y-8">
              <div>
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="border border-border rounded-lg overflow-hidden">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border-b border-border/50 p-4 flex items-center gap-4">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-40 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

