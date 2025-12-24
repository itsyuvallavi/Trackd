# Email Sync Improvements - Testing Guide

## ✅ Build Status
**All code compiles successfully!** Ready for testing.

## 🧪 Testing Checklist

### 1. Manual Email Sync

**Steps:**
1. Go to `/settings/integrations`
2. Ensure email integration is configured
3. Click "Sync Now" button
4. Check notification bell for results

**Expected Results:**
- ✅ Sync completes successfully
- ✅ Notification appears in bell with sync summary
- ✅ Shows counts for: processed emails, updated jobs, new jobs detected, ambiguous matches, no matches

### 2. New Job Detection

**Test Scenario:** Email contains a job that doesn't exist in your job list

**Steps:**
1. Ensure you have an email with a job posting (company + title)
2. Run email sync
3. Check notification bell

**Expected Results:**
- ✅ Notification appears: "New Job Detected"
- ✅ Shows job title and company
- ✅ "Create Job" button is visible
- ✅ Clicking "Create Job" creates the job and redirects to job page

### 3. Ambiguous Match Resolution

**Test Scenario:** Email could match multiple jobs from the same company

**Steps:**
1. Have multiple jobs from the same company in your list
2. Receive an email that mentions the company but not a specific position
3. Run email sync
4. Check notification bell

**Expected Results:**
- ✅ Notification appears: "Ambiguous Match"
- ✅ Lists all candidate jobs
- ✅ "Resolve Match" button is visible
- ✅ Clicking "Resolve Match" opens resolution page
- ✅ Can select which job the email refers to
- ✅ Selected job status updates (if advancement)
- ✅ Notification is marked as resolved

### 4. Job Update Notifications

**Test Scenario A - Automatic Update:**
1. Have a job with status "SAVED"
2. Receive an interview invite email
3. Run email sync

**Expected Results:**
- ✅ Job status updates to "INTERVIEW"
- ✅ Notification appears: "Job Updated"
- ✅ Shows status change (e.g., "SAVED → INTERVIEW")
- ✅ Link to view job

**Test Scenario B - Manual Update:**
1. Go to `/jobs` page
2. Change a job's status manually
3. Check notification bell

**Expected Results:**
- ✅ Notification appears: "Job Updated"
- ✅ Shows status change
- ✅ Link to view job

### 5. Auto-Sync Settings

**Steps:**
1. Go to `/settings/integrations`
2. Find "Auto-Sync" section
3. Toggle "Enable Auto-Sync" ON
4. Select sync frequency (e.g., "Every hour")
5. Save settings

**Expected Results:**
- ✅ Toggle works correctly
- ✅ Frequency selector works
- ✅ Shows "Last synced" time
- ✅ Shows "Next sync" time
- ✅ Auto-sync runs at scheduled intervals (check cron logs)

### 6. Notification Bell UI

**Steps:**
1. Open notification bell
2. Check different notification types

**Expected Results:**
- ✅ Unread count badge appears
- ✅ Different notification types show appropriate icons:
  - 🆕 New Job Detected (Sparkles icon)
  - ⚠️ Ambiguous Match (AlertCircle icon)
  - ✅ Job Updated (CheckCircle icon)
  - ℹ️ Sync Complete (Info icon)
  - ❌ Sync Error (AlertCircle icon)
- ✅ "Mark as read" button works
- ✅ "Dismiss" button works
- ✅ Notifications auto-refresh every 30 seconds

### 7. No Match Handling

**Test Scenario:** Email can't be matched and has insufficient info

**Steps:**
1. Receive an email that mentions a company but no job title
2. Run email sync
3. Check notification bell

**Expected Results:**
- ✅ Notification appears: "New Email Detected"
- ✅ Shows email details
- ✅ Indicates insufficient information
- ✅ Can be dismissed

### 8. Sync Error Handling

**Test Scenario:** Email sync fails (e.g., wrong credentials)

**Steps:**
1. Temporarily break email integration (wrong password)
2. Run email sync
3. Check notification bell

**Expected Results:**
- ✅ Error notification appears
- ✅ Shows error message
- ✅ Links to settings page

## 🔍 Debugging Tips

### Check Notification API
```bash
# Get all notifications
curl http://localhost:3000/api/notifications

# Get unread count
curl http://localhost:3000/api/notifications | jq '.unreadCount'
```

### Check Database
```bash
# View notifications
bunx prisma studio
# Navigate to Notification table
```

### Check Logs
- Browser console for frontend errors
- Server logs for API errors
- Email sync logs in terminal

## 📝 Test Data

### Create Test Jobs
```sql
-- Multiple jobs from same company (for ambiguous match test)
INSERT INTO "Job" (id, "userId", title, company, status, "createdAt")
VALUES 
  ('job1', 'your-user-id', 'Frontend Developer', 'Acme Corp', 'SAVED', NOW()),
  ('job2', 'your-user-id', 'Backend Developer', 'Acme Corp', 'APPLIED', NOW()),
  ('job3', 'your-user-id', 'Full Stack Developer', 'Acme Corp', 'SAVED', NOW());
```

### Test Email Scenarios
1. **Exact Match:** Email from recruiter@acmecorp.com about "Frontend Developer"
2. **Ambiguous Match:** Email from recruiter@acmecorp.com mentioning "Acme Corp" but no specific position
3. **New Job:** Email about "DevOps Engineer" at "Acme Corp" (not in list)
4. **No Match:** Email from unknown company with no job details

## ✅ Success Criteria

All tests should pass:
- ✅ No jobs are auto-created
- ✅ All scenarios create appropriate notifications
- ✅ Notifications appear in bell
- ✅ Actions (Create Job, Resolve Match) work correctly
- ✅ Job updates trigger notifications
- ✅ Auto-sync runs on schedule
- ✅ UI is responsive and user-friendly

## 🐛 Known Issues

None currently! Report any issues you find.

## 📚 Next Steps After Testing

1. Test all scenarios thoroughly
2. Report any bugs or issues
3. Provide feedback on UX
4. Suggest improvements if needed
