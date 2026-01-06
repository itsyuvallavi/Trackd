import { Skeleton } from '@/components/ui/skeleton'

// Shared loading skeleton for authenticated pages
// This shows instantly during navigation, providing immediate visual feedback
export default function AuthenticatedLoading() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar placeholder */}
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
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-[1160px] mx-auto">
            {/* Page title skeleton */}
            <div className="mb-6">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>

            {/* Content skeleton - generic table/list */}
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              {/* Header */}
              <div className="border-b border-border px-4 py-3">
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              {/* Rows */}
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b border-border/50 px-4 py-4 flex items-center gap-4">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1 max-w-xs" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

