# Mobile Optimization Plan - Job Tracker App

## Overview

Transform the desktop-first job tracker into a fully responsive mobile experience with:
- Bottom tab navigation (iOS/Android style)
- Card view for job listings
- Swipeable Kanban board
- Touch-optimized UI throughout

---

## Current State

| Area | Issue |
|------|-------|
| Sidebar | Fixed 64px width, no mobile collapse |
| Tables | 7 columns, no card view alternative |
| Kanban Board | Forces 3-6 columns, no mobile adaptation |
| Tab Navigation | Overflows horizontally, no scroll |
| Spacing | Large padding (px-8, py-6) doesn't scale |
| Top Bar | Search bar may overflow on small screens |

---

## Phase 1: Core Layout Infrastructure

### 1.1 Create Mobile Detection Hook

**New file:** `src/hooks/use-media-query.ts`

```typescript
'use client'

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const media = window.matchMedia(query)
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    const listener = () => setMatches(media.matches)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [matches, query])

  return matches
}

export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 768px) and (max-width: 1023px)')
}
```

### 1.2 Create Bottom Tab Bar

**New file:** `src/components/layout/bottom-tab-bar.tsx`

- Fixed at bottom, visible only on mobile (`md:hidden`)
- 4 nav items: Today, Jobs, Board, Settings
- 44px minimum touch targets
- Safe area padding for iPhone notch

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Kanban, FolderOpen, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/today', icon: LayoutGrid, label: 'Today' },
  { href: '/jobs', icon: FolderOpen, label: 'Jobs' },
  { href: '/board', icon: Kanban, label: 'Board' },
  { href: '/settings/integrations', icon: Settings, label: 'Settings' },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href ||
            (item.href === '/settings/integrations' && pathname.startsWith('/settings'))

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] px-3 py-2 rounded-lg transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="size-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

### 1.3 Modify Sidebar for Desktop Only

**Modify:** `src/components/layout/Sidebar.tsx`

Add `hidden md:flex` to hide on mobile:

```typescript
<aside className={cn(
  'hidden md:flex',  // ADD THIS
  'bg-card border-r-2 border-border flex-col py-4 fixed left-0 top-[72px] h-[calc(100vh-72px)] w-16 shadow-xl z-20'
)}>
```

### 1.4 Create App Shell Wrapper

**New file:** `src/components/layout/app-shell.tsx`

```typescript
'use client'

import { Sidebar } from './Sidebar'
import { SimpleTopBar } from './simple-top-bar'
import { BottomTabBar } from './bottom-tab-bar'

interface AppShellProps {
  children: React.ReactNode
  showEmailNotification?: boolean
}

export function AppShell({ children, showEmailNotification }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />
      <SimpleTopBar showEmailNotification={showEmailNotification} />

      <main className="flex-1 flex flex-col relative z-10 pt-[64px] md:pt-[88px] pb-20 md:pb-0 md:ml-16">
        {children}
      </main>

      <BottomTabBar />
    </div>
  )
}
```

### 1.5 Update Top Bar for Mobile

**Modify:** `src/components/layout/simple-top-bar.tsx`

- Compact height on mobile (64px vs 88px)
- Hide search bar on mobile
- Reduce padding: `px-4 md:px-6 py-3 md:py-4`

### 1.6 Add Mobile CSS Utilities

**Modify:** `src/app/globals.css`

```css
/* Mobile safe area support */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}

/* Touch target minimum size */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

/* Mobile-first scrolling containers */
.mobile-scroll-x {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}

.mobile-scroll-x::-webkit-scrollbar {
  display: none;
}

.snap-start {
  scroll-snap-align: start;
}
```

---

## Phase 2: Jobs List - Mobile Cards

### 2.1 Create Job Card Component

**New file:** `src/components/jobs/job-card-mobile.tsx`

```typescript
'use client'

import Link from 'next/link'
import { MapPin, StickyNote } from 'lucide-react'
import { StatusDropdown } from './status-dropdown'
import { JobActionsMenu } from './job-actions-menu'

interface Job {
  id: string
  company: string
  title: string
  source: string
  location: string | null
  status: string
  notes: string | null
}

export function JobCardMobile({ job }: { job: Job }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      {/* Header: Title + Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">{job.company}</p>
        </Link>
        <JobActionsMenu jobId={job.id} />
      </div>

      {/* Status + Location Row */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <StatusDropdown jobId={job.id} currentStatus={job.status as any} />
        {job.location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5" />
            <span className="truncate max-w-[120px]">{job.location}</span>
          </div>
        )}
      </div>

      {/* Source + Notes Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{job.source}</span>
        {job.notes && (
          <div className="flex items-center gap-1">
            <StickyNote className="size-3" />
            <span>Has notes</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2.2 Update Jobs Page Content

**Modify:** `src/components/jobs/jobs-page-content.tsx`

Add conditional rendering for mobile cards vs desktop table:

```typescript
{filteredJobs.length > 0 && (
  <>
    {/* Mobile: Card View */}
    <div className="md:hidden space-y-3">
      {filteredJobs.map((job) => (
        <JobCardMobile key={job.id} job={job} />
      ))}
    </div>

    {/* Desktop: Table View */}
    <div className="hidden md:block border border-border rounded-lg bg-card overflow-hidden shadow-md">
      <Table>
        {/* existing table code */}
      </Table>
    </div>
  </>
)}
```

### 2.3 Fix Tab Navigation Overflow

**Modify:** `src/components/jobs/applications-header.tsx`

- Add horizontal scroll: `overflow-x-auto scrollbar-hide`
- Increase touch targets: `min-h-[44px]`
- Move "Add Job" button to filter row on mobile

---

## Phase 3: Mobile Kanban Board

### 3.1 Horizontal Swipeable Columns

**Modify:** `src/components/board/kanban-board.tsx`

```typescript
{/* Mobile: Horizontal scrollable columns */}
<div className="md:hidden overflow-x-auto mobile-scroll-x pb-4 -mx-4 px-4">
  <div className="flex gap-4" style={{ width: `${columns.length * 280}px` }}>
    {columns.map((column) => (
      <div key={column.status} className="w-[260px] flex-shrink-0 snap-start">
        <DroppableColumn
          status={column.status}
          label={column.label}
          color={column.color}
          jobs={jobsByStatus[column.status]}
          isDragging={isDragging}
          isMobile={true}
        />
      </div>
    ))}
  </div>
</div>

{/* Desktop: Grid layout */}
<div className="hidden md:grid md:grid-cols-3 xl:grid-cols-6 gap-4">
  {columns.map((column) => (
    <DroppableColumn
      key={column.status}
      status={column.status}
      label={column.label}
      color={column.color}
      jobs={jobsByStatus[column.status]}
      isDragging={isDragging}
      isMobile={false}
    />
  ))}
</div>
```

### 3.2 Update Column Heights

**Modify:** `src/components/board/board-column.tsx`

- Mobile: `h-[60vh] min-h-[300px]`
- Desktop: Keep `h-[calc(100vh-250px)]`

---

## Phase 4: Page-Level Updates

Apply `<AppShell>` wrapper and responsive padding to all pages:

| Page | File | Changes |
|------|------|---------|
| Jobs | `src/app/(authenticated)/jobs/page.tsx` | Wrap with AppShell, `px-4 md:px-8` |
| Board | `src/app/(authenticated)/board/page.tsx` | Wrap with AppShell, `px-4 md:px-8` |
| Today | `src/app/(authenticated)/today/page.tsx` | Wrap with AppShell, horizontal scroll on tables |
| Settings | `src/app/(authenticated)/settings/integrations/page.tsx` | Wrap with AppShell, `px-4 md:px-8` |
| Job Detail | `src/components/jobs/job-detail-view.tsx` | `px-4 md:px-6`, adjust grid gaps |

---

## Phase 5: Touch Optimizations

### Update UI Components

- **Buttons** (`src/components/ui/button.tsx`): Ensure `min-h-[44px]` for all sizes
- **Status Dropdown**: Add `min-h-[44px]` to trigger
- **Table Cells**: Use `p-3 md:p-4` for touch-friendly spacing
- **Icon Buttons**: Use `size-5` minimum (20px)

---

## Phase 6: Optional Enhancements

### 6.1 Floating Action Button (FAB)

**New file:** `src/components/ui/floating-action-button.tsx`

- Fixed position above bottom tab bar
- Quick "Add Job" action on mobile

### 6.2 Pull-to-Refresh

**New file:** `src/components/ui/pull-to-refresh.tsx`

- Native-feeling refresh gesture
- Triggers `router.refresh()`

---

## Implementation Order

1. **Phase 1** - Core layout (must do first)
2. **Phase 2** - Jobs card view (high impact)
3. **Phase 3** - Kanban mobile (complex)
4. **Phase 4** - Apply AppShell to all pages
5. **Phase 5** - Touch optimization polish
6. **Phase 6** - Optional enhancements

---

## Files Summary

### Files to Create
- `src/hooks/use-media-query.ts`
- `src/components/layout/bottom-tab-bar.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/jobs/job-card-mobile.tsx`

### Files to Modify
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/simple-top-bar.tsx`
- `src/components/jobs/jobs-page-content.tsx`
- `src/components/jobs/applications-header.tsx`
- `src/components/board/kanban-board.tsx`
- `src/components/board/board-column.tsx`
- `src/app/globals.css`
- `src/app/(authenticated)/jobs/page.tsx`
- `src/app/(authenticated)/board/page.tsx`
- `src/app/(authenticated)/today/page.tsx`
- `src/app/(authenticated)/settings/integrations/page.tsx`
- `src/components/jobs/job-detail-view.tsx`
- `src/components/ui/button.tsx`

---

## Testing Checklist

- [ ] iPhone Safari (iOS 15+)
- [ ] Android Chrome
- [ ] Touch targets 44px minimum
- [ ] Bottom tab bar with safe area insets
- [ ] Horizontal Kanban scroll with snap
- [ ] Card view on jobs page
- [ ] Search functionality on mobile
- [ ] Modals display correctly
- [ ] Landscape orientation
- [ ] Tablet breakpoint (768-1024px)
