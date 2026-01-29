# Auto-Archive Feature - Implementation Complete ✅

## Overview

The auto-archive feature has been successfully implemented. Jobs that haven't received email responses within 30 days are automatically moved to `ARCHIVED` status.

## Files Created

### 1. Core Logic
**File**: `src/lib/auto-archive.ts`
- `archiveInactiveJobs()` - Archives jobs for a specific user
- `archiveInactiveJobsForAllUsers()` - Processes all users with active email integrations

### 2. Cron Endpoint
**File**: `src/app/api/cron/auto-archive/route.ts`
- Secure cron endpoint with authentication
- Feature flag support (`AUTO_ARCHIVE_ENABLED`)
- Configurable via environment variables
- Returns detailed statistics

### 3. Test Script
**File**: `scripts/test-auto-archive.ts`
- Test the archive logic for specific users or all users
- Shows before/after state
- Useful for debugging and verification

### 4. Configuration
**File**: `vercel.json` (updated)
- Added cron schedule: `0 2 * * *` (runs daily at 2 AM)

## How It Works

### Archive Criteria

A job will be archived if **ALL** of the following are true:

1. ✅ Status is `APPLIED`, `INTERVIEW`, or `SAVED`
2. ✅ Has at least one `EMAIL_UPDATE` activity (won't archive jobs that never had email activity)
3. ✅ Last `EMAIL_UPDATE` activity was 30+ days ago
4. ✅ Not manually updated in the last 7 days (`updatedAt` check)
5. ✅ Not already `ARCHIVED` or `REJECTED`

### Exclusions

Jobs will **NOT** be archived if:
- Status is `OFFER` (user might be negotiating)
- Status is `REJECTED` (already handled)
- Status is `ARCHIVED` (already archived)
- Never had email activity (only archive if there WAS activity that stopped)
- Manually updated in last 7 days (user is actively managing)

### Process Flow

1. Cron job runs daily at 2 AM
2. Finds all users with active email integrations
3. For each user:
   - Queries jobs matching criteria
   - Filters jobs with old email activity
   - Updates status to `ARCHIVED`
   - Creates `STATUS_CHANGE` activity record
4. Returns statistics

## Configuration

### Environment Variables

```bash
# Enable/disable auto-archive (default: enabled)
AUTO_ARCHIVE_ENABLED=true

# Days since last email activity (default: 30)
AUTO_ARCHIVE_DAYS=30

# Exclude jobs updated in last N days (default: 7)
AUTO_ARCHIVE_EXCLUDE_RECENT_DAYS=7

# Cron authentication (same as email sync)
CRON_SECRET=your-secret-token
```

### Cron Schedule

Currently set to run **daily at 2 AM** (`0 2 * * *`)

To change the schedule, update `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/auto-archive",
      "schedule": "0 2 * * *"  // Change this
    }
  ]
}
```

## Testing

### Manual Test

Test for a specific user:
```bash
bun run scripts/test-auto-archive.ts <userId>
```

Test for all users:
```bash
bun run scripts/test-auto-archive.ts
```

### Test Cron Endpoint Locally

```bash
# With CRON_SECRET set
curl -X GET "http://localhost:3001/api/cron/auto-archive" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Production Test

```bash
# With CRON_SECRET set
curl -X GET "https://your-app.vercel.app/api/cron/auto-archive" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Activity Records

When a job is archived, an Activity record is created:

```typescript
{
  type: 'STATUS_CHANGE',
  fromStatus: 'APPLIED' | 'INTERVIEW' | 'SAVED',
  toStatus: 'ARCHIVED',
  description: 'Auto-archived: No email activity for 30+ days'
}
```

This allows users to see in the job timeline when and why a job was archived.

## Monitoring

### Logs

The cron endpoint logs:
- Number of users processed
- Number of jobs archived per user
- Any errors encountered
- Configuration used

### Response Format

```json
{
  "success": true,
  "enabled": true,
  "config": {
    "daysSinceLastEmail": 30,
    "excludeRecentDays": 7
  },
  "results": {
    "totalUsersProcessed": 5,
    "totalJobsArchived": 12,
    "totalErrors": 0
  },
  "perUserResults": {
    "user-id-1": {
      "jobsArchived": 3,
      "jobIds": ["job-1", "job-2", "job-3"],
      "errors": []
    }
  }
}
```

## Safety Features

1. **Transactions**: Status update and activity creation happen atomically
2. **Error Handling**: Individual job failures don't stop the entire process
3. **Feature Flag**: Can be disabled via `AUTO_ARCHIVE_ENABLED=false`
4. **Exclusions**: Multiple safeguards prevent archiving active jobs
5. **Logging**: Detailed logs for debugging and monitoring

## Future Enhancements

1. **User Preferences**: Allow users to configure auto-archive settings
2. **Notifications**: Notify users when jobs are archived
3. **Undo Feature**: Allow users to un-archive jobs
4. **Smart Archiving**: ML-based prediction of "dead" applications
5. **Per-Status Rules**: Different rules for APPLIED vs INTERVIEW

## Troubleshooting

### Jobs Not Being Archived

1. Check if job has `EMAIL_UPDATE` activities
2. Verify last email activity date is >30 days ago
3. Check if job was manually updated in last 7 days
4. Verify job status is not `OFFER`, `REJECTED`, or `ARCHIVED`

### Cron Not Running

1. Verify `vercel.json` is deployed
2. Check Vercel dashboard → Settings → Cron Jobs
3. Verify `AUTO_ARCHIVE_ENABLED` is not `false`
4. Check cron logs in Vercel dashboard

### Errors

Check the cron response for `perUserResults` to see which users had errors and why.

## Related Documentation

- [Auto-Archive Feature Plan](./AUTO_ARCHIVE_FEATURE_PLAN.md) - Original plan and requirements
- [Cron Setup Guide](./CRON_SETUP.md) - General cron setup information
