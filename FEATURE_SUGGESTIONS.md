# Feature Suggestions for Trackd

Based on your current functionality and product principles (zero busywork, fast capture, calm UX), here are feature suggestions organized by priority and impact.

## 🎯 High Priority - Core Value Additions

### 1. **Interview Calendar Integration**
**Why:** Automatically surface interview dates from emails and show them in a calendar view.

**Features:**
- Calendar view showing all scheduled interviews
- Automatic extraction of interview dates/times from emails (already partially done via AI)
- Calendar export (iCal/Google Calendar)
- Reminders/notifications before interviews
- Time zone handling

**Implementation:**
- Use existing `interviewAt` field and AI-extracted `interviewDate`/`interviewTime` from metadata
- Add `/calendar` route with calendar component
- Integrate with existing email parsing

**Impact:** High - Reduces manual calendar management, prevents missed interviews

---

### 2. **Follow-up Reminders & Automation**
**Why:** Help users never forget to follow up on applications.

**Features:**
- Smart follow-up suggestions based on time since application
- "Follow up in X days" quick actions
- Email templates for follow-ups (optional)
- Automatic reminders for stale applications
- "Mark as ghosted" after X days of no response

**Implementation:**
- Add `followUpDate` field to Job model
- Use existing `nextAction` field
- Create reminder system (could use Vercel Cron)
- Add to `/today` page as "Follow-ups Due"

**Impact:** High - Addresses common pain point, aligns with "zero busywork"

---

### 3. **Company/Contact Relationship Tracking**
**Why:** Track interactions with companies and recruiters across multiple jobs.

**Features:**
- View all jobs from the same company
- Track recruiter relationships (who you've talked to at which company)
- Company notes (culture, interview process, etc.)
- Contact history per company
- "Applied to this company before" indicator

**Implementation:**
- Add `Company` model (optional - could use existing `company` string field)
- Add `Contact` model linked to jobs
- Company detail page showing all jobs + contacts
- Enhance job detail to show company history

**Impact:** Medium-High - Helps with networking and relationship management

---

### 4. **Application Statistics (Simple)**
**Why:** Basic insights without complex dashboards.

**Features:**
- Application rate (jobs applied / jobs saved)
- Response rate (interviews / applications)
- Offer rate (offers / interviews)
- Time to response (average days from application to first response)
- Most active companies/sources

**Implementation:**
- Add `/stats` page with simple metrics
- Calculate from existing Job and Activity data
- Keep it minimal - just key numbers, no complex charts

**Impact:** Medium - Provides value without violating "no analytics dashboards" principle

---

## 🚀 Medium Priority - Quality of Life

### 5. **Bulk Actions**
**Why:** Faster management of multiple jobs.

**Features:**
- Select multiple jobs and update status
- Bulk tag/untag
- Bulk delete
- Bulk archive (mark as ghosted after X days)

**Implementation:**
- Add checkbox selection to `/jobs` table
- Bulk action toolbar
- Server actions for bulk updates

**Impact:** Medium - Saves time for power users

---

### 6. **Job Templates / Saved Searches**
**Why:** For users who apply to similar roles repeatedly.

**Features:**
- Save job search criteria (title, location, source)
- Quick apply with template (pre-fills common fields)
- "Apply similar" button that copies a job with editable fields

**Implementation:**
- Add `JobTemplate` model
- Template picker in job creation flow
- "Duplicate job" action

**Impact:** Medium - Useful for users applying to many similar roles

---

### 7. **Export/Import**
**Why:** Data portability and backup.

**Features:**
- Export to CSV/JSON
- Import from CSV (for migration from spreadsheets)
- Regular automatic backups (optional)

**Implementation:**
- `/settings/export` page
- CSV export endpoint
- CSV import with validation

**Impact:** Medium - Important for user trust and data portability

---

### 8. **Smart Tags & Filtering**
**Why:** Better organization without manual work.

**Features:**
- Auto-tag based on source (LinkedIn, Indeed, etc.)
- Auto-tag based on location (Remote, Hybrid, On-site)
- Auto-tag based on salary range
- Filter by multiple tags
- Tag suggestions based on job content

**Implementation:**
- Enhance existing `tags` field
- Auto-tagging in email sync and URL scraping
- Tag filter UI in `/jobs` page

**Impact:** Medium - Improves organization without extra work

---

### 9. **Email Thread View**
**Why:** See all emails related to a job in one place.

**Features:**
- Show all emails for a job in the job detail page
- Email thread view (conversation style)
- Reply directly from Trackd (optional - advanced)
- Mark emails as read/unread

**Implementation:**
- Link emails to jobs via Activity metadata
- Email list component in job detail
- Store email IDs in Activity metadata

**Impact:** Medium - Better context for each application

---

## 💡 Lower Priority - Nice to Have

### 10. **Mobile App (PWA)**
**Why:** Access on the go.

**Features:**
- Progressive Web App (PWA) support
- Offline mode for viewing jobs
- Push notifications for interviews/updates
- Mobile-optimized views

**Implementation:**
- Add PWA manifest
- Service worker for offline support
- Mobile-first responsive design (already partially done)

**Impact:** Medium - Improves accessibility

---

### 11. **Job Search Integration**
**Why:** Help users find jobs directly in Trackd.

**Features:**
- Search jobs from multiple sources (LinkedIn, Indeed, etc.)
- Save directly from search results
- Search history
- Saved search alerts

**Implementation:**
- Integrate with job board APIs (if available)
- Or scrape search results
- Add `/search` route

**Impact:** Low-Medium - Could be complex, may violate "fast capture" if not done well

---

### 12. **Interview Prep Notes**
**Why:** Prepare for interviews without leaving Trackd.

**Features:**
- Interview prep checklist per job
- Common questions + your answers
- Company research notes
- Interview feedback/notes after the interview

**Implementation:**
- Add `interviewPrep` field to Job model
- Interview prep section in job detail
- Template questions

**Impact:** Low-Medium - Nice to have, but could be done in notes

---

### 13. **Salary Tracking & Negotiation**
**Why:** Track salary offers and negotiation history.

**Features:**
- Salary history per job (initial offer, counter, final)
- Salary comparison across similar roles
- Negotiation notes
- Market rate suggestions (optional - would need API)

**Implementation:**
- Enhance existing `salary` field (make it structured)
- Add salary history to Activity
- Salary comparison view

**Impact:** Low - Useful but niche

---

### 14. **Dark Mode Improvements**
**Why:** Better dark mode experience.

**Features:**
- System preference detection (already done)
- Manual toggle (already done)
- Per-component dark mode refinements
- Better contrast ratios

**Impact:** Low - Polish, not core functionality

---

## 🚫 Explicitly NOT Recommended

Based on your principles, avoid:
- ❌ Complex analytics dashboards (violates "calm UX")
- ❌ Resume/Cover letter generation (explicit non-goal)
- ❌ Multi-user collaboration (explicit non-goal)
- ❌ Recruiter-style pipelines (explicit non-goal)
- ❌ Social features (sharing, comments)
- ❌ Gamification (badges, streaks)

---

## 📊 Recommended Implementation Order

1. **Phase 1 (Quick Wins):**
   - Follow-up Reminders (#2)
   - Bulk Actions (#5)
   - Export/Import (#7)

2. **Phase 2 (Core Features):**
   - Interview Calendar (#1)
   - Company/Contact Tracking (#3)
   - Email Thread View (#9)

3. **Phase 3 (Enhancements):**
   - Application Statistics (#4)
   - Smart Tags (#8)
   - Job Templates (#6)

4. **Phase 4 (Polish):**
   - PWA Support (#10)
   - Interview Prep (#12)
   - Salary Tracking (#13)

---

## 💭 Questions to Consider

Before implementing, ask:
1. **Does this reduce busywork?** If not, reconsider.
2. **Can this be automated?** Prefer automation over manual input.
3. **Does this add complexity?** If yes, is the value worth it?
4. **Does this align with "calm UX"?** Avoid feature bloat.

---

## 🎯 Top 3 Recommendations

Based on your product principles, I'd prioritize:

1. **Follow-up Reminders (#2)** - Directly addresses "zero busywork"
2. **Interview Calendar (#1)** - High value, builds on existing AI extraction
3. **Company/Contact Tracking (#3)** - Helps with relationship management

These three features would significantly enhance the product without adding complexity, and they all build on your existing infrastructure (email sync, AI extraction, activity tracking).

