# Verify Your Auto-Sync Setup

## Important Note About URLs

For `APP_URL` in GitHub Secrets, you only need **ONE URL**:
- ✅ Your **production URL** from Vercel (e.g., `https://your-app.vercel.app`)
- ❌ You don't need preview URLs or multiple URLs

Vercel gives you multiple URLs, but use the main production one.

## Quick Verification Checklist

### ✅ GitHub Secrets
Go to: GitHub → Settings → Secrets and variables → Actions

You should have:
1. **APP_URL** - Your production Vercel URL (just one!)
2. **CRON_SECRET** - A secret token

### ✅ Vercel Environment Variables
Go to: Vercel Dashboard → Your Project → Settings → Environment Variables

You should have:
1. **CRON_SECRET** - Same value as GitHub secret (must match exactly!)

### ✅ Test the Workflow

1. Go to GitHub → **Actions** tab
2. Select **"Sync Emails Hourly"** workflow  
3. Click **"Run workflow"** → **"Run workflow"** (manual trigger)
4. Click on the running workflow to see logs
5. Should see: `✓ Sync complete` or similar success message

### ✅ Check Sync Logs

Run this command locally:
```bash
bun run scripts/check-sync-status.ts
```

Look for:
- ✅ Recent sync logs with `source: 'cron'`
- ✅ `nextSyncAt` being updated
- ✅ No "overdue" warnings

## If You Added Multiple URLs

If you added multiple URLs to GitHub Secrets, that's okay - GitHub will use the one named `APP_URL`. Just make sure:
- The secret name is exactly `APP_URL` (not `APP_URL_1`, etc.)
- The value is your production URL

## Next Steps

After verifying everything:
1. The workflow will run automatically **every hour** (on the hour)
2. Or trigger it manually anytime via "Run workflow"
3. Check sync logs to confirm it's working
