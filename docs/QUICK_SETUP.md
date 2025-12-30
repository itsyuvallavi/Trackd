# Quick Setup Guide for Auto-Sync

## Step 1: Generate CRON_SECRET

Run this command:
```bash
openssl rand -hex 32
```

**Or use the script:**
```bash
bun run scripts/generate-cron-secret.sh
```

**Copy the generated value** - you'll need it in two places below.

## Step 2: Add GitHub Secrets

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`
2. Click **"New repository secret"**
3. Add these two secrets:

   **Secret 1:**
   - Name: `APP_URL`
   - Value: `https://your-project.vercel.app` (replace with your actual Vercel URL)

   **Secret 2:**
   - Name: `CRON_SECRET`
   - Value: `paste-the-secret-from-step-1`

## Step 3: Add to Vercel

1. Go to: Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Click **"Add New"**
3. Add:
   - Key: `CRON_SECRET`
   - Value: `same-secret-from-step-1` (must match GitHub secret exactly)
   - Environments: Select **Production** ✅
4. Click **Save**
5. **Important:** Redeploy your app for the env var to take effect

## Step 4: Find Your Vercel URL

To find your Vercel production URL:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click your project
3. Your URL is shown at the top (e.g., `https://my-app-xyz.vercel.app`)

If you have a custom domain, you can use that instead.

## Step 5: Test It

1. Go to GitHub → **Actions** tab
2. Select **"Sync Emails Hourly"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Check the logs - should see success ✅

## Common Mistakes to Avoid

❌ **Don't use `localhost:3000`** - GitHub Actions can't access your local machine  
❌ **Don't reuse other secrets** - Generate a fresh CRON_SECRET  
❌ **Don't forget to redeploy Vercel** - After adding env vars, redeploy  
❌ **Don't use different values** - CRON_SECRET must match exactly in GitHub and Vercel  

## Verify It's Working

After the workflow runs, check your sync status:
```bash
bun run scripts/check-sync-status.ts
```

Look for sync logs with `source: 'cron'` ✅
