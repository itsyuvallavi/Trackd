import { Skeleton } from '@/components/ui/skeleton'

// Profile page loading skeleton - shows instantly during navigation
export default function ProfileLoading() {
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
          <div className="max-w-2xl mx-auto px-4 md:px-8 py-4 md:py-10">
            {/* Profile Section */}
            <div className="mb-8">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-56 mb-6" />

              <div className="rounded-xl border border-border bg-card/80 px-6 py-6 space-y-6">
                {/* Email */}
                <div>
                  <Skeleton className="h-3 w-12 mb-2" />
                  <Skeleton className="h-4 w-48 mb-1" />
                  <Skeleton className="h-3 w-64" />
                </div>

                {/* Theme */}
                <div>
                  <Skeleton className="h-3 w-12 mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-10 w-20 rounded-md" />
                    <Skeleton className="h-10 w-20 rounded-md" />
                  </div>
                </div>

                {/* Name field */}
                <div>
                  <Skeleton className="h-4 w-12 mb-2" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>

                {/* Avatar URL field */}
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-3 w-72 mt-2" />
                </div>

                {/* Save button */}
                <Skeleton className="h-10 w-28 rounded-md" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

