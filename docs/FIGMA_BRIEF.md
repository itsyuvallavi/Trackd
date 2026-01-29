# Job Application Tracker - Design Brief for Figma

## Product Overview

**Trackd** is a low-friction job application tracker that automatically stays up to date by combining job URL capture with email-based status detection. Users never have to maintain a spreadsheet again.

### Core Value Proposition
- **Zero busywork** - Email + automation does the work, not manual status updates
- **Fast capture** - Saving a job takes one click or one pasted URL
- **Calm UX** - No PM-tool complexity, few concepts, obvious defaults

---

## User Flow

### 1. Landing Page (Unauthenticated)
**Purpose:** Marketing page that demonstrates app features and drives sign-ups

**Content Needed:**
- Hero section with value proposition
- Feature highlights (3-4 key features)
- How it works (simple 3-step process)
- Sign Up / Log In CTAs

**Key Features to Highlight:**
- Automatic email tracking (never update status manually)
- One-click job capture from any job posting URL
- Clean, organized views (Today, Board, List)
- Browser extension for instant saves

### 2. Authentication
**OAuth Options:**
- Google Sign In
- Apple Sign In
- Simple, modern auth flow

### 3. Main Application (Authenticated)

After login, users access their private dashboard with these main views:

---

## Core Views to Design

### View 1: Today View (`/today`)
**Purpose:** Shows what needs attention right now

**Sections:**
1. **Overdue** - Applications that needed follow-up (red/urgent)
2. **Due Today** - Actions needed today (yellow/warning)
3. **Due This Week** - Upcoming actions in next 7 days (neutral)

**Card Design:**
Each job card should show:
- Job title
- Company name
- Status badge (APPLIED, INTERVIEW, etc.)
- Next action + due date
- Priority indicator (A/B/C)

**Empty State:**
"You're all caught up! 🎉"

---

### View 2: Board View (`/board`)
**Purpose:** Kanban-style board to see pipeline at a glance

**Columns (in order):**
1. SAVED - Jobs bookmarked but not applied yet
2. APPLIED - Application submitted
3. INTERVIEW - In interview process
4. OFFER - Received offer
5. REJECTED - Not moving forward
6. GHOSTED - No response after follow-up

**Card Design:**
Compact cards showing:
- Job title
- Company name
- Days in current status
- Priority dot (A=red, B=yellow, C=gray)

**Interaction:**
- Drag and drop between columns
- Click to open detail view

---

### View 3: Jobs List (`/jobs`)
**Purpose:** High-density table view with sort/filter

**Table Columns:**
- Priority (A/B/C badge)
- Job Title
- Company
- Status (colored badge)
- Source (LinkedIn, Indeed, etc.)
- Applied Date
- Last Updated
- Next Action

**Filters:**
- Status dropdown
- Priority selector
- Source filter
- Date range

**Sort:**
- Any column header clickable

---

### View 4: Job Detail (`/jobs/:id`)
**Purpose:** Full information about a single job

**Layout Sections:**

**Header:**
- Job title (large)
- Company name
- Status badge
- Priority selector
- Source icon + link to original posting

**Main Content (Left Column):**
- Description/notes textarea
- Job details:
  - Location
  - Salary range
  - Job URL (clickable)
  - Contact name/email
  - Tags

**Timeline (Right Column):**
- Activity feed showing all events:
  - Status changes
  - Email updates (with snippet)
  - Notes added
  - Interview scheduled
  - Dates in chronological order

**Actions:**
- "Add Note" button
- "Update Status" dropdown
- "Set Next Action" with date picker
- "Delete Job" (destructive, hidden)

---

### View 5: Add Job from URL (`/jobs/new-url`)
**Purpose:** Paste a job URL and auto-scrape details

**Layout:**
- Large input field for URL
- "Scrape Job" button
- Loading state while scraping
- Form with pre-filled fields:
  - Title (editable)
  - Company (editable)
  - Location
  - Description/notes
  - Priority selector (default: B)
- "Save Job" button

**States:**
- Empty (waiting for URL)
- Scraping (loading spinner)
- Scraped (form populated, editable)
- Error (URL didn't work, manual entry fallback)

---

### View 6: Settings / Integrations (`/settings/integrations`)
**Purpose:** Connect email and configure automation

**Content:**
- Gmail connection status
  - If not connected: "Connect Gmail" OAuth button
  - If connected: Email address, "Disconnect" button
  - Last sync timestamp
  - "Sync Now" button

**Future:**
- Browser extension download link
- Email sync frequency settings

---

## Navigation

**Top Navigation Bar (Authenticated):**
- Logo / "Trackd" (links to /today)
- All Jobs
- Today
- Board
- "+ Add from URL" (secondary CTA)
- Settings icon (top right)
- User profile/logout (top right)

**Mobile:**
- Hamburger menu
- Bottom tab bar with key sections

---

## Design System Requirements

### Typography
- Modern, clean sans-serif (suggest: Inter, SF Pro, or Geist)
- Clear hierarchy (H1, H2, body, small)
- Readable at all sizes

### Colors
**Status Colors:**
- SAVED: Gray (#6B7280)
- APPLIED: Blue (#3B82F6)
- INTERVIEW: Purple (#8B5CF6)
- OFFER: Green (#10B981)
- REJECTED: Red (#EF4444)
- GHOSTED: Orange (#F59E0B)

**Priority Colors:**
- A: Red indicator
- B: Yellow indicator
- C: Gray indicator

**UI Colors:**
- Background: Clean white or very light gray
- Foreground: Dark gray/black text
- Borders: Subtle grays
- Accent: One primary color for CTAs (blue suggested)

**Dark Mode:**
- Support optional (nice to have)

### Components

**Buttons:**
- Primary: Solid background, high contrast
- Secondary: Outlined or ghost style
- Destructive: Red for delete actions
- Sizes: Small, Medium, Large

**Cards:**
- Job cards (Board view): Compact, draggable
- Job cards (Today view): More detail, with next action
- Subtle shadows, rounded corners

**Badges:**
- Status badges (pill shape, colored)
- Priority indicators (dot or small letter)

**Forms:**
- Clean input fields
- Clear labels
- Validation states (error, success)
- Date pickers
- Dropdowns/selects

**Empty States:**
- Friendly illustrations or icons
- Clear messaging
- Call to action

### Layout
- Max width for content (suggest: 1200px)
- Generous padding/spacing
- Grid system for responsive design
- Mobile-first approach

---

## Key Interactions

1. **Add Job Flow:**
   - Paste URL → Auto-scrape → Review → Save
   - Or: Manual entry if URL fails

2. **Email Auto-Update:**
   - System checks email hourly
   - Creates/updates jobs automatically
   - Shows update in timeline
   - No user action needed

3. **Status Updates:**
   - Drag card to new column (Board view)
   - Or use dropdown in detail view
   - Creates timeline event

4. **Quick Actions:**
   - Hover on job card → Quick view modal
   - Right-click → Context menu (copy link, delete, etc.)

---

## States to Design

- Empty states (no jobs yet)
- Loading states (scraping URL, fetching data)
- Error states (scrape failed, network error)
- Success states (job added, status updated)
- Hover states (cards, buttons)
- Active/selected states

---

## Responsive Design

**Desktop (1200px+):**
- Full table view in Jobs list
- Side-by-side layout in detail view
- Multi-column board

**Tablet (768px - 1199px):**
- Condensed table or card grid
- Stacked layout in detail view
- Scrollable board columns

**Mobile (<768px):**
- Card list instead of table
- Stacked detail view
- Swipeable board columns
- Bottom navigation

---

## Technical Notes

**Framework:** Next.js 16 with React 19
**Styling:** TailwindCSS 4
**Icons:** Lucide React (or similar modern icon set)

Keep designs simple, modern, and focused on clarity over complexity.
