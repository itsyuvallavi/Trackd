# Performance Analysis & Optimization Recommendations

**Based on Vercel Speed Insights Data (Jan 6, 2025)**

## Critical Issues Summary

### Overall Score: **73** (Needs Improvement - Target: >90)

**Primary Problems:**
- **FCP**: 4.01s (Target: <1.8s) - **Poor** 🔴
- **LCP**: 4.01s (Target: <2.5s) - **Poor** 🔴  
- **TTFB**: 1.66s (Target: <0.8s) - **Needs Improvement** 🟡
- **Performance degradation** since Jan 1-2

**Route Breakdown:**
- `/jobs`: **Worst** - TTFB 2.58s, LCP 4.54s, FCP 4.21s (8 visits)
- `/onboarding`: TTFB 3.21s, LCP 4.52s, FCP 4.3s
- Other routes performing well

---

## Root Cause Analysis

### 1. **High Time to First Byte (TTFB)** - Server-Side Issue

**Problem:** TTFB of 1.66s-2.58s indicates slow server response times.

**Causes:**
- Database queries on every request (no caching)
- Connection pool might be exhausted (max: 5 connections)
- No edge caching for static/semi-static content
- Authentication check (`requireAuth`) runs on every request

**Evidence:**
```typescript
// jobs/page.tsx - runs on every request
const [jobs, emailIntegration] = await Promise.all([
  prisma.job.findMany({ where: { userId: user.id }, ... }),
  getEmailIntegration(user.id),
])
```

### 2. **Slow First Contentful Paint (FCP) / Largest Contentful Paint (LCP)** - Rendering Issue

**Problem:** Both at 4.01s suggests content takes too long to appear.

**Causes:**
- Client-side components loading synchronously
- Large JavaScript bundles
- No streaming or progressive rendering
- Render-blocking CSS/JS

**Evidence:**
- `AppShell` is a client component wrapping all pages
- Heavy client-side filtering in `JobsPageContent`
- Multiple dynamic imports but still synchronous rendering

---

## Optimization Recommendations

### Priority 1: Fix TTFB (Server-Side) 🚨

#### 1.1 Add React Cache and Data Caching

```typescript
// src/app/(authenticated)/jobs/page.tsx
import { cache } from 'react'
import { unstable_cache } from 'next/cache'

// Cache jobs query per user
const getCachedJobs = cache(async (userId: string) => {
  return prisma.job.findMany({
    where: { userId },
    select: { /* ... */ },
    orderBy: { savedAt: 'desc' },
    take: 100,
  })
})

// Or use Next.js unstable_cache with revalidation
const getCachedJobs = unstable_cache(
  async (userId: string) => {
    return prisma.job.findMany({ /* ... */ })
  },
  ['jobs'],
  { revalidate: 60, tags: [`jobs-${userId}`] }
)

export default async function JobsPage() {
  const user = await requireAuth()
  const [jobs, emailIntegration] = await Promise.all([
    getCachedJobs(user.id),
    getEmailIntegration(user.id),
  ])
  // ...
}
```

#### 1.2 Increase Database Connection Pool

```typescript
// src/lib/prisma.ts
max: 10, // Increase from 5 to handle more concurrent requests
```

#### 1.3 Add Streaming with Suspense

```typescript
// src/app/(authenticated)/jobs/page.tsx
import { Suspense } from 'react'
import { JobsList } from '@/components/jobs/jobs-list'
import { JobsListSkeleton } from '@/components/jobs/jobs-list-skeleton'

export default async function JobsPage() {
  const user = await requireAuth()
  
  return (
    <AppShell showEmailNotification={!emailIntegration}>
      <Suspense fallback={<JobsListSkeleton />}>
        <JobsList userId={user.id} />
      </Suspense>
    </AppShell>
  )
}
```

#### 1.4 Move Auth Check to Middleware (Already in proxy.ts, but verify it's fast)

### Priority 2: Fix FCP/LCP (Client-Side) 🚨

#### 2.1 Implement Server Components Where Possible

Convert `AppShell` to use more server components, or lazy load it:

```typescript
// src/components/layout/app-shell-lazy.tsx
'use client'
import dynamic from 'next/dynamic'

export const AppShell = dynamic(() => 
  import('./app-shell').then(mod => ({ default: mod.AppShell })),
  { ssr: false, loading: () => <div className="min-h-screen" /> }
)
```

#### 2.2 Add Streaming for Jobs List

```typescript
// src/components/jobs/jobs-list.tsx
import { Suspense } from 'react'

export async function JobsList({ userId }: { userId: string }) {
  const jobs = await getCachedJobs(userId)
  return <JobsPageContent jobs={jobs} />
}
```

#### 2.3 Optimize JavaScript Bundle Size

```typescript
// Use dynamic imports for heavy components
const HeavyChart = dynamic(() => import('./heavy-chart'), { ssr: false })
```

#### 2.4 Add Loading States (Already have loading.tsx, but verify they render immediately)

Verify that `src/app/(authenticated)/jobs/loading.tsx` is being used and renders quickly.

### Priority 3: Optimize Specific Routes

#### 3.1 `/jobs` Route - Most Critical

**Issues:**
- High TTFB (2.58s)
- Slow LCP (4.54s)
- Most visited route (25 visits)

**Solutions:**
1. Implement data caching (see 1.1)
2. Add pagination to limit initial load
3. Use streaming for progressive rendering
4. Optimize `JobsPageContent` component (heavy filtering)

```typescript
// Consider server-side filtering instead of client-side
const filteredJobs = await prisma.job.findMany({
  where: {
    userId: user.id,
    status: activeStatus !== 'all' ? activeStatus : { notIn: ['ARCHIVED', 'REJECTED'] }
  },
  // ...
})
```

#### 3.2 `/onboarding` Route

**Issues:**
- Very slow TTFB (3.21s)
- Client component that could be optimized

**Solutions:**
- Already uses Suspense (good!)
- Consider moving OAuth setup to separate route
- Preload OAuth provider assets

### Priority 4: General Optimizations

#### 4.1 Enable React Compiler Optimizations

Already enabled in `next.config.ts` ✅

#### 4.2 Optimize Images

```typescript
// next.config.ts
images: {
  formats: ['image/avif', 'image/webp'],
  minimumCacheTTL: 60,
}
```

#### 4.3 Add Response Headers for Caching

```typescript
// next.config.ts or middleware
headers: async () => [
  {
    source: '/api/jobs',
    headers: [
      {
        key: 'Cache-Control',
        value: 'public, s-maxage=60, stale-while-revalidate=120',
      },
    ],
  },
]
```

---

## Quick Wins (Implement First)

1. **Add caching to database queries** - Biggest TTFB impact
2. **Increase connection pool** from 5 to 10
3. **Verify loading.tsx files render immediately** - Should improve FCP
4. **Add Suspense boundaries** around data fetching
5. **Implement streaming** for `/jobs` page

---

## Performance Targets

After optimizations, aim for:
- **TTFB**: <0.8s (currently 1.66s-2.58s)
- **FCP**: <1.8s (currently 4.01s)
- **LCP**: <2.5s (currently 4.01s-4.54s)
- **RES**: >90 (currently 73)

---

## Monitoring

After implementing changes:
1. Monitor Speed Insights for 24-48 hours
2. Check if performance improved on Jan 2-5 (where degradation occurred)
3. Compare before/after metrics
4. Focus on `/jobs` route specifically (highest traffic)

---

## Questions to Investigate

1. **What changed on Jan 1-2?** 
   - Check git history for that date
   - Look for new dependencies or code changes

2. **Is database connection the bottleneck?**
   - Check Supabase dashboard for connection limits
   - Monitor query performance

3. **Are there any blocking API calls?**
   - Check for external API calls in page load
   - Verify email integration check isn't slow
