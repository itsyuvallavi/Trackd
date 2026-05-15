# Extension Testing Guide

Complete testing checklist for the Trackd Chrome Extension.

## Prerequisites

1. **Local Development Server Running**
   ```bash
   cd my-app
   bun run dev
   ```
   Server should be running at `http://localhost:3000`

2. **Set local API URL** (if testing locally)
   - Open the extension service/popup console
   - Run:
     ```javascript
     chrome.storage.local.set({ trackdApiUrl: 'http://localhost:3001' })
     ```
   - Reload the extension
   - Clear it after local testing:
     ```javascript
     chrome.storage.local.remove('trackdApiUrl')
     ```

3. **Extension Installed**
   - Chrome: `chrome://extensions/` → Enable Developer Mode → Load unpacked
   - Select the `browser-extension` folder

## Test Suite

### 1. Initial Connection Flow

#### Test 1.1: Generate Extension Key
- [ ] Navigate to `http://localhost:3000/settings/integrations`
- [ ] Click "Generate Extension Key"
- [ ] Verify key appears (format: `tk_...`)
- [ ] Verify "Copy" button works
- [ ] Verify key is hidden by default (shows as `tk_a1b2c3••••••`)

#### Test 1.2: Connect Extension
- [ ] Click extension icon
- [ ] Should see "🔗 Connect to Trackd" screen
- [ ] Paste the extension key
- [ ] Click "Connect"
- [ ] Should see "Connected as [your-email]" in header
- [ ] Footer should show "⚙️ Settings" and "🔓 Disconnect"

#### Test 1.3: Invalid Key
- [ ] Disconnect extension
- [ ] Try connecting with invalid key (e.g., `tk_invalid123`)
- [ ] Should see error: "Invalid key. Please check and try again."

### 2. Job Extraction & Saving

#### Test 2.1: LinkedIn Job Posting
- [ ] Navigate to a LinkedIn job posting
  Example: https://www.linkedin.com/jobs/view/[any-job-id]/
- [ ] Click extension icon
- [ ] Verify extracted data:
  - Company name ✓
  - Job title ✓
  - Location ✓
  - Salary (if available) ✓
  - Source badge shows "LinkedIn"
- [ ] Edit fields if needed
- [ ] Click "Save to Trackd"
- [ ] Should see "✅ Job Saved!" success screen
- [ ] Click "View in Trackd"
- [ ] Verify job appears in Trackd dashboard

#### Test 2.2: Indeed Job Posting
- [ ] Navigate to an Indeed job posting
  Example: https://www.indeed.com/viewjob?jk=[any-job-id]
- [ ] Click extension icon
- [ ] Verify extracted data
- [ ] Source badge should show "Indeed"
- [ ] Save and verify in Trackd

#### Test 2.3: Greenhouse Career Page
- [ ] Navigate to a Greenhouse job page
  Example: https://boards.greenhouse.io/[company]/jobs/[job-id]
- [ ] Click extension icon
- [ ] Verify extraction and save
- [ ] Source badge should show "Greenhouse"

#### Test 2.4: Lever Career Page
- [ ] Navigate to a Lever job page
  Example: https://jobs.lever.co/[company]/[job-id]
- [ ] Click extension icon
- [ ] Verify extraction and save
- [ ] Source badge should show "Lever"

#### Test 2.5: Generic/Unknown Site
- [ ] Navigate to a company career page (non-standard)
- [ ] Click extension icon
- [ ] Extension should attempt extraction (may need manual editing)
- [ ] Fill in missing fields manually
- [ ] Verify save works

#### Test 2.6: Non-Job Page
- [ ] Navigate to a non-job page (e.g., Google homepage)
- [ ] Click extension icon
- [ ] Should see "🔍 No job detected" screen
- [ ] Message should list supported job boards

### 3. Duplicate Detection

#### Test 3.1: Save Duplicate Job
- [ ] Save a job from LinkedIn
- [ ] Note the company and title
- [ ] Navigate to the same job again (or similar job with same company + title)
- [ ] Try to save again
- [ ] Should see warning: "Already saved on [date]"
- [ ] Verify savedJobId is set (for "View Existing")

#### Test 3.2: Different Job, Same Company
- [ ] Find a different position at the same company
- [ ] Save it
- [ ] Should save successfully (not a duplicate)

### 4. Key Management

#### Test 4.1: Regenerate Key
- [ ] With extension connected, go to Settings → Integrations
- [ ] Click "Regenerate Key"
- [ ] Copy new key
- [ ] Try to save a job with old extension (still connected with old key)
- [ ] Should get "Session expired" error
- [ ] Extension should show "Not connected" and prompt to reconnect
- [ ] Reconnect with new key
- [ ] Verify saving works again

#### Test 4.2: Show/Hide Key
- [ ] In Settings → Integrations, generate a key
- [ ] Verify key is hidden by default (••••)
- [ ] Click eye icon to show
- [ ] Verify full key is visible
- [ ] Click eye icon again to hide
- [ ] Verify key is hidden again

#### Test 4.3: Last Used Timestamp
- [ ] Save a job via extension
- [ ] Go to Settings → Integrations
- [ ] Verify "Last used" timestamp is updated

### 5. Persistence & State Management

#### Test 5.1: Browser Restart
- [ ] Connect extension with valid key
- [ ] Close Chrome completely
- [ ] Reopen Chrome
- [ ] Click extension icon
- [ ] Should still be connected (key persisted in chrome.storage.local)

#### Test 5.2: Save Another Flow
- [ ] Save a job
- [ ] On success screen, click "Save Another"
- [ ] Should return to job extraction view
- [ ] Should attempt to extract current page data

#### Test 5.3: Disconnect and Reconnect
- [ ] Click "🔓 Disconnect" in extension footer
- [ ] Should return to connection screen
- [ ] Reconnect with same key
- [ ] Should work normally

### 6. Error Handling

#### Test 6.1: Network Error (Backend Down)
- [ ] Stop your dev server
- [ ] Try to save a job
- [ ] Should see error message
- [ ] Restart server and verify it works again

#### Test 6.2: Missing Required Fields
- [ ] On a job extraction screen, clear the title field
- [ ] Try to save
- [ ] Should see error: "Company and position are required"

#### Test 6.3: Invalid Response Handling
- [ ] (Advanced) Use browser DevTools to intercept API call
- [ ] Return invalid JSON
- [ ] Verify extension handles gracefully with error message

### 7. UI/UX Testing

#### Test 7.1: All Views Render Correctly
- [ ] Connect view renders with proper styling
- [ ] Job form view renders with all fields
- [ ] No job view renders with proper message
- [ ] Success view renders with checkmark and buttons
- [ ] Footer shows when connected

#### Test 7.2: Loading States
- [ ] Click "Connect" and verify loading spinner appears
- [ ] Click "Save to Trackd" and verify button shows "Saving..."
- [ ] Verify buttons are disabled during loading

#### Test 7.3: Message Displays
- [ ] Verify success messages (green)
- [ ] Verify error messages (red)
- [ ] Verify warning messages (yellow/orange)

### 8. Settings Integration

#### Test 8.1: Settings Button
- [ ] With extension connected, click "⚙️ Settings" in footer
- [ ] Should open Trackd settings page in new tab
- [ ] URL should be `/settings/integrations`

#### Test 8.2: "Get Key" Link
- [ ] Disconnect extension
- [ ] Click "Get one at trackd.app/settings" link
- [ ] Should open settings page in new tab

### 9. CORS & API Communication

#### Test 9.1: CORS Headers
- [ ] Open browser DevTools (F12)
- [ ] Go to Network tab
- [ ] Save a job
- [ ] Check the `/api/extension/save-job` request
- [ ] Verify headers include:
  - `X-Extension-Key: tk_...`
  - `Content-Type: application/json`
- [ ] Verify response has CORS headers (Access-Control-Allow-Origin)

#### Test 9.2: API Endpoint Responses
- [ ] Validate key: Should return `{ valid: true, email: "..." }`
- [ ] Save job: Should return `{ success: true, job: { id, company, title } }`
- [ ] Duplicate: Should return `{ error: "DUPLICATE_JOB", existingJob: { id, savedAt } }` with 409 status

### 10. Production Readiness

#### Test 10.1: Update API URL
- [ ] Change `API_URL` in popup.js to production URL
- [ ] Reload extension
- [ ] Verify connection and saving works with production backend

#### Test 10.2: Extension Icons
- [ ] Verify all icons load correctly (16, 32, 48, 128px)
- [ ] Check extension icon in toolbar
- [ ] Check icon in Chrome Extensions page

#### Test 10.3: Manifest Validation
- [ ] Go to `chrome://extensions/`
- [ ] Check for any manifest errors or warnings
- [ ] Verify permissions are correct

## Test Results Summary

Date: ___________  
Tester: ___________  
Environment: ___________

| Test Category | Pass/Fail | Notes |
|--------------|-----------|-------|
| Connection Flow | ⬜ | |
| Job Extraction | ⬜ | |
| Duplicate Detection | ⬜ | |
| Key Management | ⬜ | |
| Persistence | ⬜ | |
| Error Handling | ⬜ | |
| UI/UX | ⬜ | |
| Settings Integration | ⬜ | |
| CORS & API | ⬜ | |
| Production Ready | ⬜ | |

## Common Issues & Solutions

### Issue: Extension doesn't detect jobs on LinkedIn
**Solution**: LinkedIn may have updated their HTML structure. Check browser console for errors.

### Issue: "Session expired" error
**Solution**: Key was regenerated. Get new key from settings and reconnect.

### Issue: Extension not loading
**Solution**: 
1. Check for errors in `chrome://extensions/`
2. Verify all files exist (popup.html, popup.js, manifest.json)
3. Reload extension

### Issue: CORS errors in console
**Solution**: Verify `next.config.ts` has CORS headers for `/api/extension/*` routes.

## Automated Testing (Future)

Consider implementing:
- [ ] Playwright tests for extension popup
- [ ] API endpoint tests with different key scenarios
- [ ] E2E tests for full save flow
- [ ] Unit tests for extractJobData function

## Sign-off

Extension tested and ready for: ⬜ Development ⬜ Staging ⬜ Production

Tester Signature: ___________  
Date: ___________
