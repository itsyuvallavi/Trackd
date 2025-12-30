# Auto-Sync Cron Setup Guide

## Current Setup

I've configured two options for auto-sync:

### Option 1: Vercel Cron (Recommended)

If you're deployed on Vercel, use `vercel.json` configuration:

**File: `vercel.json`**
```json
{
  "crons": [
    {
      "path": "/api/cron/sync-emails",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

This runs every 15 minutes. After deploying to Vercel:
1. Vercel will automatically detect the `vercel.json` file
2. The cron job will start running
3. No additional configuration needed (no CRON_SECRET required)

**To deploy:**
```bash
vercel --prod
```

### Option 2: GitHub Actions

If you're using GitHub Actions, the workflow is already configured at `.github/workflows/sync-emails.yml`.

**Required setup:**
1. Set GitHub Secrets:
   - `APP_URL`: Your production URL (e.g., `https://your-app.vercel.app`)
   - `CRON_SECRET`: A secret token (generate a random string)

2. Set environment variable in production:
   - `CRON_SECRET`: Same value as GitHub secret

**Schedule:** Every hour (`0 * * * *`)

## Verify It's Working

Run the diagnostic script:
```bash
bun run scripts/check-sync-status.ts
```

Look for:
- ✅ Auto-sync enabled
- ✅ Recent sync logs with `source: 'cron'`
- ✅ `nextSyncAt` being updated regularly

## Troubleshooting

### No cron syncs in logs
- Check if you're using Vercel: ensure `vercel.json` is deployed
- Check if you're using GitHub Actions: ensure secrets are set and workflow is enabled
- Verify the endpoint works: `curl https://your-app.com/api/cron/sync-emails`

### "Unauthorized" errors
- For Vercel Cron: No action needed (should work automatically)
- For GitHub Actions: Ensure `CRON_SECRET` matches in both GitHub and production env

### Syncs not happening on schedule
- Vercel Cron: Check Vercel dashboard → Settings → Cron Jobs
- GitHub Actions: Check GitHub → Actions tab for workflow runs
