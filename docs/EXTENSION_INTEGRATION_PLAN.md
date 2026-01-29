# Chrome Extension Integration Plan

## Overview

Simple, secure integration between the Trackd Chrome extension and web app using API keys.

---

## User Journey

### First-Time Setup (~30 seconds)

```
1. Install extension from Chrome Web Store
2. Open Trackd web app → Settings → Integrations
3. Click "Generate Extension Key" → Copy the key
4. Open extension → Paste key → Connected!
```

### Daily Use (~5 seconds per job)

```
1. Browse to any job posting (LinkedIn, Indeed, Greenhouse, etc.)
2. Click Trackd extension icon
3. Review/edit extracted job data
4. Click "Save to Trackd"
5. Refresh Trackd to see job in your dashboard
```

---

## Extension Popup States

### State 1: Not Connected

```
┌────────────────────────────────┐
│  🔗 Connect to Trackd          │
│                                │
│  Paste your extension key:     │
│  ┌──────────────────────────┐  │
│  │ tk_                      │  │
│  └──────────────────────────┘  │
│                                │
│  [Connect]                     │
│                                │
│  ────────────────────────────  │
│  Don't have a key?             │
│  Get one at trackd.app/settings│
└────────────────────────────────┘
```

### State 2: Connected + Job Detected

```
┌────────────────────────────────┐
│  ✓ Connected as yuval@...      │
├────────────────────────────────┤
│                                │
│  Company                       │
│  ┌──────────────────────────┐  │
│  │ Google                   │  │
│  └──────────────────────────┘  │
│                                │
│  Position                      │
│  ┌──────────────────────────┐  │
│  │ Senior Software Engineer │  │
│  └──────────────────────────┘  │
│                                │
│  Location                      │
│  ┌──────────────────────────┐  │
│  │ Mountain View, CA        │  │
│  └──────────────────────────┘  │
│                                │
│  Salary (if found)             │
│  ┌──────────────────────────┐  │
│  │ $180,000 - $250,000      │  │
│  └──────────────────────────┘  │
│                                │
│  Source: LinkedIn              │
│                                │
│  [Save to Trackd]              │
│                                │
├────────────────────────────────┤
│  ⚙️ Settings    🔓 Disconnect   │
└────────────────────────────────┘
```

### State 3: Job Saved Successfully

```
┌────────────────────────────────┐
│                                │
│         ✅ Job Saved!          │
│                                │
│  Google                        │
│  Senior Software Engineer      │
│                                │
│  [View in Trackd] [Save Another]│
│                                │
└────────────────────────────────┘
```

### State 4: Duplicate Detected

```
┌────────────────────────────────┐
│                                │
│    ⚠️ Already Saved            │
│                                │
│  You saved this job on         │
│  Dec 15, 2025                  │
│                                │
│  [View Existing] [Close]       │
│                                │
└────────────────────────────────┘
```

### State 5: No Job Detected

```
┌────────────────────────────────┐
│  ✓ Connected as yuval@...      │
├────────────────────────────────┤
│                                │
│  🔍 No job detected            │
│                                │
│  Navigate to a job posting on: │
│  • LinkedIn                    │
│  • Indeed                      │
│  • Greenhouse                  │
│  • Lever                       │
│  • Company career pages        │
│                                │
│  Then click this extension     │
│  to save the job.              │
│                                │
└────────────────────────────────┘
```

---

## Technical Implementation

### 1. Database Model

Add to `prisma/schema.prisma`:

```prisma
model ExtensionKey {
  id          String    @id @default(cuid())
  userId      String    @unique  // One active key per user (matches Profile.id / Supabase auth.users.id)
  keyHash     String    @unique  // SHA-256 hash for lookup
  keyPrefix   String    // "tk_a1b2c3" - visible in UI for identification
  createdAt   DateTime  @default(now())
  lastUsedAt  DateTime?

  @@index([keyHash])
  @@index([userId])
}
```

**Note:** We don't add a relation to Profile to avoid circular dependencies. The `userId` field directly references the Supabase auth user ID (same as `Profile.id`).

### 2. API Endpoints

#### POST /api/extension/generate-key

Called from web app to create/regenerate extension key.

```typescript
// src/app/api/extension/generate-key/route.ts

import { nanoid } from 'nanoid'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

export async function POST() {
  const user = await requireAuth() // Get authenticated user from Supabase
  const userId = user.id

  // Generate new key: tk_ + 32 random chars
  const key = `tk_${nanoid(32)}`
  const keyHash = createHash('sha256').update(key).digest('hex')
  const keyPrefix = key.slice(0, 10) // "tk_a1b2c3"

  // Delete existing key (if any) and create new one
  await prisma.$transaction([
    prisma.extensionKey.deleteMany({ where: { userId } }),
    prisma.extensionKey.create({
      data: { userId, keyHash, keyPrefix }
    })
  ])

  // Return plain key (only time it's ever shown)
  return Response.json({ key, keyPrefix })
}
```

#### POST /api/extension/validate-key

Called by extension to verify key and get user info.

```typescript
// src/app/api/extension/validate-key/route.ts

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const { key } = await request.json()

  if (!key?.startsWith('tk_')) {
    return Response.json({ error: 'Invalid key format' }, { status: 400 })
  }

  const keyHash = createHash('sha256').update(key).digest('hex')

  const extensionKey = await prisma.extensionKey.findUnique({
    where: { keyHash }
  })

  if (!extensionKey) {
    return Response.json({ error: 'Invalid key' }, { status: 401 })
  }

  // Get user email from Profile table
  const profile = await prisma.profile.findUnique({
    where: { id: extensionKey.userId },
    select: { email: true }
  })

  if (!profile) {
    return Response.json({ error: 'User not found' }, { status: 401 })
  }

  // Update last used
  await prisma.extensionKey.update({
    where: { id: extensionKey.id },
    data: { lastUsedAt: new Date() }
  })

  return Response.json({
    valid: true,
    email: profile.email
  })
}
```

#### POST /api/extension/save-job

Called by extension to save a job.

```typescript
// src/app/api/extension/save-job/route.ts

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { JobSource, JobStatus, ActivityType } from '@prisma/client'
import { revalidatePath } from 'next/cache'

export async function POST(request: Request) {
  // Authenticate via extension key
  const key = request.headers.get('X-Extension-Key')

  if (!key) {
    return Response.json({ error: 'Missing extension key' }, { status: 401 })
  }

  const keyHash = createHash('sha256').update(key).digest('hex')
  const extensionKey = await prisma.extensionKey.findUnique({
    where: { keyHash }
  })

  if (!extensionKey) {
    return Response.json({ error: 'Invalid extension key' }, { status: 401 })
  }

  const userId = extensionKey.userId
  const jobData = await request.json()

  // Check for duplicates (same company + title within 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const duplicate = await prisma.job.findFirst({
    where: {
      userId,
      company: { equals: jobData.company, mode: 'insensitive' },
      title: { equals: jobData.title, mode: 'insensitive' },
      createdAt: { gte: thirtyDaysAgo }
    }
  })

  if (duplicate) {
    return Response.json({
      error: 'DUPLICATE_JOB',
      message: 'You already saved this job',
      existingJob: {
        id: duplicate.id,
        savedAt: duplicate.createdAt
      }
    }, { status: 409 })
  }

  // Map source string to JobSource enum
  const sourceMap: Record<string, JobSource> = {
    'LinkedIn': JobSource.LINKEDIN,
    'Indeed': JobSource.INDEED,
    'Greenhouse': JobSource.COMPANY_SITE,
    'Lever': JobSource.COMPANY_SITE,
    'Extension': JobSource.OTHER,
  }
  const source = sourceMap[jobData.source] || JobSource.OTHER

  // Create the job
  const job = await prisma.job.create({
    data: {
      userId,
      company: jobData.company,
      title: jobData.title,
      location: jobData.location || null,
      url: jobData.url || null,
      source,
      salary: jobData.salary || null,
      status: JobStatus.SAVED,
    }
  })

  // Create activity
  await prisma.activity.create({
    data: {
      jobId: job.id,
      userId,
      type: ActivityType.STATUS_CHANGE,
      toStatus: JobStatus.SAVED,
      description: `Job saved via Chrome extension from ${jobData.source || 'unknown source'}`
    }
  })

  // Update key last used
  await prisma.extensionKey.update({
    where: { id: extensionKey.id },
    data: { lastUsedAt: new Date() }
  })

  // Revalidate cache (Note: this won't work in API routes, but included for consistency)
  // In practice, the frontend will refetch after successful save

  return Response.json({
    success: true,
    job: { id: job.id, company: job.company, title: job.title }
  })
}
```

#### GET /api/extension/check-duplicate

Optional: Pre-check before saving (better UX).

```typescript
// src/app/api/extension/check-duplicate/route.ts

export async function GET(request: Request) {
  const key = request.headers.get('X-Extension-Key')
  const url = new URL(request.url)
  const company = url.searchParams.get('company')
  const title = url.searchParams.get('title')

  // ... auth check ...

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const existing = await prisma.job.findFirst({
    where: {
      userId,
      company: { equals: company, mode: 'insensitive' },
      title: { equals: title, mode: 'insensitive' },
      createdAt: { gte: thirtyDaysAgo }
    },
    select: { id: true, createdAt: true }
  })

  return Response.json({
    isDuplicate: !!existing,
    existingJob: existing
  })
}
```

### 3. Web App UI

#### Location: Settings → Integrations Page

The extension key section should be added to `/settings/integrations` page, **below the Email Integration section**. This keeps all integrations in one place.

```tsx
// src/components/email/extension-key-section.tsx

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Eye, EyeOff, RefreshCw, Chrome } from 'lucide-react'

interface ExtensionKeyData {
  key: string | null
  keyPrefix: string | null
  lastUsedAt: string | null
}

export function ExtensionKeySection({ initialData }: { initialData: ExtensionKeyData }) {
  const [key, setKey] = useState<string | null>(null)
  const [keyPrefix, setKeyPrefix] = useState(initialData.keyPrefix)
  const [showKey, setShowKey] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateKey() {
    setIsGenerating(true)
    try {
      const res = await fetch('/api/extension/generate-key', { method: 'POST' })
      const data = await res.json()
      setKey(data.key)
      setKeyPrefix(data.keyPrefix)
      setShowKey(true)
    } finally {
      setIsGenerating(false)
    }
  }

  function copyKey() {
    if (key) {
      navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="border border-border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <Chrome className="size-6" />
        <h3 className="text-lg font-semibold">Chrome Extension</h3>
      </div>

      {!keyPrefix && !key ? (
        // No key exists
        <div>
          <p className="text-muted-foreground mb-4">
            Connect the Trackd Chrome extension to save jobs with one click.
          </p>
          <Button onClick={generateKey} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Extension Key'}
          </Button>
        </div>
      ) : (
        // Key exists
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground">Your Extension Key</label>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">
                {key && showKey ? key : `${keyPrefix}••••••••••••••••••••••`}
              </code>

              {key && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyKey}>
                    <Copy className="size-4" />
                    {copied && <span className="ml-1">Copied!</span>}
                  </Button>
                </>
              )}
            </div>
          </div>

          {initialData.lastUsedAt && (
            <p className="text-sm text-muted-foreground">
              Last used: {new Date(initialData.lastUsedAt).toLocaleDateString()}
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={generateKey} disabled={isGenerating}>
              <RefreshCw className="size-4 mr-2" />
              Regenerate Key
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Regenerating will disconnect any currently connected extensions.
          </p>
        </div>
      )}
    </div>
  )
}
```

### 4. Extension Code

#### popup.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 320px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #ededed;
    }
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid #262626;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .logo {
      font-weight: 600;
      font-size: 14px;
    }
    .status {
      font-size: 12px;
      color: #a3a3a3;
    }
    .status.connected { color: #10b981; }
    .content {
      padding: 16px;
    }
    .field {
      margin-bottom: 12px;
    }
    .field label {
      display: block;
      font-size: 12px;
      color: #a3a3a3;
      margin-bottom: 4px;
    }
    .field input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #262626;
      border-radius: 6px;
      background: #171717;
      color: #ededed;
      font-size: 14px;
    }
    .field input:focus {
      outline: none;
      border-color: #525252;
    }
    .btn {
      width: 100%;
      padding: 10px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary {
      background: #ededed;
      color: #0a0a0a;
    }
    .btn-primary:hover { background: #d4d4d4; }
    .btn-primary:disabled {
      background: #525252;
      color: #a3a3a3;
      cursor: not-allowed;
    }
    .footer {
      padding: 12px 16px;
      border-top: 1px solid #262626;
      display: flex;
      justify-content: space-between;
    }
    .footer button {
      background: none;
      border: none;
      color: #a3a3a3;
      font-size: 12px;
      cursor: pointer;
    }
    .footer button:hover { color: #ededed; }
    .message {
      padding: 12px;
      border-radius: 6px;
      text-align: center;
      margin-bottom: 12px;
    }
    .message.success { background: #10b98120; color: #10b981; }
    .message.error { background: #ef444420; color: #ef4444; }
    .message.warning { background: #f59e0b20; color: #f59e0b; }
    .source-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #262626;
      border-radius: 4px;
      font-size: 12px;
      color: #a3a3a3;
    }
    .help-text {
      font-size: 12px;
      color: #a3a3a3;
      margin-top: 8px;
    }
    .help-text a {
      color: #60a5fa;
      text-decoration: none;
    }
    .no-job {
      text-align: center;
      padding: 24px 16px;
      color: #a3a3a3;
    }
    .no-job h3 {
      color: #ededed;
      margin-bottom: 8px;
    }
    .no-job ul {
      text-align: left;
      margin: 12px 0;
      padding-left: 20px;
    }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">Trackd</span>
    <span id="connectionStatus" class="status">Not connected</span>
  </div>

  <!-- Connect Form -->
  <div id="connectView" class="content">
    <h3 style="margin-bottom: 12px;">Connect to Trackd</h3>
    <div class="field">
      <label>Extension Key</label>
      <input type="text" id="keyInput" placeholder="tk_..." />
    </div>
    <button id="connectBtn" class="btn btn-primary">Connect</button>
    <p class="help-text">
      Don't have a key? <a href="https://trackd.app/settings/integrations" target="_blank">Get one here</a>
    </p>
  </div>

  <!-- Job Form -->
  <div id="jobView" class="content hidden">
    <div id="messageBox" class="message hidden"></div>

    <div class="field">
      <label>Company</label>
      <input type="text" id="companyInput" />
    </div>
    <div class="field">
      <label>Position</label>
      <input type="text" id="titleInput" />
    </div>
    <div class="field">
      <label>Location</label>
      <input type="text" id="locationInput" />
    </div>
    <div class="field">
      <label>Salary (if found)</label>
      <input type="text" id="salaryInput" placeholder="e.g., $120k - $150k" />
    </div>
    <div style="margin-bottom: 12px;">
      <span class="source-badge" id="sourceLabel">Unknown</span>
    </div>
    <button id="saveBtn" class="btn btn-primary">Save to Trackd</button>
  </div>

  <!-- No Job Detected -->
  <div id="noJobView" class="content hidden">
    <div class="no-job">
      <h3>No job detected</h3>
      <p>Navigate to a job posting on:</p>
      <ul>
        <li>LinkedIn</li>
        <li>Indeed</li>
        <li>Greenhouse</li>
        <li>Lever</li>
        <li>Company career pages</li>
      </ul>
      <p>Then click this extension to save it.</p>
    </div>
  </div>

  <!-- Success View -->
  <div id="successView" class="content hidden">
    <div class="message success">
      <strong>Job Saved!</strong>
      <p id="savedJobInfo"></p>
    </div>
    <button id="viewInTrackdBtn" class="btn btn-primary" style="margin-bottom: 8px;">View in Trackd</button>
    <button id="saveAnotherBtn" class="btn" style="background: #262626; color: #ededed;">Save Another</button>
  </div>

  <!-- Footer (shown when connected) -->
  <div id="footer" class="footer hidden">
    <button id="settingsBtn">Settings</button>
    <button id="disconnectBtn">Disconnect</button>
  </div>

  <script src="scripts/popup.js"></script>
</body>
</html>
```

#### scripts/popup.js

```javascript
const API_URL = 'https://trackd.app' // Change for production

// DOM Elements
const connectView = document.getElementById('connectView')
const jobView = document.getElementById('jobView')
const noJobView = document.getElementById('noJobView')
const successView = document.getElementById('successView')
const footer = document.getElementById('footer')
const connectionStatus = document.getElementById('connectionStatus')
const messageBox = document.getElementById('messageBox')

// Inputs
const keyInput = document.getElementById('keyInput')
const companyInput = document.getElementById('companyInput')
const titleInput = document.getElementById('titleInput')
const locationInput = document.getElementById('locationInput')
const salaryInput = document.getElementById('salaryInput')
const sourceLabel = document.getElementById('sourceLabel')

// Buttons
const connectBtn = document.getElementById('connectBtn')
const saveBtn = document.getElementById('saveBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const viewInTrackdBtn = document.getElementById('viewInTrackdBtn')
const saveAnotherBtn = document.getElementById('saveAnotherBtn')

// State
let currentJobData = null
let savedJobId = null

// Initialize
document.addEventListener('DOMContentLoaded', init)

async function init() {
  const data = await chrome.storage.local.get(['extensionKey', 'userEmail'])

  if (data.extensionKey) {
    showConnectedState(data.userEmail)
    await loadJobData()
  } else {
    showConnectView()
  }
}

// Views
function showConnectView() {
  connectView.classList.remove('hidden')
  jobView.classList.add('hidden')
  noJobView.classList.add('hidden')
  successView.classList.add('hidden')
  footer.classList.add('hidden')
  connectionStatus.textContent = 'Not connected'
  connectionStatus.classList.remove('connected')
}

function showConnectedState(email) {
  connectionStatus.textContent = email ? `Connected as ${email}` : 'Connected'
  connectionStatus.classList.add('connected')
  footer.classList.remove('hidden')
}

function showJobView() {
  connectView.classList.add('hidden')
  jobView.classList.remove('hidden')
  noJobView.classList.add('hidden')
  successView.classList.add('hidden')
}

function showNoJobView() {
  connectView.classList.add('hidden')
  jobView.classList.add('hidden')
  noJobView.classList.remove('hidden')
  successView.classList.add('hidden')
}

function showSuccessView(company, title) {
  connectView.classList.add('hidden')
  jobView.classList.add('hidden')
  noJobView.classList.add('hidden')
  successView.classList.remove('hidden')
  document.getElementById('savedJobInfo').textContent = `${company} - ${title}`
}

function showMessage(type, text) {
  messageBox.className = `message ${type}`
  messageBox.textContent = text
  messageBox.classList.remove('hidden')
}

function hideMessage() {
  messageBox.classList.add('hidden')
}

// Connect
connectBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim()

  if (!key.startsWith('tk_')) {
    showMessage('error', 'Invalid key format')
    return
  }

  connectBtn.disabled = true
  connectBtn.textContent = 'Connecting...'

  try {
    const res = await fetch(`${API_URL}/api/extension/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    })

    if (res.ok) {
      const { email } = await res.json()
      await chrome.storage.local.set({ extensionKey: key, userEmail: email })
      showConnectedState(email)
      await loadJobData()
    } else {
      showMessage('error', 'Invalid key. Please check and try again.')
    }
  } catch (err) {
    showMessage('error', 'Connection failed. Please try again.')
  } finally {
    connectBtn.disabled = false
    connectBtn.textContent = 'Connect'
  }
})

// Disconnect
disconnectBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionKey', 'userEmail'])
  showConnectView()
  keyInput.value = ''
})

// Load job data from current tab
async function loadJobData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Execute content script to extract job data
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractJobData
    })

    const jobData = results[0]?.result

    if (jobData && jobData.title) {
      currentJobData = { ...jobData, url: tab.url }

      companyInput.value = jobData.company || ''
      titleInput.value = jobData.title || ''
      locationInput.value = jobData.location || ''
      salaryInput.value = jobData.salary || ''
      sourceLabel.textContent = jobData.source || 'Unknown'

      showJobView()
    } else {
      showNoJobView()
    }
  } catch (err) {
    console.error('Failed to extract job data:', err)
    showNoJobView()
  }
}

// Content script function (injected into page)
function extractJobData() {
  const url = window.location.href
  let source = 'Unknown'
  let company = ''
  let title = ''
  let location = ''
  let salary = ''

  // LinkedIn
  if (url.includes('linkedin.com')) {
    source = 'LinkedIn'
    company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim()
      || document.querySelector('.topcard__org-name-link')?.textContent?.trim()
      || ''
    title = document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim()
      || document.querySelector('.topcard__title')?.textContent?.trim()
      || ''
    location = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim()
      || document.querySelector('.topcard__flavor--bullet')?.textContent?.trim()
      || ''
    salary = document.querySelector('.salary-main-rail__data-body')?.textContent?.trim() || ''
  }

  // Indeed
  else if (url.includes('indeed.com')) {
    source = 'Indeed'
    company = document.querySelector('[data-company-name="true"]')?.textContent?.trim()
      || document.querySelector('.jobsearch-InlineCompanyRating-companyHeader')?.textContent?.trim()
      || ''
    title = document.querySelector('.jobsearch-JobInfoHeader-title')?.textContent?.trim()
      || document.querySelector('h1.icl-u-xs-mb--xs')?.textContent?.trim()
      || ''
    location = document.querySelector('[data-testid="job-location"]')?.textContent?.trim()
      || document.querySelector('.jobsearch-JobInfoHeader-subtitle > div:last-child')?.textContent?.trim()
      || ''
    salary = document.querySelector('#salaryInfoAndJobType')?.textContent?.trim() || ''
  }

  // Greenhouse
  else if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) {
    source = 'Greenhouse'
    company = document.querySelector('.company-name')?.textContent?.trim()
      || document.querySelector('[class*="company"]')?.textContent?.trim()
      || ''
    title = document.querySelector('.app-title')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim()
      || ''
    location = document.querySelector('.location')?.textContent?.trim() || ''
  }

  // Lever
  else if (url.includes('lever.co') || url.includes('jobs.lever.co')) {
    source = 'Lever'
    company = document.querySelector('.main-header-logo img')?.alt
      || document.querySelector('[class*="company"]')?.textContent?.trim()
      || ''
    title = document.querySelector('.posting-headline h2')?.textContent?.trim()
      || document.querySelector('h1')?.textContent?.trim()
      || ''
    location = document.querySelector('.posting-categories .location')?.textContent?.trim()
      || document.querySelector('.sort-by-time')?.textContent?.trim()
      || ''
  }

  // Generic fallback
  else {
    source = new URL(url).hostname.replace('www.', '')
    title = document.querySelector('h1')?.textContent?.trim() || ''
    company = document.querySelector('meta[property="og:site_name"]')?.content || ''
  }

  return { source, company, title, location, salary }
}

// Save job
saveBtn.addEventListener('click', async () => {
  const { extensionKey } = await chrome.storage.local.get('extensionKey')

  if (!extensionKey) {
    showConnectView()
    return
  }

  const jobData = {
    company: companyInput.value.trim(),
    title: titleInput.value.trim(),
    location: locationInput.value.trim(),
    salary: salaryInput.value.trim(),
    url: currentJobData?.url || '',
    source: currentJobData?.source || 'Extension'
  }

  if (!jobData.company || !jobData.title) {
    showMessage('error', 'Company and position are required')
    return
  }

  saveBtn.disabled = true
  saveBtn.textContent = 'Saving...'
  hideMessage()

  try {
    const res = await fetch(`${API_URL}/api/extension/save-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Key': extensionKey
      },
      body: JSON.stringify(jobData)
    })

    const data = await res.json()

    if (res.ok) {
      savedJobId = data.job.id
      showSuccessView(jobData.company, jobData.title)
    } else if (res.status === 409) {
      // Duplicate
      showMessage('warning', `Already saved on ${new Date(data.existingJob.savedAt).toLocaleDateString()}`)
      savedJobId = data.existingJob.id
    } else if (res.status === 401) {
      // Key invalid
      await chrome.storage.local.remove(['extensionKey', 'userEmail'])
      showConnectView()
      showMessage('error', 'Session expired. Please reconnect.')
    } else {
      showMessage('error', data.message || 'Failed to save job')
    }
  } catch (err) {
    showMessage('error', 'Network error. Please try again.')
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = 'Save to Trackd'
  }
})

// View in Trackd
viewInTrackdBtn.addEventListener('click', () => {
  const url = savedJobId
    ? `${API_URL}/jobs/${savedJobId}`
    : `${API_URL}/jobs`
  chrome.tabs.create({ url })
})

// Save another
saveAnotherBtn.addEventListener('click', () => {
  savedJobId = null
  loadJobData()
})
```

#### manifest.json

```json
{
  "manifest_version": 3,
  "name": "Trackd - Job Application Tracker",
  "version": "1.0.0",
  "description": "Save jobs to Trackd with one click",
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://linkedin.com/*",
    "https://www.indeed.com/*",
    "https://indeed.com/*",
    "https://*.greenhouse.io/*",
    "https://*.lever.co/*",
    "https://trackd.app/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

---

## Security Measures

### 1. Key Security

- **Format**: `tk_` prefix + 32 random characters (nanoid)
- **Storage**: Only SHA-256 hash stored in database (never store plain key)
- **One key per user**: Regenerating invalidates previous key (old extensions disconnect)
- **Prefix visible**: Users can identify their key without exposing it (e.g., "tk_a1b2c3••••••••")
- **Single display**: Full key shown only once when generated, then hidden by default

### 2. Rate Limiting

Add to save-job endpoint:
```typescript
// Max 10 jobs per minute per key
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000 // 1 minute

// Use Redis or in-memory store for production
```

### 3. CORS Configuration

**Important:** Since Chrome extensions use their own origin (`chrome-extension://...`), we need to allow CORS from extensions.

```typescript
// next.config.ts (or next.config.js)
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/api/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Allow Chrome extensions
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Extension-Key' },
        ],
      },
    ]
  },
}

export default nextConfig
```

**Note:** In production, you might want to restrict CORS to specific extension IDs for additional security, but `*` is necessary since extension IDs can change during development.

---

## Duplicate Detection Logic

```typescript
// A job is considered duplicate if:
// 1. Same company (case-insensitive)
// 2. Same title (case-insensitive)
// 3. Created within last 30 days

const isDuplicate = await prisma.job.findFirst({
  where: {
    userId,
    company: { equals: company, mode: 'insensitive' },
    title: { equals: title, mode: 'insensitive' },
    createdAt: { gte: subDays(new Date(), 30) }
  }
})
```

---

## Future Improvements (Post-MVP)

### Real-time Sync
- [ ] WebSocket connection for instant job updates
- [ ] Extension badge showing unseen jobs count

### Enhanced Detection
- [ ] Support more job boards (Workday, Taleo, etc.)
- [ ] AI-powered field extraction for unknown sites

### Quality of Life
- [ ] Keyboard shortcut to save (Cmd+Shift+S)
- [ ] Right-click context menu "Save to Trackd"
- [ ] Quick status update from extension

---

## Implementation Checklist

### Backend
- [x] Add `ExtensionKey` model to Prisma schema (use `userId` as String, matching Profile.id)
- [x] Run migration: `bunx prisma migrate dev --name add-extension-key`
- [x] Install dependencies: `bun add nanoid`
- [x] Create `/api/extension/generate-key` endpoint (GET & POST, use `requireAuth()`)
- [x] Create `/api/extension/validate-key` endpoint
- [x] Create `/api/extension/save-job` endpoint (use JobSource enum, handle source mapping)
- [x] Add CORS headers in `next.config.ts` for extension endpoints
- [x] Add duplicate detection logic (30-day window, case-insensitive)

### Web App
- [x] Create `src/components/email/extension-key-section.tsx` component
- [x] Add Extension section to `/settings/integrations` page (below email integration)
- [x] Fetch extension key data on page load (keyPrefix, lastUsedAt) - via GET endpoint
- [x] Add "Generate Key" functionality with copy-to-clipboard
- [x] Show connected status and last used time
- [x] Add visual indicator when key is generated (show full key once, then hide)
- [x] Add show/hide key toggle with eye icon
- [x] Add regenerate key functionality

### Extension
- [ ] Update `popup.html` with new UI (connection form, job form, states)
- [ ] Update `popup.js` with connection flow (validate key, store in chrome.storage.local)
- [ ] Update `popup.js` to include `X-Extension-Key` header in save-job requests
- [ ] Update `popup.js` with job extraction logic from content script
- [ ] Update `manifest.json` with proper permissions (add "scripting" if needed)
- [ ] Update `content.js` for job data extraction (LinkedIn, Indeed, etc.)
- [ ] Test on LinkedIn, Indeed, Greenhouse, Lever
- [ ] Add error handling and retry logic
- [ ] Handle duplicate job detection from API response

### Testing
- [ ] Generate key → copy → paste in extension → connected
- [ ] Save job from LinkedIn → appears in Trackd
- [ ] Save duplicate job → shows warning
- [ ] Regenerate key → old extension disconnected (key validation fails)
- [ ] Invalid key → proper error message
- [ ] Extension remembers connection after browser restart
