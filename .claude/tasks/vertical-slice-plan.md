# Job Tracker - Vertical Slice Implementation Plan

## Goal
Build foundation + `/jobs` list view to prove full stack works before expanding to other views.

**What We're Building:**
- Supabase + Prisma database setup
- Job & Activity data models
- `/jobs` list page with add/edit/delete functionality
- Inline status updates with activity tracking

**Why This Approach:**
- Proves full stack (database → API → UI) works early
- Delivers immediate value (manual job tracking)
- Validates data model with real usage
- Low risk - find issues early

---

## Implementation Steps

### 1. Database Setup

**Install Dependencies:**
```bash
cd my-app
bun add @prisma/client zod date-fns clsx tailwind-merge
bun add -d prisma
bunx prisma init
```

**Environment Setup:**
- Create `.env.local` with Supabase connection string
- Add to `.gitignore` if needed

**Create Prisma Schema** (`prisma/schema.prisma`):
- Job model: id, userId, title, company, location, source, url, status, priority, dates, nextAction, tags, notes, salary, contact
- Activity model: id, jobId, userId, type, fromStatus, toStatus, description, createdAt
- Enums: JobSource, JobStatus (SAVED/APPLIED/INTERVIEW/OFFER/REJECTED/GHOSTED), JobPriority, ActivityType

**Run Migration:**
```bash
bunx prisma migrate dev --name init
```

### 2. Core Infrastructure

**Files to Create:**

1. **`src/lib/prisma.ts`** - Prisma client singleton (prevents hot reload issues)

2. **`src/lib/utils.ts`** - Utilities:
   - `cn()` - Tailwind class merging
   - `formatDate()` - Date formatting
   - `formatRelativeTime()` - "2 days ago" formatting

3. **`src/lib/constants.ts`** - Constants:
   - Status labels & colors mapping
   - Priority labels
   - Source labels
   - `TEMP_USER_ID = 'temp-user'` (replace with auth later)

4. **`src/lib/validations/job.ts`** - Zod schemas:
   - `createJobSchema` - Validation for new jobs
   - `updateJobSchema` - Validation for updates
   - Type exports

### 3. Server Actions

**File:** `src/app/jobs/actions.ts`

Implement Server Actions (Next.js 16 best practice):
- `createJob(formData)` - Create job + initial activity
- `updateJob(id, formData)` - Update job details
- `updateJobStatus(id, status)` - Change status + create activity
- `deleteJob(id)` - Delete job (cascade deletes activities)
- `addActivity(jobId, description)` - Add note/activity

All actions use `revalidatePath('/jobs')` for cache invalidation.

### 4. UI Components

**Base Components:**

1. **`src/components/ui/button.tsx`**
   - Variants: primary, secondary, ghost, danger
   - Sizes: sm, md, lg
   - Tailwind-based, accessible

2. **`src/components/status-badge.tsx`**
   - Displays status with color coding
   - Uses STATUS_COLORS from constants

**Feature Components (Client Components):**

3. **`src/components/status-dropdown.tsx`**
   - Client Component (interactive)
   - Inline status change dropdown
   - Calls `updateJobStatus()` server action
   - Uses `useTransition()` for pending state

4. **`src/components/add-job-modal.tsx`**
   - Client Component (form state)
   - Modal with job creation form
   - Fields: title*, company*, url*, location, source, status, notes
   - Calls `createJob()` server action
   - Progressive enhancement (works without JS)

5. **`src/components/job-row.tsx`**
   - Client Component (expand/collapse state)
   - Table row with expandable timeline
   - Shows: title, company, location, source, status, last activity, next action
   - Expanded view: timeline, notes, job URL link

### 5. Jobs Page

**File:** `src/app/jobs/page.tsx`

Server Component that:
- Fetches jobs with activities using Prisma
- Renders table with header + JobRow components
- Shows empty state when no jobs exist
- Includes AddJobModal button

**Layout:**
- Header with title + job count
- "Add Job" button (top right)
- Responsive table with 6 columns
- Clean, minimal design (calm UX)

### 6. Update Existing Files

**`src/app/page.tsx`:**
- Replace with simple landing page
- Link to `/jobs` with "Get Started" button

**`src/app/layout.tsx`:**
- Update metadata: title = "Job Tracker", description

**`package.json`:**
- Add seed script (optional for testing)

---

## File Structure

```
my-app/
├── prisma/
│   ├── schema.prisma          [CREATE] - Data models
│   └── seed.ts                [CREATE] - Optional seed data
├── src/
│   ├── app/
│   │   ├── jobs/
│   │   │   ├── page.tsx       [CREATE] - Jobs list view
│   │   │   └── actions.ts     [CREATE] - Server actions
│   │   ├── layout.tsx         [MODIFY] - Update metadata
│   │   └── page.tsx           [MODIFY] - Landing page
│   ├── components/
│   │   ├── ui/
│   │   │   └── button.tsx     [CREATE] - Base button
│   │   ├── status-badge.tsx   [CREATE] - Status display
│   │   ├── status-dropdown.tsx [CREATE] - Status selector
│   │   ├── add-job-modal.tsx  [CREATE] - Add job form
│   │   └── job-row.tsx        [CREATE] - Table row
│   └── lib/
│       ├── prisma.ts          [CREATE] - Prisma client
│       ├── utils.ts           [CREATE] - Utility functions
│       ├── constants.ts       [CREATE] - Constants
│       └── validations/
│           └── job.ts         [CREATE] - Zod schemas
├── .env.local                 [CREATE] - Environment vars
└── package.json               [MODIFY] - Add seed script

Total: 14 new files, 3 modified files
```

---

## Architectural Decisions

### Server Actions vs API Routes
**Choice: Server Actions**
- Less boilerplate, built-in revalidation
- Type-safe, progressive enhancement
- Next.js 16 recommended pattern

### Data Fetching
**Choice: Server Components**
- Fetch data directly in Server Components
- Zero client JS for data fetching
- Automatic deduplication

### State Management
**Choice: Minimal client state**
- No Zustand/Redux needed
- React 19 `useTransition()` for pending states
- URL state for future filters/sorting

### Form Handling
**Choice: Native forms + Server Actions**
- `useActionState` for form state
- Works without JavaScript
- Simpler than React Hook Form for MVP

---

## Testing After Implementation

1. **Supabase Connection**
   - Verify `.env.local` configured
   - Run `bunx prisma migrate dev`
   - Verify tables created in Supabase dashboard

2. **Basic Flow**
   - Start dev server: `bun dev`
   - Visit `/jobs` - should show empty state
   - Click "Add Job" - modal opens
   - Fill form (title, company, URL required)
   - Submit - redirects to /jobs, job appears in table
   - Click status dropdown - change status
   - Verify activity created (expand row)

3. **Edge Cases**
   - Invalid URL shows validation error
   - Required fields enforced
   - Long titles don't break layout
   - Dark mode works correctly

---

## Next Steps (Future Phases)

After this vertical slice works:

1. **Add remaining views:**
   - `/today` - Filtered view by due dates
   - `/board` - Kanban by status
   - `/jobs/:id` - Full detail page

2. **URL Scraper:**
   - `/jobs/new-url` route
   - Server Action to scrape job URLs
   - Pre-fill form with scraped data

3. **Email Integration (Phase 2):**
   - Gmail OAuth
   - EmailIntegration model
   - Background cron job
   - Automatic status updates

---

## Critical Files (Priority Order)

1. `prisma/schema.prisma` - Must create first, everything depends on it
2. `src/lib/prisma.ts` - Database client singleton
3. `src/app/jobs/actions.ts` - Core business logic
4. `src/app/jobs/page.tsx` - Main UI entry point
5. `src/components/add-job-modal.tsx` - Primary user input flow

---

## Dependencies Summary

**Production:**
- `@prisma/client` - Type-safe database access
- `zod` - Schema validation
- `date-fns` - Date utilities
- `clsx` + `tailwind-merge` - Class name utilities

**Dev:**
- `prisma` - Database toolkit

All installed via Bun.
