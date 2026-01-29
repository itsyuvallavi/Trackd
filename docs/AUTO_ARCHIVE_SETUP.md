# Auto-Archive Setup & Verification Guide

## ✅ Current Status

The auto-archive feature is **fully configured** and will run automatically. Here's what's set up:

### 1. Cron Schedule ✅
**File**: `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-archive",
      "schedule": "0 2 * * *"  // Runs daily at 2 AM UTC
    }
  ]
}
```

### 2. Endpoint ✅
**File**: `src/app/api/cron/auto-archive/route.ts`
- Secure authentication (Vercel Cron header or CRON_SECRET)
- Feature flag support (`AUTO_ARCHIVE_ENABLED`)
- Configurable via environment variables
- Processes **ALL users** (not just those with email integrations)

### 3. Logic ✅
**File**: `src/lib/auto-archive.ts`
- Archives jobs older than 30 days
- Works for jobs WITH and WITHOUT email activities
- Excludes recently updated jobs (7 days)
- Excludes OFFER, REJECTED, ARCHIVED statuses

## How It Works Automatically

### On Vercel Deployment

1. **Deploy to Vercel**: When you deploy, Vercel automatically reads `vercel.json` and sets up the cron job
2. **Daily Execution**: The cron runs every day at 2 AM UTC
3. **Automatic Processing**: All users with jobs older than 30 days are processed
4. **No Manual Action Required**: Once deployed, it runs automatically forever

### Verification Steps

#### 1. Check Cron is Configured
After deploying to Vercel:
- Go to Vercel Dashboard → Your Project → Settings → Cron Jobs
- You should see `/api/cron/auto-archive` scheduled for `0 2 * * *`

#### 2. Check Cron Execution Logs
- Go to Vercel Dashboard → Your Project → Logs
- Filter by "cron" or search for "auto-archive"
- You should see logs like:
  ```
  🔄 Starting auto-archive cron job...
  ✅ Auto-archive complete:
     Users processed: 3
     Jobs archived: 15
  ```

#### 3. Test Manually (Optional)
You can test the endpoint manually:
```bash
# With CRON_SECRET set
curl -X GET "https://your-app.vercel.app/api/cron/auto-archive" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Configuration Options

### Environment Variables (Optional)

Set these in Vercel Dashboard → Settings → Environment Variables:

```bash
# Enable/disable auto-archive (default: enabled)
AUTO_ARCHIVE_ENABLED=true

# Days since last activity to archive (default: 30)
AUTO_ARCHIVE_DAYS=30

# Exclude jobs updated in last N days (default: 7)
AUTO_ARCHIVE_EXCLUDE_RECENT_DAYS=7

# Cron authentication secret (required for manual testing)
CRON_SECRET=your-secret-token
```

## What Gets Archived

### ✅ Will Be Archived
- Jobs with status: `APPLIED`, `INTERVIEW`, or `SAVED`
- Jobs older than 30 days (based on `savedAt` date)
- Jobs with email activity where last email was 30+ days ago
- Jobs WITHOUT email activity that are 30+ days old
- Jobs not manually updated in last 7 days

### ❌ Will NOT Be Archived
- Jobs with status: `OFFER`, `REJECTED`, or `ARCHIVED`
- Jobs manually updated in last 7 days
- Jobs less than 30 days old

## Monitoring

### Check Archive Activity

1. **Via Logs**: Check Vercel logs after 2 AM UTC daily
2. **Via Database**: Query for jobs with status `ARCHIVED` and recent `STATUS_CHANGE` activities
3. **Via UI**: Jobs will appear in the "Archived" tab in your jobs list

### Expected Behavior

- **First Run**: May archive many jobs if you have old data
- **Subsequent Runs**: Will only archive new jobs that meet criteria
- **Daily**: Runs once per day, so jobs are archived within 24 hours of meeting criteria

## Troubleshooting

### Cron Not Running

1. **Check Vercel Dashboard**: Verify cron job exists in Settings → Cron Jobs
2. **Check Deployment**: Ensure `vercel.json` is deployed
3. **Check Logs**: Look for errors in Vercel logs
4. **Manual Test**: Try calling the endpoint manually with CRON_SECRET

### Jobs Not Being Archived

1. **Check Age**: Verify jobs are actually 30+ days old
2. **Check Status**: Ensure jobs are not OFFER, REJECTED, or ARCHIVED
3. **Check Updated Date**: Jobs updated in last 7 days won't be archived
4. **Check Logs**: Look for errors in the cron execution logs

### Too Many Jobs Archived

1. **Increase Days**: Set `AUTO_ARCHIVE_DAYS=60` (or higher) to archive after 60 days
2. **Disable Temporarily**: Set `AUTO_ARCHIVE_ENABLED=false` to stop archiving
3. **Check Criteria**: Review what's being archived in the logs

## Next Steps

1. ✅ **Deploy to Vercel** - The cron will be set up automatically
2. ✅ **Monitor First Run** - Check logs after first 2 AM UTC execution
3. ✅ **Verify Results** - Check that jobs are being archived correctly
4. ✅ **Adjust Settings** - Modify `AUTO_ARCHIVE_DAYS` if needed

## Summary

**The auto-archive feature is fully automated!** Once deployed to Vercel:
- ✅ Runs daily at 2 AM UTC
- ✅ Processes all users automatically
- ✅ Archives jobs older than 30 days
- ✅ No manual intervention needed

Just deploy and it will work! 🎉
