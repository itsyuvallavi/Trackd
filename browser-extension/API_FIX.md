# API Connection Fix

## Problem
Extension was trying to connect to `https://trackd.app` which returned HTML instead of JSON.

## Solution Applied

### 1. Updated API_URL to localhost ✅
**File**: `browser-extension/scripts/popup.js`

```javascript
// Changed from:
const API_URL = 'https://trackd.app'

// To:
const API_URL = 'http://localhost:3000'
```

### 2. Added localhost to host permissions ✅
**File**: `browser-extension/manifest.json`

Added `"http://localhost:3000/*"` to `host_permissions`

### 3. Added EU Remote Jobs source ✅
**File**: `src/app/api/extension/save-job/route.ts`

Added `'EU Remote Jobs': JobSource.OTHER` to source mapping

## How to Fix

### Step 1: Reload Extension
```
1. Open Chrome: chrome://extensions/
2. Find "Trackd - Job Application Tracker"
3. Click reload icon 🔄
```

### Step 2: Reconnect (if needed)
Since the API URL changed, you may need to:
1. Click extension icon
2. If it shows "Not connected", reconnect with your key
3. If already connected, try to save a job

### Step 3: Test
1. Go to any job posting (LinkedIn, Indeed, EU Remote Jobs)
2. Click extension
3. Fill in fields if needed
4. Click "Save to Trackd"
5. Should work! ✅

## Troubleshooting

### Still getting JSON error?

**Check console for the actual error:**
```
1. Click extension icon
2. Right-click in the popup → "Inspect"
3. Go to Console tab
4. Try to save a job
5. Look for the error message
```

**Common issues:**
- Dev server not running → Run `bun run dev` in my-app folder
- Wrong port → Check what port your server is on
- Not connected → Generate new extension key and reconnect

### Check your server is running:
```bash
cd my-app
bun run dev

# Should see:
# ▲ Next.js 14.x.x
# - Local: http://localhost:3000
```

### Check extension key is valid:
```
1. Go to http://localhost:3000/settings/integrations
2. You should see your extension key
3. If not, generate a new one
4. Reconnect extension with new key
```

## For Production Deployment

When you deploy to production:

1. Update API_URL:
```javascript
const API_URL = 'https://your-production-url.com'
```

2. Update manifest.json host_permissions:
```json
"host_permissions": [
  "https://your-production-url.com/*",
  // ... other permissions
]
```

3. Reload extension

## Current Configuration

✅ API URL: `http://localhost:3000`  
✅ Host permissions: localhost + job boards  
✅ Source mapping: Includes EU Remote Jobs  
✅ Dev server: Running on port 3000

You're all set! Try saving a job now. 🚀
