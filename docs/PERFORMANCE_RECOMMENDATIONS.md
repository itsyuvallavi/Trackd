# Performance Optimization Recommendations

This document outlines performance improvement recommendations for the Trackd application based on codebase analysis.

---

## 🎯 Critical Priority (High Impact)

### 1. Implement Next.js Caching Strategy

**Issue:** All authenticated pages use `export const dynamic = 'force-dynamic'`, which prevents any caching and forces server-side rendering on every request.

**Impact:** Every page load requires full database queries, even when data hasn't changed.

**Recommendations:**
- **Add Time-Based Revalidation (ISR):**
  ```typescript
  // Instead of force-dynamic, use:
  export const revalidate = 60 // Revalidate every 60 seconds
  ```
  - Pages like `/jobs`, `/board`, `/today` can be cached for 30-60 seconds
  - Use `revalidatePath()` after mutations (already implemented)

- **Use `unstable_cache` for expensive queries:**
  ```typescript
  import { unstable_cache } from 'next/cache'
  
  const getCachedJobs = unstable_cache(
    async (userId: string) => {
      return prisma.job.findMany({ where: { userId } })
    },
    ['user-jobs'],
    { revalidate: 60, tags: ['jobs'] }
  )
  ```

**Files to update:**
- `src/app/(authenticated)/jobs/page.tsx`
- `src/app/(authenticated)/board/page.tsx`
- `src/app/(authenticated)/today/page.tsx`
- `src/app/(authenticated)/profile/page.tsx`

**Expected improvement:** 50-70% reduction in database queries for unchanged data.

---

### 2. Optimize Database Queries on `/today` Page

**Issue:** The `/today` page performs 3 separate database queries:
1. All jobs with activities (loaded but many filtered out)
2. Recent activities (all activity types)
3. Recent applied activities (duplicate query pattern)

**Impact:** Loading significantly more data than needed, especially for users with many jobs/activities.

**Recommendations:**
- **Combine queries using Prisma's `include` and `where` efficiently:**
  ```typescript
  // Single optimized query instead of 3 separate queries
  const [jobs, recentActivities] = await Promise.all([
    prisma.job.findMany({
      where: {
        userId: user.id,
        status: { in: ['SAVED', 'APPLIED', 'INTERVIEW'] } // Filter at DB level
      },
      select: { /* only needed fields */ }
    }),
    prisma.activity.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: sevenDaysAgo },
        type: { in: ['STATUS_CHANGE', 'INTERVIEW', 'REJECTION', 'OFFER'] }
      },
      include: { job: { select: { id: true, title: true, company: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ])
  ```

- **Use database aggregation for counts:**
  ```typescript
  const statusCounts = await prisma.job.groupBy({
    by: ['status'],
    where: { userId: user.id },
    _count: true
  })
  ```

**Files to update:**
- `src/app/(authenticated)/today/page.tsx`

**Expected improvement:** 40-60% faster page load, especially for users with 50+ jobs.

---

### 3. Add Database Query Select Optimization

**Issue:** Many queries fetch all fields using `include` or no `select`, loading unnecessary data.

**Impact:** Increased memory usage, network transfer, and query time.

**Recommendations:**
- **Use `select` to fetch only needed fields:**
  ```typescript
  // Instead of:
  const jobs = await prisma.job.findMany({ where: { userId: user.id } })
  
  // Use:
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      title: true,
      company: true,
      status: true,
      savedAt: true,
      // Only fields actually used in the component
    }
  })
  ```

- **Limit activity loading:**
  - Board page only needs the latest activity (already using `take: 1` - good!)
  - Jobs list page loads ALL activities - consider limiting or paginating

**Files to update:**
- `src/app/(authenticated)/jobs/page.tsx` - Limit activities or paginate
- `src/app/(authenticated)/board/page.tsx` - Already optimized ✅
- `src/app/(authenticated)/today/page.tsx`

**Expected improvement:** 20-40% reduction in data transfer and memory usage.

---

### 4. Implement Pagination for Jobs List

**Issue:** `/jobs` page loads ALL jobs with ALL activities at once.

**Impact:** Performance degrades significantly with 100+ jobs. Large payloads slow initial page load.

**Recommendations:**
- **Add cursor-based pagination:**
  ```typescript
  const jobs = await prisma.job.findMany({
    where: { userId: user.id },
    take: 50, // Page size
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { savedAt: 'desc' }
  })
  ```

- **Use infinite scroll or "Load More" pattern:**
  - Better UX than traditional pagination
  - Reduces initial load time

**Files to update:**
- `src/app/(authenticated)/jobs/page.tsx`
- `src/components/jobs/jobs-page-content.tsx` - Add pagination UI

**Expected improvement:** 
- Initial load: 70-80% faster for users with 100+ jobs
- Memory usage: 80% reduction

---

## 🔧 Medium Priority (Good Impact)

### 5. Optimize Connection Pool Configuration

**Issue:** Connection pool is limited to 5 connections with basic configuration.

**Impact:** Under high load, requests may queue waiting for available connections.

**Recommendations:**
```typescript
// src/lib/prisma.ts
globalForPrisma.pool = new Pool({
  connectionString,
  max: 10, // Increase for production
  min: 2,  // Keep minimum connections warm
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})
```

**Consider using Supabase connection pooling:**
- If using Supabase, use their connection pooler endpoint (different port)
- Handles connection management more efficiently

**Expected improvement:** Better handling under concurrent load, reduced connection overhead.

---

### 6. Add Client-Side Data Fetching with SWR/React Query

**Issue:** No client-side caching. Every navigation triggers full server-side data fetch.

**Impact:** Users see loading states on every navigation, even when data is fresh.

**Recommendations:**
- **Implement SWR for client-side data fetching:**
  ```typescript
  // For pages that need real-time updates
  import useSWR from 'swr'
  
  const { data: jobs, mutate } = useSWR('/api/jobs', fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000
  })
  ```

- **Use for:**
  - Job list updates after mutations
  - Notification counts
  - Real-time status changes

**Files to create:**
- `src/app/api/jobs/route.ts` - API endpoint for client-side fetching
- Update components to use SWR

**Expected improvement:** Instant navigation for recently viewed data, better UX.

---

### 7. Optimize Font Loading

**Issue:** Currently using Next.js font optimization (good!), but fonts are loaded for all routes.

**Recommendations:**
- **Consider font-display strategy:**
  ```typescript
  const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    display: 'swap', // Add this for better perceived performance
  })
  ```

- **Preload critical fonts:**
  Already handled by Next.js font optimization ✅

**Files to update:**
- `src/app/layout.tsx`

**Expected improvement:** Slightly faster font rendering, better CLS scores.

---

### 8. Lazy Load Heavy Components

**Issue:** All components are loaded eagerly, including heavy ones like KanbanBoard, modals.

**Impact:** Larger initial JavaScript bundle, slower Time to Interactive.

**Recommendations:**
- **Lazy load modals and non-critical components:**
  ```typescript
  const AddJobModal = dynamic(() => import('./add-job-modal'), {
    ssr: false,
    loading: () => <div>Loading...</div>
  })
  
  const KanbanBoard = dynamic(() => import('./kanban-board'), {
    loading: () => <div className="animate-pulse">Loading board...</div>
  })
  ```

**Files to update:**
- `src/components/jobs/add-job-modal.tsx` - Wrap with dynamic
- `src/components/board/kanban-board.tsx` - Wrap with dynamic
- Any other heavy components

**Expected improvement:** 20-30% reduction in initial bundle size, faster TTI.

---

### 9. Add Database Indexes for Common Query Patterns

**Issue:** Some queries may not be using optimal indexes.

**Current indexes:**
- `Job`: `userId + status`, `userId + savedAt` ✅
- `Activity`: `jobId + createdAt`, `userId + createdAt` ✅

**Additional recommendations:**
- **Add composite index for `/today` page queries:**
  ```prisma
  // In schema.prisma
  model Activity {
    // ... existing fields
    @@index([userId, type, createdAt]) // For filtering by type and date
  }
  ```

- **Consider index for EmailIntegration lookups:**
  ```prisma
  model EmailIntegration {
    // ... existing fields
    @@index([userId, isActive]) // If filtering by active status
  }
  ```

**Files to update:**
- `prisma/schema.prisma`
- Run migration: `bunx prisma migrate dev --name add_activity_composite_index`

**Expected improvement:** 30-50% faster queries for filtered activity lists.

---

### 10. Optimize Image Loading

**Issue:** Homepage uses external image from Unsplash without optimization.

**Recommendations:**
- **Use Next.js Image component:**
  ```typescript
  import Image from 'next/image'
  
  <Image
    src="https://images.unsplash.com/..."
    alt="Workspace"
    width={1080}
    height={720}
    priority // For above-the-fold images
    placeholder="blur" // Or use blurDataURL
  />
  ```

- **Or use a local optimized image:**
  - Download and optimize image
  - Store in `public/` folder
  - Reference locally

**Files to update:**
- `src/app/page.tsx`

**Expected improvement:** Faster image loading, better LCP score, reduced bandwidth.

---

## 📊 Low Priority (Nice to Have)

### 11. Add Response Compression

**Issue:** No explicit compression headers.

**Recommendations:**
- **Next.js handles this automatically in production** ✅
- Verify `compression` middleware is enabled (should be by default)

**Expected improvement:** Smaller payload sizes (especially for large job lists).

---

### 12. Implement Service Worker for Offline Support

**Issue:** No offline functionality or caching.

**Recommendations:**
- **Use Next.js PWA plugin or Workbox:**
  - Cache static assets
  - Cache API responses for jobs list
  - Provide offline fallback UI

**Expected improvement:** Better UX for users with unstable connections, faster repeat visits.

---

### 13. Monitor and Optimize Bundle Size

**Issue:** Large dependencies like `puppeteer`, `cheerio`, `imap` in package.json.

**Impact:** These should not be in client bundle, but verify they're properly tree-shaken.

**Recommendations:**
- **Audit bundle size:**
  ```bash
  bunx @next/bundle-analyzer
  ```

- **Ensure server-only code is properly marked:**
  - Use `'use server'` directive ✅ (already done)
  - Verify heavy dependencies are not imported in client components

**Expected improvement:** Smaller client bundle if any server code leaked to client.

---

### 14. Add Query Result Memoization

**Issue:** Repeated queries for same data within a request.

**Recommendations:**
- **Use React `cache()` for request-level memoization:**
  ```typescript
  import { cache } from 'react'
  
  const getEmailIntegration = cache(async (userId: string) => {
    return prisma.emailIntegration.findUnique({ where: { userId } })
  })
  ```

- **Already handled by Next.js for some cases, but explicit caching helps**

**Files to update:**
- Shared data fetchers (e.g., email integration lookups on multiple pages)

**Expected improvement:** Eliminates duplicate queries within same request.

---

### 15. Optimize Notification Queries

**Issue:** Notification bell may be fetching all notifications on every page load.

**Recommendations:**
- **Fetch only unread count + recent notifications:**
  ```typescript
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id, isRead: false },
    take: 5, // Only recent unread
    orderBy: { createdAt: 'desc' }
  })
  ```

- **Use client-side polling for real-time updates instead of refetching on every navigation**

**Files to review:**
- `src/components/layout/notifications-bell.tsx`
- Check how notifications are loaded

**Expected improvement:** Faster header rendering, reduced database load.

---

## 🎯 Performance Metrics to Monitor

After implementing these changes, monitor:

1. **Core Web Vitals:**
   - LCP (Largest Contentful Paint): Target < 2.5s
   - FID (First Input Delay): Target < 100ms
   - CLS (Cumulative Layout Shift): Target < 0.1

2. **Database Metrics:**
   - Query time for jobs list (target: < 100ms for 50 jobs)
   - Connection pool utilization
   - Slow query log analysis

3. **Page Load Metrics:**
   - Time to First Byte (TTFB): Target < 600ms
   - Time to Interactive (TTI): Target < 3.5s
   - Total bundle size: Target < 250KB gzipped

4. **User Experience:**
   - Navigation time between pages
   - Time to see content after mutation (job creation, status update)

---

## 📝 Implementation Priority Order

1. **Week 1: Critical**
   - Implement Next.js caching (#1)
   - Optimize `/today` page queries (#2)
   - Add pagination to jobs list (#4)

2. **Week 2: Medium**
   - Database query select optimization (#3)
   - Connection pool tuning (#5)
   - Lazy load heavy components (#8)

3. **Week 3: Polish**
   - Client-side data fetching (#6)
   - Image optimization (#10)
   - Additional database indexes (#9)

4. **Ongoing: Monitoring**
   - Set up performance monitoring
   - Regular bundle size audits
   - Database query analysis

---

## 🔍 Tools for Measurement

- **Vercel Speed Insights:** Already integrated ✅
- **Next.js Bundle Analyzer:** `bunx @next/bundle-analyzer`
- **Lighthouse CI:** For automated performance testing
- **Prisma Query Logging:** Enable in development to identify slow queries
- **PostgreSQL `pg_stat_statements`:** For database query analysis

---

## Notes

- All recommendations are based on codebase analysis
- Actual performance improvements will vary based on:
  - Number of jobs per user
  - Database size and indexes
  - Hosting infrastructure (Vercel, etc.)
  - User's network conditions
- Test each change individually to measure impact
- Consider A/B testing for major changes to ensure they improve UX
