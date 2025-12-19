# Testing Checklist

## Authentication & Onboarding

### ✅ Sign Up Flow
- [ ] **Google Sign Up**
  - [ ] Click "Continue with Google" on homepage
  - [ ] Complete Google OAuth flow
  - [ ] Should redirect to `/onboarding` (not `/jobs`)
  - [ ] Verify Profile row created in database with correct user ID
  
- [ ] **Email/Password Sign Up**
  - [ ] Go to `/signup`
  - [ ] Fill in email and password
  - [ ] Submit form
  - [ ] Check email for confirmation (if enabled)
  - [ ] After confirming, should redirect to `/onboarding`
  - [ ] Verify Profile row created in database

### ✅ Onboarding Flow
- [ ] **First-time User**
  - [ ] After signup, automatically redirected to `/onboarding`
  - [ ] See Welcome step with feature highlights
  - [ ] Click "Get Started" → moves to Email Sync step
  
- [ ] **Email Sync Step**
  - [ ] See Google, Outlook, IMAP options
  - [ ] Click "Set up later" → moves to Complete step
  - [ ] Click Google button → completes OAuth → returns to `/onboarding?step=complete`
  - [ ] Click Outlook button → completes OAuth → returns to `/onboarding?step=complete`
  
- [ ] **Complete Step**
  - [ ] See "You're All Set!" message
  - [ ] Click button → redirects to `/jobs`
  - [ ] Verify `onboarding_completed: true` set in user metadata

- [ ] **Skip Behavior**
  - [ ] New user tries to access `/jobs` directly → redirected to `/onboarding`
  - [ ] User with `onboarding_completed: true` → can access all routes normally

### ✅ Sign In Flow
- [ ] **Google Sign In**
  - [ ] Click "Continue with Google" on homepage
  - [ ] If already signed up → should sign in and go to `/jobs`
  - [ ] If not signed up → should create account and go to `/onboarding`
  
- [ ] **Email/Password Sign In**
  - [ ] Go to `/login` or homepage
  - [ ] Enter email/password
  - [ ] Should sign in and redirect to `/jobs`
  - [ ] Wrong password → shows error message

### ✅ Route Protection
- [ ] **Unauthenticated Access**
  - [ ] Visit `/jobs` without login → redirects to `/` (login page)
  - [ ] Visit `/board` without login → redirects to `/` 
  - [ ] Visit `/today` without login → redirects to `/`
  - [ ] Visit `/settings` without login → redirects to `/`
  - [ ] Visit `/profile` without login → redirects to `/`
  
- [ ] **Authenticated Access**
  - [ ] Logged-in user visits `/` → redirects to `/jobs`
  - [ ] Logged-in user visits `/login` → redirects to `/jobs`
  - [ ] All protected routes accessible when logged in

### ✅ User Data Isolation
- [ ] **Multi-User Test**
  - [ ] Create User A account, add 2-3 jobs
  - [ ] Log out
  - [ ] Create User B account (different email)
  - [ ] User B should see empty jobs list (0 jobs)
  - [ ] Add jobs as User B
  - [ ] Log out, log back in as User A
  - [ ] User A should still see only their original jobs
  - [ ] User B's jobs should not appear

### ✅ Logout
- [ ] **Logout Functionality**
  - [ ] Click user avatar → click "Log out"
  - [ ] Should sign out from Supabase
  - [ ] Redirects to `/` (login page)
  - [ ] Trying to access `/jobs` again → redirects back to `/`

---

## UI & Layout Consistency

### ✅ Top Bar & Sidebar
- [ ] **All Pages Have Consistent Layout**
  - [ ] `/jobs` - has top bar, sidebar, proper spacing
  - [ ] `/board` - has top bar, sidebar, proper spacing
  - [ ] `/today` - has top bar, sidebar, proper spacing
  - [ ] `/profile` - has top bar, sidebar, proper spacing
  - [ ] `/settings/integrations` - has top bar, sidebar, proper spacing
  - [ ] All top bars stretch edge-to-edge (full width)
  - [ ] Sidebar sits under top bar (not overlapping)
  - [ ] Content has proper `pt-[88px]` offset from top bar

### ✅ User Profile Menu
- [ ] **Avatar & Info**
  - [ ] Shows user's initials (from name or email)
  - [ ] Click avatar → dropdown opens
  - [ ] Shows user's name and email (from Supabase metadata)
  - [ ] Has "Profile" link → goes to `/profile`
  - [ ] Has "Settings" link → goes to `/settings/integrations`
  - [ ] Has "Log out" button → signs out

---

## Email Integration

### ✅ Email Settings Page
- [ ] **IMAP Configuration**
  - [ ] Visit `/settings/integrations`
  - [ ] See "Use IMAP (Custom Email)" button if no integration
  - [ ] Fill in IMAP form: email, host, port, username, password
  - [ ] Click "Test Connection" → should test with entered values (not env vars)
  - [ ] Click "Save Settings" → saves to database, tests connection
  - [ ] After save, see green "Connected" status box
  - [ ] Email, last synced time shown correctly

### ✅ OAuth Email Sync (Google/Outlook)
- [ ] **From Onboarding**
  - [ ] During onboarding, click "Google" → completes OAuth
  - [ ] Returns to `/onboarding?step=complete`
  - [ ] Check `/settings/integrations` → should show connected status
  
- [ ] **From Settings Page**
  - [ ] Visit `/settings/integrations`
  - [ ] Click "Connect with Google" → completes OAuth
  - [ ] Returns to `/settings/integrations`
  - [ ] Should show connected status

### ✅ Email Sync Functionality
- [ ] **Sync Emails Button (Top)**
  - [ ] When no integration → notification bell shows red dot
  - [ ] Click bell → dropdown shows "Set up email sync"
  - [ ] Click link → goes to `/onboarding?step=email`
  
- [ ] **Sync Emails Button (Settings)**
  - [ ] With integration configured → click "Sync Emails"
  - [ ] Button shows "Syncing..." state
  - [ ] After completion, shows success message with stats
  - [ ] Terminal logs show email processing details
  - [ ] If jobs exist → should match and update statuses
  - [ ] If no jobs → sync completes but updates 0 jobs

### ✅ Notification Bell
- [ ] **No Email Integration**
  - [ ] Bell icon has red notification dot
  - [ ] Click bell → dropdown opens
  - [ ] Shows "Set up email sync" notification
  - [ ] Click → redirects to `/onboarding?step=email`
  
- [ ] **With Email Integration**
  - [ ] Bell icon has no dot (or dot disappears)
  - [ ] Click bell → dropdown is empty (or shows "No notifications")

---

## Profile Management

### ✅ Profile Page
- [ ] **View Profile**
  - [ ] Visit `/profile`
  - [ ] See email address (read-only)
  - [ ] See name field (editable)
  - [ ] See avatar URL field (editable)
  
- [ ] **Update Profile**
  - [ ] Change name → click "Save changes"
  - [ ] Change avatar URL → click "Save changes"
  - [ ] Verify changes saved in database
  - [ ] Verify UserProfileMenu shows updated name/initials

---

## Core Functionality

### ✅ Jobs Management
- [ ] **Add Job**
  - [ ] Click "Add Job" → modal opens
  - [ ] Fill in job details → save
  - [ ] Job appears in jobs list
  - [ ] Job is associated with current user's ID
  
- [ ] **Add Job from URL**
  - [ ] Click "Add from URL" → modal opens
  - [ ] Enter job URL (LinkedIn, Indeed, etc.)
  - [ ] Scrapes job details
  - [ ] Preview/edit before saving
  - [ ] Save → job appears in list

- [ ] **Edit/Delete Job**
  - [ ] Click job → opens detail view
  - [ ] Edit job details
  - [ ] Delete job → redirects to `/jobs`

### ✅ Board View
- [ ] **Kanban Board**
  - [ ] Visit `/board`
  - [ ] See all jobs organized by status
  - [ ] Drag job from one column to another
  - [ ] Status updates in database
  - [ ] Activity record created for status change

### ✅ Today View
- [ ] **Dashboard**
  - [ ] Visit `/today`
  - [ ] See status counts (SAVED, APPLIED, INTERVIEW, etc.)
  - [ ] See "Interviews Today" section (if any)
  - [ ] See "Recently Applied" section
  - [ ] See "Recent Status Changes" section
  - [ ] All data is user-specific

---

## Database & Backend

### ✅ Database Schema
- [ ] **Profile Model**
  - [ ] New users automatically get Profile row (via trigger)
  - [ ] Profile.id matches Supabase auth.users.id
  - [ ] Email stored correctly
  
- [ ] **User-Scoped Queries**
  - [ ] All Job queries filter by `userId`
  - [ ] All Activity queries filter by `userId`
  - [ ] All EmailIntegration queries filter by `userId`

### ✅ Server Actions
- [ ] **Authentication**
  - [ ] All server actions use `requireAuth()`
  - [ ] Unauthenticated requests fail gracefully
  - [ ] Actions use `user.id` from auth (not TEMP_USER_ID)

---

## Edge Cases & Error Handling

### ✅ Error Scenarios
- [ ] **Missing Environment Variables**
  - [ ] If Supabase URL/key missing → shows helpful error
  
- [ ] **Network Errors**
  - [ ] OAuth flow interrupted → handles gracefully
  
- [ ] **Invalid IMAP Credentials**
  - [ ] Test connection with wrong password → shows error
  - [ ] Save settings with wrong credentials → shows error

- [ ] **Email Sync Errors**
  - [ ] Sync fails → error logged to `lastError` field
  - [ ] Error displayed in UI

---

## Performance & UX

### ✅ Loading States
- [ ] **Buttons Show Loading**
  - [ ] "Sign In" button shows "Signing in..."
  - [ ] "Sync Emails" shows "Syncing..."
  - [ ] "Save Settings" shows loading state

### ✅ Redirects
- [ ] **Post-Auth Redirects**
  - [ ] Login with `?next=/board` → redirects to `/board` after login
  - [ ] Protected route access → redirects to login with `next` param
  - [ ] After login → redirects to original destination

---

## Final Verification

- [ ] **End-to-End User Journey**
  1. New user signs up with Google
  2. Completes onboarding (skips email sync)
  3. Adds a job manually
  4. Adds a job from URL
  5. Views job on board view
  6. Moves job to different status
  7. Views Today dashboard
  8. Sets up email integration
  9. Syncs emails
  10. Logs out
  11. Logs back in
  12. All data persists correctly

- [ ] **No Console Errors**
  - [ ] Open browser console
  - [ ] Navigate through all pages
  - [ ] Verify no JavaScript errors
  - [ ] Verify no React warnings

- [ ] **Database Integrity**
  - [ ] No orphaned records
  - [ ] All foreign keys valid
  - [ ] User deletions cascade properly (if implemented)

---

## Notes
- Run tests with multiple user accounts to verify data isolation
- Test both Google OAuth and email/password flows
- Verify that Prisma migrations ran successfully
- Check that all environment variables are set correctly
- Verify Supabase trigger for Profile creation is working

