# Auto-Sync Troubleshooting Guide

## Current Status

Based on diagnostic check:
- ✅ Auto-sync is **enabled** in your email integration
- ✅ Integration is **active**
- ⚠️  Next sync is **overdue** (111+ minutes)
- ❌ **No cron-triggered syncs** found in logs (only manual syncs)

## Problem Diagnosis

The auto-sync is configured correctly in the database, but the cron job that triggers it is not running.

## Solution: Verify GitHub Actions Workflow

The auto-sync relies on a GitHub Actions workflow that runs every hour. Here's how to verify and fix it:

### Step 1: Check if Workflow File Exists

The workflow file should be at:
```
.github/workflows/sync-emails.yml
```

### Step 2: Verify GitHub Secrets

The workflow requires two secrets to be configured in your GitHub repository:

1. **APP_URL** - Your production app URL (e.g., `https://your-app.vercel.app`)
2. **CRON_SECRET** - A secret token that matches your `CRON_SECRET` environment variable

**To set secrets:**
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add both `APP_URL` and `CRON_SECRET`

### Step 3: Check Workflow Runs

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Look for "Sync Emails Hourly" workflow
4. Check if it has run recently and if there are any errors

### Step 4: Ensure Workflow is Enabled

GitHub Actions must be enabled for the repository:
1. Go to **Settings** → **Actions** → **General**
2. Ensure "Allow all actions and reusable workflows" is selected
3. Save changes

### Step 5: Verify Environment Variable

In your production environment (Vercel/similar), ensure `CRON_SECRET` is set:
- It should match the secret value in GitHub Actions
- Without this, the API endpoint will reject the cron requests

## Alternative: Test the Endpoint Manually

You can test if the endpoint works by manually triggering it:

```bash
curl -X GET "https://your-app.vercel.app/api/cron/sync-emails" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

If this works, the issue is that GitHub Actions isn't calling it.

## Current Workflow Configuration

The workflow is configured to run:
- **Schedule:** Every hour (`0 * * * *`)
- **Also:** Can be manually triggered via "workflow_dispatch"

```yaml
name: Sync Emails Hourly

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger email sync
        run: |
          curl -X GET "${{ secrets.APP_URL }}/api/cron/sync-emails" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Quick Fix: Manual Trigger

If you want to test immediately:
1. Go to GitHub → Actions → "Sync Emails Hourly"
2. Click "Run workflow" → "Run workflow"
3. This will trigger a sync immediately

## Long-term Solution

Once the GitHub Actions workflow is properly configured and running:
- It will call `/api/cron/sync-emails` every hour
- The endpoint will check all integrations with `autoSyncEnabled: true`
- It will sync integrations that have passed their `nextSyncAt` time
- Sync logs will show `source: 'cron'` instead of `source: 'manual'`

## Run Diagnostic Script

To check current status anytime:
```bash
bun run scripts/check-sync-status.ts
```

This will show:
- All integrations and their sync status
- Recent sync logs
- Whether integrations are overdue
- Next sync times
