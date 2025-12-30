# GitHub Actions Setup for Auto-Sync

## Secrets to Configure

You need to set **2 secrets** in GitHub Actions:

### 1. APP_URL

**What to use:**
- ✅ **Your Vercel production URL** (e.g., `https://your-app.vercel.app`)
- ❌ NOT `localhost:3000` (GitHub Actions can't access your local machine)
- ❌ NOT your local development URL

**How to find your Vercel URL:**
1. Go to your Vercel dashboard
2. Select your project
3. Your production URL will be displayed (usually `https://your-project-name.vercel.app`)
4. Or check your custom domain if you've set one up

**Example:**
```
https://my-job-tracker.vercel.app
```

### 2. CRON_SECRET

**What to use:**
- Generate a **random secure string** (not the same as other secrets)
- Use a password generator or run: `openssl rand -hex 32`
- Or use a UUID generator

**Important:**
- This should be the **same value** in both places:
  1. GitHub Secrets (for GitHub Actions to authenticate)
  2. Vercel Environment Variables (for your app to accept the request)

**Example:**
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

## Step-by-Step Setup

### Step 1: Generate CRON_SECRET

Run this command to generate a secure random secret:
```bash
openssl rand -hex 32
```

Or use an online UUID generator: https://www.uuidgenerator.net/

**Copy this value** - you'll need it in two places.

### Step 2: Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add both secrets:

   **Secret 1:**
   - Name: `APP_URL`
   - Value: `https://your-project-name.vercel.app` (your actual Vercel URL)

   **Secret 2:**
   - Name: `CRON_SECRET`
   - Value: `paste-your-generated-secret-here`

### Step 3: Add to Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add:
   - Key: `CRON_SECRET`
   - Value: `same-secret-value-from-step-1`
   - Environments: Select **Production** (and optionally Preview/Development)
3. Click **Save**
4. **Redeploy** your app for the env var to take effect

### Step 4: Verify GitHub Actions is Enabled

1. Go to GitHub → **Settings** → **Actions** → **General**
2. Under "Actions permissions", ensure **"Allow all actions and reusable workflows"** is selected
3. Save changes

### Step 5: Test the Workflow

1. Go to GitHub → **Actions** tab
2. Select **"Sync Emails Hourly"** workflow
3. Click **"Run workflow"** → **"Run workflow"** (manual trigger)
4. Check the logs to see if it succeeds

## Verify It's Working

After setup, wait for the next scheduled run (or trigger manually), then check:

```bash
bun run scripts/check-sync-status.ts
```

You should see:
- ✅ Sync logs with `source: 'cron'`
- ✅ Recent sync timestamps
- ✅ `nextSyncAt` being updated

## Troubleshooting

### "Unauthorized" error in workflow logs
- ✅ Check that `CRON_SECRET` matches exactly in both GitHub and Vercel
- ✅ Ensure no extra spaces or newlines
- ✅ Make sure you redeployed Vercel after adding the env var

### "Connection refused" or timeout
- ✅ Verify `APP_URL` is correct (your Vercel URL)
- ✅ Make sure your Vercel deployment is live and accessible
- ✅ Test the URL in a browser to confirm it's working

### Workflow not running
- ✅ Check GitHub Actions is enabled in repo settings
- ✅ Verify the workflow file is committed to the default branch (usually `main`)
- ✅ Check workflow permissions in GitHub Settings → Actions → General

## Note About .env Files

- `.env.local` is only for **local development**
- GitHub Actions **cannot access** your local `.env` files
- You must add secrets to GitHub's secret store
- Vercel needs the env var in its dashboard (separate from local .env)
