# How to Test Your Cron Setup

## Quick Test Steps

### 1. Test via GitHub Actions (Recommended)

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`
2. Click on **"Sync Emails Hourly"** workflow
3. Click **"Run workflow"** dropdown button (top right)
4. Click **"Run workflow"** 
5. Wait a few seconds, then click on the running workflow
6. Click on the **"Trigger email sync"** step to see logs

**Expected result:**
- ✅ Should see success message
- ✅ Or error message showing what went wrong

### 2. Check Sync Logs

After the workflow runs, check your sync status:

```bash
bun run scripts/check-sync-status.ts
```

**Expected result:**
- ✅ Should see sync logs with `source: 'cron'`
- ✅ Recent sync timestamps
- ✅ No "overdue" warnings

### 3. Common Issues

**If you see "Unauthorized":**
- ❌ CRON_SECRET doesn't match between GitHub and Vercel
- ✅ Fix: Make sure the value is **exactly the same** in both places
- ✅ Redeploy Vercel after adding the env var

**If you see "Connection refused" or timeout:**
- ❌ APP_URL is wrong or app is down
- ✅ Fix: Make sure APP_URL is your production Vercel URL (not localhost)
- ✅ Test the URL in a browser to make sure it works

**If workflow doesn't appear:**
- ❌ Workflow file might not be committed
- ✅ Fix: Make sure `.github/workflows/sync-emails.yml` is committed and pushed

### 4. Verify Scheduled Runs

After a successful manual run, the workflow will automatically run:
- **Every hour** (on the hour: 1:00, 2:00, 3:00, etc.)

You can check the Actions tab to see scheduled runs.
