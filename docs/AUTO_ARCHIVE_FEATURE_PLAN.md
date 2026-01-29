# Auto-Archive Feature Plan

## Overview

Automatically archive jobs that haven't received email responses within 30 days. This helps users keep their job list clean and focused on active opportunities.

## Requirements

### Core Functionality
- **Trigger**: Jobs that haven't received email updates in 30+ days
- **Action**: Change status to `ARCHIVED`
- **Exclusions**: 
  - Jobs already `ARCHIVED` or `REJECTED`
  - Jobs with status `OFFER` (shouldn't auto-archive offers)
  - Jobs that were manually updated recently (within last 7 days)

### Business Logic

1. **What counts as "email activity"?**
   - Activity records with `type: EMAIL_UPDATE`
   - These are created when emails are synced and matched to jobs

2. **When to archive?**
   - Job status is `APPLIED`, `INTERVIEW`, or `SAVED`
   - Last `EMAIL_UPDATE` activity was 30+ days ago
   - Job hasn't been manually updated in last 7 days (check `updatedAt`)

3. **What NOT to archive?**
   - Jobs with status `OFFER` (user might be negotiating)
   - Jobs with status `REJECTED` (already handled)
   - Jobs with status `ARCHIVED` (already archived)
   - Jobs updated manually in last 7 days (user is actively managing)

## Implementation Plan

### Phase 1: Database & Schema (No changes needed)
✅ Schema already supports:
- `Activity` model with `type: EMAIL_UPDATE`
- `Job` model with `status: ARCHIVED`
- `updatedAt` field for tracking manual updates

### Phase 2: Core Logic Function

**File**: `src/app/api/cron/auto-archive/route.ts`

Create a new cron endpoint that:
1. Finds all jobs that meet archiving criteria
2. Updates their status to `ARCHIVED`
3. Creates `STATUS_CHANGE` activity records
4. Returns statistics

**Logic**:
```typescript
// Find jobs to archive:
// - Status: APPLIED, INTERVIEW, or SAVED
// - Last EMAIL_UPDATE activity was 30+ days ago
// - updatedAt was 7+ days ago (not recently manually updated)
// - Not already ARCHIVED or REJECTED
```

### Phase 3: Cron Job Setup

**Option A: Add to existing sync-emails cron** (Recommended)
- Run auto-archive check after email sync completes
- More efficient, runs on same schedule

**Option B: Separate cron job**
- New endpoint: `/api/cron/auto-archive`
- Run daily (once per day is sufficient)
- Add to `vercel.json`

### Phase 4: Activity Tracking

When archiving, create an Activity record:
```typescript
{
  type: 'STATUS_CHANGE',
  fromStatus: currentStatus,
  toStatus: 'ARCHIVED',
  description: 'Auto-archived: No email activity for 30+ days'
}
```

### Phase 5: User Preferences (Future Enhancement)

Add settings to allow users to:
- Enable/disable auto-archive
- Customize the time period (default: 30 days)
- Choose which statuses to auto-archive

## File Structure

```
src/app/api/cron/
  ├── sync-emails/
  │   └── route.ts (existing)
  └── auto-archive/
      ├── route.ts (new)
      └── archive-helper.ts (new - core logic)

src/lib/
  └── auto-archive.ts (new - utility functions)
```

## Implementation Details

### 1. Core Archive Function

**File**: `src/lib/auto-archive.ts`

```typescript
export async function archiveInactiveJobs(userId: string) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Find jobs that:
  // 1. Are in applicable statuses
  // 2. Last EMAIL_UPDATE was 30+ days ago
  // 3. Not manually updated in last 7 days
  
  // Update status and create activities
}
```

### 2. Cron Endpoint

**File**: `src/app/api/cron/auto-archive/route.ts`

- Verify cron authentication (same as sync-emails)
- Get all users with active email integrations
- Run archive function for each user
- Return statistics

### 3. Integration with Email Sync

**Option**: Add auto-archive check to existing sync-emails cron:
- After email sync completes successfully
- Run archive check for that user
- More efficient than separate cron

## Testing Plan

### Unit Tests
- Test archive logic with various date scenarios
- Test exclusion rules (OFFER, recently updated, etc.)
- Test activity creation

### Integration Tests
- Test cron endpoint authentication
- Test end-to-end archive flow
- Test with real database queries

### Manual Testing
1. Create test jobs with old EMAIL_UPDATE activities
2. Run cron job manually
3. Verify jobs are archived
4. Verify activities are created
5. Verify excluded jobs are NOT archived

## Edge Cases

1. **Job never had email activity**
   - Should we archive? → **No** (only archive if there WAS email activity that stopped)

2. **Job has manual notes/updates but no emails**
   - Should we archive? → **No** (user is actively managing it)

3. **Job received email but it was a rejection**
   - Status should already be REJECTED, so won't be archived ✅

4. **Multiple users**
   - Process each user separately
   - Don't archive other users' jobs

5. **Race conditions**
   - Use transactions for status update + activity creation
   - Handle concurrent updates gracefully

## Configuration

### Environment Variables
- `AUTO_ARCHIVE_ENABLED` (default: `true`)
- `AUTO_ARCHIVE_DAYS` (default: `30`)
- `AUTO_ARCHIVE_EXCLUDE_RECENT_DAYS` (default: `7`)

### Future: User Preferences
Add to `EmailIntegration` or new `UserPreferences` model:
```typescript
autoArchiveEnabled: Boolean @default(true)
autoArchiveDays: Int @default(30)
```

## Rollout Plan

1. **Phase 1**: Implement core logic and cron endpoint
2. **Phase 2**: Test with staging data
3. **Phase 3**: Deploy with feature flag (disabled by default)
4. **Phase 4**: Enable for beta users
5. **Phase 5**: Enable for all users
6. **Phase 6**: Add user preferences UI

## Success Metrics

- Number of jobs auto-archived per day
- User feedback on auto-archive feature
- Reduction in "stale" jobs in active lists
- No false positives (jobs archived incorrectly)

## Future Enhancements

1. **User Preferences UI**
   - Settings page to configure auto-archive
   - Per-user time periods
   - Enable/disable toggle

2. **Notifications**
   - Notify user when jobs are auto-archived
   - "X jobs were archived" notification

3. **Smart Archiving**
   - Consider job source (some sources more likely to ghost)
   - Consider application date vs email activity
   - ML-based prediction of "dead" applications

4. **Undo Feature**
   - Allow users to un-archive jobs
   - Show "Recently archived" section

## Questions to Resolve

1. ✅ Should we archive jobs that never had email activity? → **No**
2. ✅ Should OFFER status be excluded? → **Yes**
3. ✅ How long to wait after manual update? → **7 days**
4. ⏳ Should this be user-configurable? → **Future enhancement**
5. ⏳ Should we notify users? → **Future enhancement**
