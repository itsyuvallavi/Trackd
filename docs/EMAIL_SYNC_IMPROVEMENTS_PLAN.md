# Email Sync Improvements Plan

## Overview
Improve email sync to be smarter about matching emails to existing jobs, prevent unwanted job creation, and add a notification system for ambiguous cases and updates.

## Current Issues

1. **Creates new jobs when it shouldn't** - Currently creates jobs with "Unknown Position" when it can't match
2. **Poor context understanding** - Doesn't properly identify which position an email refers to when multiple jobs exist for the same company
3. **No notification system** - No way to alert users about ambiguous matches or sync results
4. **No update notifications** - Users don't know when jobs are updated automatically

## Goals

1. ✅ **Never create new jobs** - Only update existing ones
2. ✅ **Better matching logic** - Use multiple signals (company, title, recruiter, domain, etc.)
3. ✅ **Notification system** - Alert users about ambiguous matches and sync results
4. ✅ **Update notifications** - Notify when jobs are updated (manual or automatic)

---

## Phase 1: Database Schema Updates

### 1.1 Add Notification Model

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  type        NotificationType
  title       String
  message     String
  metadata    Json?    // Store additional data (jobId, emailId, etc.)
  isRead      Boolean  @default(false)
  actionUrl   String?  // Optional link to relevant page
  createdAt   DateTime @default(now())
  
  @@index([userId, isRead])
  @@index([userId, createdAt])
}

enum NotificationType {
  AMBIGUOUS_MATCH      // Email matches multiple jobs
  NEW_JOB_DETECTED     // New job found in email (company + position not in list)
  JOB_UPDATED          // Job was updated (manual or auto)
  SYNC_COMPLETE        // Email sync finished
  SYNC_ERROR           // Email sync had errors
}
```

### 1.2 Migration
- Create migration for Notification model
- Add indexes for efficient queries

---

## Phase 2: Improve Matching Logic

### 2.1 Enhanced Matching Algorithm

**Current Issues:**
- Only matches by company name (too broad)
- Doesn't consider recruiter/contact info
- Doesn't handle multiple jobs from same company

**New Matching Strategy:**

1. **Exact Match (Highest Priority)**
   - Company name + Job title exact match
   - Company name + Contact email match
   - Company name + Recruiter name match

2. **Fuzzy Match (Medium Priority)**
   - Company name + partial title match
   - Company name + domain match (if job has contact email)
   - Company name + location match

3. **Company Only Match (Low Priority - Ambiguous)**
   - Only company name matches
   - Multiple jobs exist for this company
   - **→ Create notification for user to choose**

4. **No Match**
   - Can't match to any existing job
   - **→ Create notification with email details for manual review**

### 2.2 Implementation

**File: `src/lib/email-classifier.ts`**

```typescript
interface MatchResult {
  jobId: string | null
  confidence: 'exact' | 'fuzzy' | 'ambiguous' | 'none'
  matchedJobs?: Array<{ id: string; title: string; company: string }> // For ambiguous matches
  reason: string // Why this match was chosen
}

matchToJob(
  email: ClassifiedEmail,
  jobs: Array<{ 
    id: string
    title: string
    company: string
    url?: string | null
    contactEmail?: string | null
    contactName?: string | null
    location?: string | null
  }>
): MatchResult {
  // 1. Exact matches
  // 2. Fuzzy matches
  // 3. Ambiguous matches (multiple candidates)
  // 4. No match
}
```

---

## Phase 3: New Job Detection (Instead of Auto-Creation)

### 3.1 Detect New Jobs

**File: `src/app/(authenticated)/settings/email-actions.ts`**

**Current Code (lines 152-202):**
```typescript
else if (classified.jobInfo?.company) {
  // Create a new job from the email if we have company info
  // ... creates new job
}
```

**New Behavior:**
- Check if email has both company name AND job title
- Verify this combination doesn't exist in user's jobs
- If new job detected → create `NEW_JOB_DETECTED` notification
- Notification includes:
  - Email subject
  - Extracted company name
  - Extracted job title
  - Email sender
  - Email date
  - Suggested status (from email classification)
  - Action buttons: "Create Job" / "Dismiss"

### 3.2 Notification Requirements

**For NEW_JOB_DETECTED notification:**
- Must have both company name AND job title (not "Unknown Position")
- Must not match any existing job (company + title combination)
- User can review and manually create if desired
- Prevents duplicate jobs by letting user check first

---

## Phase 4: Notification System

### 4.1 Notification Service

**File: `src/lib/notification-service.ts`** (new file)

```typescript
export class NotificationService {
  async createAmbiguousMatchNotification(
    userId: string,
    email: EmailMessage,
    matchedJobs: Array<{ id: string; title: string; company: string }>,
    classified: ClassifiedEmail
  ): Promise<void>
  
  async createJobUpdatedNotification(
    userId: string,
    jobId: string,
    jobTitle: string,
    company: string,
    oldStatus: JobStatus,
    newStatus: JobStatus,
    source: 'email' | 'manual'
  ): Promise<void>
  
  async createSyncCompleteNotification(
    userId: string,
    stats: SyncStats
  ): Promise<void>
  
  async createNewJobDetectedNotification(
    userId: string,
    email: EmailMessage,
    classified: ClassifiedEmail,
    jobInfo: { company: string; title: string; location?: string }
  ): Promise<void>
  
  async createNoMatchNotification(
    userId: string,
    email: EmailMessage,
    classified: ClassifiedEmail
  ): Promise<void>
}
```

### 4.2 Update Email Sync to Use Notifications

**File: `src/app/(authenticated)/settings/email-actions.ts`**

- When match is ambiguous → create notification
- When no match found → create notification
- When job updated → create notification
- After sync completes → create notification with summary

### 4.3 Update Job Actions to Create Notifications

**File: `src/app/(authenticated)/jobs/actions.ts`**

- When job status updated manually → create notification
- When job details updated → create notification (optional)

---

## Phase 5: Notification Bell UI

### 5.1 Update NotificationsBell Component

**File: `src/components/layout/notifications-bell.tsx`**

**Changes:**
1. Fetch notifications from database (not just static email setup)
2. Display different notification types with appropriate icons
3. Show notification count badge
4. Group notifications by type
5. Mark as read when clicked
6. Action buttons for ambiguous matches (link to job selection page)

### 5.2 Notification Types UI

**Ambiguous Match Notification:**
```
🔍 Ambiguous Match
Email from [sender] could match multiple jobs:
• Job Title 1 at Company
• Job Title 2 at Company
• Job Title 3 at Company
[Select Job] [Dismiss]
```

**Job Updated Notification:**
```
✅ Job Updated
"Job Title" at Company
Status changed: Applied → Interview
[View Job] [Dismiss]
```

**Sync Complete Notification:**
```
📧 Sync Complete
Processed 5 emails
• 2 jobs updated
• 1 ambiguous match
• 2 no matches found
[View Details] [Dismiss]
```

**New Job Detected Notification:**
```
🆕 New Job Detected
"Job Title" at Company
Found in email from [sender]
[Create Job] [Dismiss]
```

**No Match Notification:**
```
❓ New Email Detected
Email from [sender] about [company]
Couldn't match to existing job
(Insufficient information to create job)
[View Email] [Dismiss]
```

### 5.3 Notification API Endpoints

**File: `src/app/api/notifications/route.ts`** (new file)

```typescript
// GET /api/notifications - Get user's notifications
// POST /api/notifications/[id]/read - Mark as read
// DELETE /api/notifications/[id] - Dismiss notification
```

---

## Phase 6: Job Selection Page (for Ambiguous Matches)

### 6.1 Create Selection Page

**File: `src/app/(authenticated)/notifications/[id]/select-job/page.tsx`** (new file)

**Purpose:**
- Show email details
- List candidate jobs
- Allow user to select which job the email refers to
- Update selected job with email info
- Dismiss notification

---

## Implementation Order

### Step 1: Database & Models
1. Create Notification model in Prisma schema
2. Run migration
3. Generate Prisma client

### Step 2: Matching Logic
1. Enhance `matchToJob()` in EmailClassifier
2. Add MatchResult interface
3. Test matching with various scenarios

### Step 3: New Job Detection
1. Update email-actions.ts to detect new jobs (company + title)
2. Check if combination exists in user's jobs
3. Create NEW_JOB_DETECTED notification instead of auto-creating
4. Add "Create Job" action to notification

### Step 4: Notification Service
1. Create NotificationService class
2. Implement all notification creation methods
3. Integrate into email sync flow

### Step 5: Notification API
1. Create notification API routes
2. Add authentication
3. Test CRUD operations

### Step 6: UI Updates
1. Update NotificationsBell to fetch from API
2. Add notification type components
3. Add action buttons and links
4. Add job selection page

### Step 7: Job Update Notifications
1. Add notification creation to job actions
2. Test manual updates trigger notifications

### Step 8: New Job Detection
1. Test new job detection logic
2. Verify notifications created for valid new jobs
3. Test "Create Job" action from notification
4. Verify duplicate prevention works

### Step 9: Auto-Sync
1. Add auto-sync fields to EmailIntegration model
2. Update cron endpoint to use new notification system
3. Add auto-sync settings UI
4. Test auto-sync at different intervals
5. Verify notifications created during auto-sync

### Step 10: Testing & Refinement
1. Test ambiguous match scenarios
2. Test new job detection scenarios
3. Test no-match scenarios
4. Test job update notifications
5. Test sync complete notifications
6. Test auto-sync functionality
7. Refine UI/UX based on feedback

---

## Files to Create/Modify

### New Files
- `src/lib/notification-service.ts`
- `src/app/api/notifications/route.ts`
- `src/app/api/notifications/[id]/route.ts`
- `src/app/(authenticated)/notifications/[id]/select-job/page.tsx`
- `src/components/notifications/ambiguous-match-notification.tsx`
- `src/components/notifications/job-updated-notification.tsx`
- `src/components/notifications/sync-complete-notification.tsx`
- `src/components/notifications/no-match-notification.tsx`
- `src/components/notifications/new-job-detected-notification.tsx`

### Modified Files
- `prisma/schema.prisma` - Add Notification model, update EmailIntegration
- `src/app/api/cron/sync-emails/route.ts` - Enhance for auto-sync
- `src/app/(authenticated)/settings/integrations/page.tsx` - Add auto-sync settings
- `src/lib/email-classifier.ts` - Improve matching logic
- `src/app/(authenticated)/settings/email-actions.ts` - Remove job creation, add notifications
- `src/app/(authenticated)/jobs/actions.ts` - Add update notifications
- `src/components/layout/notifications-bell.tsx` - Fetch and display notifications
- `src/lib/constants.ts` - Add NotificationType enum (if needed)

---

## Success Criteria

✅ Email sync never creates new jobs automatically
✅ New jobs detected (company + title) create notifications for user approval
✅ Ambiguous matches create notifications for user review
✅ Unmatched emails create notifications for manual review
✅ Job updates (manual and automatic) create notifications
✅ Sync results appear in notification bell
✅ Users can create jobs from notifications with one click
✅ Users can resolve ambiguous matches by selecting the correct job
✅ Notification bell shows unread count
✅ Notifications can be dismissed/marked as read
✅ Auto-sync runs in background at configurable intervals
✅ Users can enable/disable auto-sync and set frequency

---

## Phase 9: Auto-Sync Implementation

### 9.1 Background Sync Service

**File: `src/app/api/cron/sync-emails/route.ts`** (already exists, enhance it)

**Current State:**
- Cron endpoint exists
- Needs to be enhanced to work with new notification system

**Enhancements:**
1. Run sync automatically every X minutes/hours
2. Use same sync logic as manual sync
3. Create notifications for results
4. Log sync activity

### 9.2 Sync Frequency

**Options:**
- Every 15 minutes (for active users)
- Every hour (default)
- Configurable per user (future enhancement)

**Implementation:**
- Use Vercel Cron or similar
- Or use Supabase Edge Function with cron trigger
- Or use external cron service (cron-job.org, etc.)

### 9.3 Auto-Sync Settings

**File: `src/app/(authenticated)/settings/integrations/page.tsx`**

**Add:**
- Toggle for auto-sync (on/off)
- Frequency selector (15min, 30min, 1hr, 3hr, 6hr, 12hr, 24hr)
- Last sync time display
- Next sync time display (if enabled)

### 9.4 Database Updates

**Add to EmailIntegration model:**
```prisma
model EmailIntegration {
  // ... existing fields
  autoSyncEnabled Boolean @default(false)
  autoSyncFrequency Integer @default(60) // minutes
  nextSyncAt      DateTime?
}
```

---

## Future Enhancements (Post-MVP)

- AI-powered matching suggestions
- Bulk notification actions
- Notification preferences/settings
- Email preview in notifications
- Auto-dismiss after X days
- Notification history/archive
- Custom auto-sync schedules per user
