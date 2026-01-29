# Job Application Tracker - Complete Implementation Plan

## Current Status
- ✅ Authentication UI (login/signup pages)
- ✅ Basic job listing page with table view
- ✅ Sidebar navigation
- ✅ Job actions menu (View, Edit, Delete)
- ✅ User profile menu
- ✅ Database schema with Prisma
- ✅ Basic CRUD operations

## Project Structure

### Pages Overview
1. **Authentication Flow** (`/login`, `/signup`)
   - Already created
   - Should redirect to onboarding after first signup

2. **Onboarding Flow** (✅ COMPLETED - `/onboarding`)
   - ✅ Email sync setup (Gmail/Outlook OAuth + IMAP)
   - ✅ Simplified 3-step flow: Welcome → Email Sync → Complete
   - ✅ Chrome extension recommendation (moved to jobs page popup)

3. **Main Application Pages** - ✅ ALL COMPLETED
   - ✅ `/today` - Today's tasks and priorities
   - ✅ `/jobs` - Table view (fully implemented with search, filters, status tabs)
   - ✅ `/board` - Kanban board view with drag & drop
   - ✅ `/jobs/:id` - Individual job detail page with timeline
   - ✅ `/jobs/new-url` - Add job from URL with scraping

4. **Settings & Profile**
   - `/settings/integrations` - Email sync, extension connection
   - `/settings/preferences` - User preferences
   - `/profile` - User profile information

---

## Phase 1: Core Functionality & Data Consistency

### 1.1 Database & State Management
**Priority: CRITICAL** - ✅ COMPLETED

- [x] Ensure all three views (Today, Jobs, Board) use the same data source
- [x] Implement real-time updates or optimistic UI updates
- [x] Add proper error handling for CRUD operations
- [x] Create revalidation strategy for data consistency

**Files to modify:**
- `/src/app/(authenticated)/today/page.tsx`
- `/src/app/(authenticated)/jobs/page.tsx`
- `/src/app/(authenticated)/board/page.tsx`
- `/src/app/(authenticated)/jobs/actions.ts` (server actions)

### 1.2 Search Functionality
**Priority: HIGH** - ✅ COMPLETED

- [x] Implement search functionality in jobs table
- [x] Add search by: company name, role title, location
- [x] Add debounced search input
- [x] Show search results count

**Files to create/modify:**
- `/src/components/jobs-search.tsx` (client component)
- Update `/src/components/jobs-page-content.tsx`

### 1.3 Status Counter Widget
**Priority: MEDIUM** - ✅ COMPLETED

- [x] Create status counter component
- [x] Show count for each status: SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, GHOSTED
- [x] Display on dashboard/today page
- [x] Add visual indicators (colors matching status badges)

**Files to create:**
- `/src/components/status-counter.tsx`
- `/src/components/status-stats.tsx`

---

## Phase 2: View Pages Implementation

### 2.1 Today Page (`/today`)
**Priority: HIGH** - ✅ COMPLETED

**Features:**
- [x] Show jobs that need attention today
- [x] Overdue tasks (past due date)
- [x] Due today
- [x] Due in next 7 days
- [x] Recent status changes
- [x] Next actions due
- [x] Status counter widget

**Files to create:**
- `/src/app/(authenticated)/today/page.tsx`
- `/src/components/today-tasks.tsx`
- `/src/components/upcoming-deadlines.tsx`

### 2.2 Board/Kanban View (`/board`)
**Priority: HIGH** - ✅ COMPLETED

**Features:**
- [x] Column-based layout for each status
- [x] Columns: SAVED → APPLIED → INTERVIEW → OFFER → REJECTED → GHOSTED
- [x] Fixed header with column titles
- [x] Scrollable columns (columns scroll independently, max height 100vh)
- [x] Drag and drop between columns (changes status)
- [x] Minimal card design showing: company, role, date, priority
- [x] Add Sidebar to this page

**Libraries needed:**
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag and drop

**Files to create:**
- `/src/app/(authenticated)/board/page.tsx`
- `/src/components/kanban-board.tsx`
- `/src/components/kanban-column.tsx`
- `/src/components/kanban-card.tsx`
- `/src/app/(authenticated)/board/actions.ts` (update status on drop)

### 2.3 Job Detail Page (`/jobs/:id`)
**Priority: MEDIUM** - ✅ COMPLETED

**Features:**
- [x] Full job information display
- [x] Activity timeline
- [x] Edit mode for all fields
- [x] Notes section
- [x] Contact information
- [x] Next action tracking
- [x] Link to original job posting
- [x] Add Sidebar to this page

**Files to create:**
- `/src/app/(authenticated)/jobs/[id]/page.tsx`
- `/src/components/job-detail-view.tsx`
- `/src/components/job-timeline.tsx`
- `/src/components/job-edit-form.tsx`

### 2.4 Add Job from URL (`/jobs/new-url`)
**Priority: MEDIUM** - ✅ COMPLETED (NOW MODAL-BASED)

**Features:**
- [x] URL input field
- [x] Scrape job details from URL (LinkedIn, Indeed, generic + improved salary extraction)
- [x] Preview scraped data in a modal (no page navigation)
- [x] Edit before saving
- [x] Loading states
- [x] Accessible overlay modal experience (same pattern as manual Add Job)

**Files created/updated:**
- `/src/components/jobs/add-job-from-url-modal.tsx` (URL add modal)
- `/src/components/jobs/add-job-modal.tsx` (manual add modal)
- `/src/components/jobs/add-job-dropdown.tsx` (opens both modals)
- `/src/components/jobs/jobs-page-content.tsx` (wires modals + empty state actions)
- `/src/components/jobs/empty-state.tsx` (uses modals instead of navigation)
- `/src/app/api/scrape-job/route.ts` (API endpoint)
- `/src/app/(authenticated)/jobs/scrape-actions.ts` (scraping logic with enhanced salary detection)

---

## Phase 3: Email Integration

### 3.1 Email Sync Setup
**Priority: HIGH** - ✅ COMPLETED

**Features:**
- [x] Gmail OAuth implementation
- [x] Microsoft/Outlook OAuth implementation
- [x] Store access/refresh tokens securely
- [x] Email sync status indicator
- [x] Manual sync trigger
- [x] Last synced timestamp

**Files to create:**
- `/src/app/api/auth/gmail/route.ts`
- `/src/app/api/auth/gmail/callback/route.ts`
- `/src/lib/gmail-client.ts`

### 3.2 Email Ingestion & Processing
**Priority: HIGH** - ⚠️ PARTIALLY COMPLETED

**Features:**
- [x] Background cron job for email sync
- [x] Parse emails from job boards (LinkedIn, Indeed, Greenhouse, Lever, etc.)
- [x] Extract application status updates
- [x] Create Activity entries automatically
- [x] Update job status based on email content
- [x] Rule-based classification system
- [ ] OAuth-based email fetching (Gmail API / Microsoft Graph API) - needs implementation

**Files to create:**
- `/src/app/api/cron/sync-emails/route.ts`
- `/src/lib/email-parser.ts`
- `/src/lib/email-rules.ts`

---

## Phase 4: Chrome Extension

### 4.1 Extension Architecture
**Priority: MEDIUM** - ⚠️ PARTIALLY COMPLETED

**Features:**
- [x] Browser extension structure created
- [x] Extension download functionality
- [x] Extension popup on jobs page (when empty)
- [x] Installation guide
- [ ] Browser extension with authentication - needs implementation
- [ ] One-click job save from any job page - needs implementation
- [ ] Auto-detect job information - needs implementation
- [ ] Sync with user account - needs implementation
- [x] Idempotent job creation (check by URL) - API endpoint exists

**Files to create:**
- `/extension/manifest.json`
- `/extension/popup.html`
- `/extension/background.js`
- `/extension/content-script.js`
- `/src/app/api/jobs/from-extension/route.ts`

### 4.2 Extension Connection
**Priority: MEDIUM** - ⚠️ PARTIALLY COMPLETED

- [ ] Extension authentication flow - needs implementation
- [ ] Token-based auth for extension - needs implementation
- [ ] Connection status in settings - needs implementation
- [x] Install instructions in onboarding - moved to jobs page popup

---

## Phase 5: Settings & Profile

### 5.1 Settings Page (`/settings`)
**Priority: MEDIUM**

**Sections:**
- [ ] **Integrations**
  - Gmail sync connection/disconnection
  - Chrome extension status
  - API key management (future)

- [ ] **Preferences**
  - Default priority for new jobs
  - Email notification preferences
  - Auto-sync frequency
  - Theme preferences

- [ ] **Account**
  - Email address
  - Password change
  - Delete account

**Files to create:**
- `/src/app/(authenticated)/settings/integrations/page.tsx`
- `/src/app/(authenticated)/settings/preferences/page.tsx`
- `/src/app/(authenticated)/settings/account/page.tsx`
- `/src/components/settings-layout.tsx`

### 5.2 Profile Page (`/profile`)
**Priority: LOW**

**Features:**
- [ ] User name
- [ ] Profile picture
- [ ] Current role seeking
- [ ] Target companies
- [ ] Skills/interests
- [ ] Resume upload (future)

**Files to create:**
- `/src/app/(authenticated)/profile/page.tsx`
- `/src/components/profile-form.tsx`

---

## Phase 6: Onboarding Flow - ✅ COMPLETED

### 6.1 Post-Signup Onboarding
**Priority: HIGH** - ✅ COMPLETED

**Steps:**
1. ✅ Welcome screen
2. ✅ Email sync setup (optional but recommended) - Gmail/Outlook OAuth + IMAP option
3. ✅ Chrome extension recommendation - moved to jobs page popup (shows when list is empty)
4. ❌ Quick tour of features - removed from onboarding flow
5. ❌ Add first job (optional) - removed from onboarding flow

**Files created:**
- ✅ `/src/app/(authenticated)/onboarding/page.tsx` - 3-step simplified flow
- ✅ `/src/components/jobs/extension-popup.tsx` - Extension popup for jobs page
- ✅ `/src/app/api/auth/email/oauth/route.ts` - OAuth initiation
- ✅ `/src/app/api/auth/email/oauth/callback/route.ts` - OAuth callback handler

---

## Phase 7: UI/UX Improvements ✅ COMPLETED

### 7.1 Jobs Table Improvements
**Priority: HIGH** - ✅ COMPLETED

- [x] **Color indicators:** Add status color indicator next to job title (left side)
- [x] **Row striping:** Alternate row background colors (subtle, like Excel)
- [x] **Minimal button design:** Redesign "Add from URL", "Add Job", "Export" buttons (icon-only with tooltips)
- [x] **Better empty state:** Improved design when no jobs exist (EmptyState component with action cards)
- [x] **Loading states:** Skeleton loaders for data fetching (TableSkeleton, HeaderSkeleton, LoadingState)
- [x] **Hover effects:** Smooth transitions on row hover
- [x] **Enhanced typography:** Improved font weights, spacing, and visual hierarchy

**Files modified:**
- `/src/components/jobs/jobs-page-content.tsx`
- `/src/components/jobs/add-job-modal.tsx`
- `/src/components/jobs/add-job-dropdown.tsx` (new - combined Add button)

**Files created:**
- `/src/components/jobs/empty-state.tsx`
- `/src/components/jobs/table-skeleton.tsx`
- `/src/components/jobs/header-skeleton.tsx`
- `/src/components/jobs/loading-state.tsx`

### 7.2 Sidebar Improvements
**Priority: MEDIUM** - ✅ COMPLETED

- [x] **Minimized sidebar:** Icon-only sidebar (64px width)
- [x] **Tooltips on hover:** Added portal-based tooltips for all navigation items
- [x] **Increased spacing:** Better gap between navigation icons (gap-3)
- [x] **Removed logo:** Logo moved to main header
- [x] **Active state indicator:** Better visual for active page

**Files modified:**
- `/src/components/layout/Sidebar.tsx`
- `/src/components/ui/tooltip.tsx` (enhanced with portal rendering and fixed positioning)

### 7.3 Modal/Popup Improvements
**Priority: MEDIUM** - ✅ COMPLETED

- [x] **Solid backgrounds:** All dropdowns have proper bg-card backgrounds
- [x] **Backdrop blur:** Added backdrop-blur-sm to header
- [x] **Animations:** Smooth enter/exit animations with animate-in
- [x] **CSS variables:** Added missing --card color variables for light/dark mode

**Components updated:**
- `/src/components/jobs/add-job-modal.tsx` (converted to controlled component)
- `/src/components/jobs/add-job-dropdown.tsx`
- `/src/components/jobs/job-actions-menu.tsx`
- `/src/components/layout/user-profile-menu.tsx`
- `/src/app/globals.css` (added card color variables)

### 7.4 Main Page Redesign
**Priority: MEDIUM** - ✅ COMPLETED

- [x] **Visual hierarchy:** Better spacing and typography throughout
- [x] **Enhanced typography:** Tracking, font weights, and sizes improved
- [x] **Tab badges:** Pill-style count badges on status tabs
- [x] **Table improvements:** Better padding, font weights, and spacing
- [x] **Quick action cards:** Included in EmptyState component

**Files modified:**
- `/src/components/jobs/jobs-page-content.tsx`
- `/src/components/jobs/applications-header.tsx`
- `/src/app/globals.css` (theme variables)

### 7.5 Header Redesign ✅ COMPLETED
**Priority: HIGH**

- [x] **Moved logo to header:** Logo + "Trackd" name now in top-left of header
- [x] **Centered search bar:** Search input centered with max-width
- [x] **User profile section:** Profile avatar with name and email display
- [x] **Notification bell:** Bell icon button (UI only, needs backend integration)
- [x] **Action buttons:** Add Job and Export buttons grouped
- [x] **Visual divider:** Separator between actions and profile section
- [x] **Compact design:** Reduced header height for better screen real estate

**Components modified:**
- `/src/components/jobs/jobs-page-content.tsx` (integrated new header layout)

**Functionality status:**
- ⚠️ **Notification bell:** UI complete, needs backend integration for actual notifications
- ⚠️ **User profile dropdown:** UI complete, displays static user info

### 7.6 Applications Header with Status Tabs ✅ COMPLETED
**Priority: HIGH**

- [x] **Page title section:** "Applications" heading with subtitle
- [x] **Status tabs with counts:** Dynamic tabs showing counts for each status
  - All Applications (total)
  - Saved
  - Applied
  - Interview
  - Offer
  - Rejected
  - Ghosted
- [x] **Active tab indicator:** Purple underline with smooth transitions
- [x] **Search functionality:** Search input for filtering applications
- [x] **Date range picker:** Button with calendar icon (UI only)
- [x] **Filters button:** Button with sliders icon (UI only)
- [x] **Count badges:** Pill-style badges with active/inactive states

**Components created:**
- `/src/components/jobs/applications-header.tsx`

**Functionality status:**
- ✅ **Status counts:** Dynamically calculated from jobs data
- ✅ **Tab switching:** Active state management working
- ⚠️ **Search:** Input present, needs implementation for actual filtering
- ⚠️ **Date range picker:** UI only, needs date picker component and filtering logic
- ⚠️ **Filters:** UI only, needs filter dropdown and filtering implementation
- ⚠️ **Tab filtering:** Tabs change active state but don't filter table yet

**Files modified:**
- `/src/components/jobs/jobs-page-content.tsx` (integrated header, calculate status counts)

---

## Phase 7: Remaining Tasks

### Functionality to Implement

**Search Functionality:** ✅ COMPLETED
- [x] Implement actual search filtering logic
- [x] Filter by company name, role title, location, source
- [x] Show "No results found" message when no matches
- [x] Real-time filtering as user types

**Date Range Filtering:** ✅ COMPLETED
- [x] Add date picker component (custom calendar UI)
- [x] Implement date range filtering logic
- [x] Filter jobs by creation date (createdAt field)
- [x] Select start and end dates independently
- [x] Clear button to reset date range
- [x] Visual feedback for selected dates and date range
- [ ] Persist date range selection in URL params (optional enhancement)

**Advanced Filters:** (Deferred - Core filtering complete)
- [ ] Create filters dropdown/modal (optional enhancement)
- [ ] Filter by source, priority (optional enhancement)
- [ ] Multiple filter selection (optional enhancement)
- [ ] Clear all filters button (optional enhancement)
- [ ] Show active filter count (optional enhancement)

**Status Tab Filtering:** ✅ COMPLETED
- [x] Implement tab click filtering
- [x] Filter table by selected status
- [x] Status counts remain accurate (show total counts, not filtered)
- [ ] Update URL params for shareable filtered views (optional enhancement)

**Notifications System:** (Deferred to future phase)
- [ ] Backend notification model
- [ ] Notification bell badge with count
- [ ] Notification dropdown with list
- [ ] Mark as read functionality
- [ ] Notification types (status changes, due dates, etc.)

**User Profile:** (Deferred to Phase 5: Settings & Profile)
- [ ] Make profile info dynamic from database
- [ ] Profile picture upload functionality
- [ ] Edit profile functionality

---

## Phase 7: Summary ✅ FULLY COMPLETED

All core UI/UX improvements and filtering functionality have been implemented:

✅ **Table improvements** - Color indicators, row striping, hover effects, enhanced typography
✅ **Sidebar** - Minimized to icons, tooltips, better spacing
✅ **Modals/Dropdowns** - Solid backgrounds, animations, proper z-index
✅ **Header redesign** - Logo, search, notifications, user profile
✅ **Applications header** - Status tabs with counts, all functional
✅ **Empty states** - Beautiful empty state and "no results" state
✅ **Loading states** - Skeleton loaders for all components
✅ **Search filtering** - Real-time text search across all fields
✅ **Status filtering** - Working tab filters with accurate counts
✅ **Date range filtering** - Custom date picker with range selection

**Files Created:**
- `/src/components/jobs/empty-state.tsx`
- `/src/components/jobs/table-skeleton.tsx`
- `/src/components/jobs/header-skeleton.tsx`
- `/src/components/jobs/loading-state.tsx`
- `/src/components/jobs/applications-header.tsx`
- `/src/components/jobs/add-job-dropdown.tsx`
- `/src/components/ui/date-range-picker.tsx`

**Deferred Items:** Advanced filters, notifications backend, and dynamic user profile are moved to their appropriate future phases.

---

## Phase 8: Data Visualization & Analytics

### 8.1 Dashboard/Stats
**Priority: LOW**

- [ ] Application timeline chart
- [ ] Success rate metrics
- [ ] Average time in each stage
- [ ] Weekly/monthly application count
- [ ] Response rate tracking

**Files to create:**
- `/src/components/analytics-dashboard.tsx`
- `/src/components/application-chart.tsx`

---

## Technical Tasks

### Database
- [ ] Add indexes for common queries
- [ ] Add full-text search on company and title fields
- [ ] Migration for any schema changes

### Authentication
- [ ] Implement proper session management
- [ ] Add email verification flow
- [ ] Password reset functionality
- [ ] Protected route middleware

### API Routes
- [ ] Rate limiting
- [ ] Error handling middleware
- [ ] Request validation with Zod
- [ ] API documentation

### Performance
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading for heavy components
- [ ] Database query optimization

### Testing
- [ ] Unit tests for utility functions
- [ ] Integration tests for API routes
- [ ] E2E tests for critical flows

---

## Implementation Order (Recommended)

### Sprint 1: Core Features (Week 1-2)
1. Data consistency across all views
2. Search functionality
3. Today page implementation
4. Board/Kanban view with drag & drop
5. Job detail page

### Sprint 2: Email Integration (Week 3-4)
1. Gmail OAuth setup
2. Email sync functionality
3. Email parsing and rule engine
4. Onboarding flow
5. Settings page

### Sprint 3: Chrome Extension (Week 5-6)
1. Extension development
2. Extension authentication
3. Extension API endpoints
4. Connection status in settings

### Sprint 4: UI/UX Polish (Week 7-8)
1. Main page redesign
2. Status counters and indicators
3. Modal/popup improvements
4. Sidebar refinements
5. Row colors and status indicators
6. Button redesigns

### Sprint 5: Profile & Analytics (Week 9-10)
1. Profile page
2. Analytics dashboard
3. Data visualization
4. Performance optimization
5. Testing and bug fixes

---

## Design System Tokens to Define

### Colors
- Status colors: SAVED, APPLIED, INTERVIEW, OFFER, REJECTED, GHOSTED
- Priority colors: A, B, C
- Row alternating colors (subtle)
- Background gradients

### Spacing
- Consistent padding/margin scale
- Grid system

### Typography
- Heading hierarchy
- Body text styles
- Font weights

### Components
- Button variants (primary, secondary, minimal, ghost)
- Input styles
- Card styles
- Modal/dialog styles

---

## Files Structure Summary

```
my-app/
├── docs/                           # 📁 Documentation (CLEANED)
│   ├── PROJECT_PLAN.md [✅ exists]
│   ├── FIGMA_BRIEF.md [✅ exists]
│   └── product-spec.md [✅ exists]
│
├── scripts/                        # 📁 Utility scripts (CLEANED)
│   ├── test-email.ts [✅ exists]
│   ├── setup-and-sync.ts [✅ exists]
│   ├── sync-today.ts [✅ exists]
│   ├── sync-emails-now.ts [✅ exists]
│   └── sync-recent.ts [✅ exists]
│
├── src/
│   ├── app/
│   │   ├── (authenticated)/
│   │   │   ├── layout.tsx [✅ exists]
│   │   │   ├── today/
│   │   │   │   └── page.tsx [✅ exists]
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx [✅ exists]
│   │   │   │   ├── actions.ts [✅ exists]
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx [✅ exists]
│   │   │   │   └── new-url/
│   │   │   │       └── page.tsx [✅ exists]
│   │   │   ├── board/
│   │   │   │   ├── page.tsx [✅ exists]
│   │   │   │   └── actions.ts [✅ exists]
│   │   │   ├── profile/
│   │   │   │   └── page.tsx [❌ create]
│   │   │   ├── settings/
│   │   │   │   ├── integrations/
│   │   │   │   │   └── page.tsx [✅ exists]
│   │   │   │   ├── preferences/
│   │   │   │   │   └── page.tsx [❌ create]
│   │   │   │   └── account/
│   │   │   │       └── page.tsx [❌ create]
│   │   │   └── onboarding/
│   │   │       └── page.tsx [✅ exists]
│   │   ├── api/
│   │   │   ├── scrape-job/
│   │   │   │   └── route.ts [✅ exists]
│   │   │   ├── jobs/
│   │   │   │   └── from-extension/
│   │   │   │       └── route.ts [✅ exists]
│   │   │   ├── auth/
│   │   │   │   └── email/
│   │   │   │       └── oauth/
│   │   │   │           ├── route.ts [✅ exists]
│   │   │   │           └── callback/
│   │   │   │               └── route.ts [✅ exists]
│   │   │   ├── download-extension/
│   │   │   │   └── route.ts [✅ exists]
│   │   │   └── cron/
│   │   │       └── sync-emails/
│   │   │           └── route.ts [✅ exists]
│   │   ├── layout.tsx [✅ exists]
│   │   ├── page.tsx [✅ exists]
│   │   └── globals.css [✅ exists]
│   │
│   ├── components/                 # 🔄 REORGANIZED
│   │   ├── layout/                 # 📁 Layout components
│   │   │   ├── Sidebar.tsx [✅ exists]
│   │   │   └── user-profile-menu.tsx [✅ exists]
│   │   │
│   │   ├── jobs/                   # 📁 Job-related components
│   │   │   ├── add-job-modal.tsx [✅ exists]
│   │   │   ├── edit-job-modal.tsx [✅ exists]
│   │   │   ├── job-actions-menu.tsx [✅ exists]
│   │   │   ├── jobs-page-content.tsx [✅ exists]
│   │   │   ├── status-dropdown.tsx [✅ exists]
│   │   │   ├── job-detail-view.tsx [✅ exists]
│   │   │   ├── job-timeline.tsx [✅ exists]
│   │   │   └── extension-popup.tsx [✅ exists]
│   │   │
│   │   ├── board/                  # 📁 Kanban board
│   │   │   ├── board-card.tsx [✅ exists]
│   │   │   └── kanban-board.tsx [✅ exists]
│   │   │
│   │   ├── email/                  # 📁 Email integration
│   │   │   ├── email-integration-form.tsx [✅ exists]
│   │   │   └── sync-emails-button.tsx [✅ exists]
│   │   │
│   │   ├── dashboard/              # 📁 Dashboard widgets
│   │   │   ├── status-counter.tsx [✅ exists]
│   │   │   └── status-stats.tsx [✅ exists]
│   │   │
│   │   ├── settings/               # 📁 Settings components
│   │   │   ├── settings-layout.tsx [❌ create]
│   │   │   └── profile-form.tsx [❌ create]
│   │   │
│   │   ├── onboarding/             # 📁 Onboarding flow
│   │   │   └── (integrated in onboarding page.tsx)
│   │   │
│   │   └── ui/                     # Reusable UI primitives
│   │       ├── badge.tsx [✅ exists]
│   │       ├── button.tsx [✅ exists]
│   │       ├── input.tsx [✅ exists]
│   │       ├── select.tsx [✅ exists]
│   │       ├── table.tsx [✅ exists]
│   │       ├── card.tsx [❌ create]
│   │       ├── dialog.tsx [❌ create]
│   │       └── dropdown.tsx [❌ create]
│   │
│   └── lib/
│       ├── prisma.ts [✅ exists]
│       ├── constants.ts [✅ exists]
│       ├── utils.ts [✅ exists]
│       ├── gmail-client.ts [❌ create]
│       ├── email-parser.ts [❌ create]
│       ├── email-rules.ts [❌ create]
│       └── job-scraper.ts [❌ create]
│
├── prisma/
│   └── schema.prisma [✅ exists]
│
├── public/
│
├── browser-extension/              # 📁 Chrome extension
│   └── manifest.json [✅ exists]
│
├── .env [✅ exists]
├── .env.local
├── .gitignore [✅ exists]
├── package.json [✅ exists]
├── tsconfig.json [✅ exists]
├── next.config.ts [✅ exists]
├── postcss.config.mjs [✅ exists]
├── eslint.config.mjs [✅ exists]
├── CLAUDE.md [✅ exists]
└── README.md [✅ exists]
```

### Deleted Components (Cleanup Complete)
- ❌ `Header.tsx` - Removed (not used)
- ❌ `nav.tsx` - Removed (replaced by Sidebar)
- ❌ `status-badge.tsx` - Removed (using ui/badge.tsx)
- ❌ `job-row.tsx` - Removed (not needed)

---

## Next Immediate Steps

1. **Start with Sprint 1, Task 1:** Ensure data consistency
2. **Implement search functionality**
3. **Create Today page**
4. **Build Kanban board with drag & drop**
5. **Add sidebar to all pages**

Would you like me to start implementing any specific phase or feature?
