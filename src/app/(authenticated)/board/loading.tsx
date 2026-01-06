import { Skeleton, KanbanSkeleton } from '@/components/ui/skeleton'

// Board page loading skeleton - shows instantly during navigation
export default function BoardLoading() {
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
              <Skeleton className="h-4 w-40" />
            </div>

            {/* Kanban board skeleton */}
            <KanbanSkeleton />
          </div>
        </main>
      </div>
    </div>
  )
}

