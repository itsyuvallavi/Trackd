# Extension Extractor Improvement Plan

## Problem Summary

The current job data extraction system has significant issues:

### 1. Massive Code Duplication (~600 lines)
- `content.js` (447 lines) and `popup.js` (1006 lines) both contain nearly identical `extractJobData()` functions
- LinkedIn extraction alone is ~340 lines duplicated across both files
- Any fix or improvement must be applied twice

### 2. Fragile CSS Selector Approach
- LinkedIn has 40+ CSS selectors that break when the site changes layouts
- Sites like LinkedIn use obfuscated/dynamic class names that change frequently
- Different page layouts (logged in vs. logged out, mobile vs. desktop) use different structures

### 3. Unreliable Heuristics
- Fallback logic uses font size, position, and text patterns
- Often grabs random text like navigation items, ads, or unrelated content
- No semantic understanding of what constitutes job data

### 4. Poor International Support
- Location patterns are US-centric (City, ST format)
- International cities with special characters may not match patterns

---

## Proposed Solution: Hybrid Extraction with AI Fallback

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Job Page HTML                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 1: Structured Data (Fast)                │
│  - JSON-LD schema.org/JobPosting                            │
│  - OpenGraph meta tags                                      │
│  - Microdata attributes                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    (if incomplete)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 2: Site-Specific Rules (Fast)            │
│  - Minimal, maintained selectors per site                   │
│  - Only for reliable, stable elements                       │
│  - LinkedIn, Indeed, Greenhouse, Lever                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    (if incomplete)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 3: AI Extraction (Haiku API)             │
│  - Send cleaned HTML to Claude Haiku                        │
│  - Structured JSON output                                   │
│  - Handles any site layout intelligently                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Extracted Job Data                       │
│  { title, company, location, salary, description }          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Consolidate Extraction Logic (Remove Duplication)

**Goal**: Single source of truth for extraction logic

#### Changes:
1. Create `browser-extension/scripts/extractor.js` - shared extraction module
2. Remove duplicate `extractJobData()` from `popup.js`
3. Have `content.js` use the shared module
4. `popup.js` calls content script via message passing (already works)

**New File Structure:**
```
browser-extension/
├── scripts/
│   ├── extractor.js      # NEW: Shared extraction logic (~200 lines)
│   ├── content.js        # Simplified: Just message handler + calls extractor
│   ├── popup.js          # Simplified: Remove extractJobData, use content script only
│   └── background.js     # Optional: For API calls
├── popup.html
└── manifest.json
```

**Estimated reduction**: 600+ lines removed, single extraction function to maintain

---

### Phase 2: Refactor Extraction Layers

**Goal**: Clean, layered extraction approach

#### Layer 1: Structured Data Extraction
```javascript
function extractFromStructuredData() {
  // JSON-LD (most reliable when present)
  const jsonLd = document.querySelector('script[type="application/ld+json"]')
  if (jsonLd) {
    const data = parseJobPostingSchema(jsonLd.textContent)
    if (data.title && data.company) return data
  }

  // OpenGraph meta tags
  const ogData = extractOpenGraph()
  if (ogData.title) return ogData

  // Microdata
  const microdata = extractMicrodata()
  if (microdata.title) return microdata

  return null
}
```

#### Layer 2: Site-Specific Rules (Minimal)
```javascript
const SITE_RULES = {
  'linkedin.com': {
    // Only stable, semantic selectors - not class-based
    title: ['h1', '[data-job-title]'],
    company: ['a[href*="/company/"]'],
    // Fallback to page title parsing
    titleFromPageTitle: (title) => title.split('|')[0].trim()
  },
  'indeed.com': {
    title: ['h1.jobsearch-JobInfoHeader-title', '[data-testid="job-title"]'],
    company: ['[data-company-name="true"]', '[data-testid="company-name"]'],
    location: ['[data-testid="job-location"]']
  },
  // ... other sites
}
```

#### Layer 3: AI Extraction (Haiku)
```javascript
async function extractWithAI(html, url) {
  // Clean HTML - remove scripts, styles, nav, footer
  const cleanedHtml = cleanHtmlForAI(html)

  // Call backend API that uses Haiku
  const response = await fetch(`${API_URL}/api/extract-job-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: cleanedHtml.substring(0, 15000), // Limit size
      url
    })
  })

  return response.json()
}
```

---

### Phase 3: Add AI Extraction Endpoint

**Goal**: Backend endpoint that uses Claude Haiku for intelligent extraction

#### New API Endpoint: `POST /api/extract-job-ai`

```typescript
// src/app/api/extract-job-ai/route.ts

import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const { html, url } = await request.json()

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Extract job posting information from this HTML. Return JSON only.

URL: ${url}

HTML:
${html}

Return this exact JSON structure (use null for missing fields):
{
  "title": "job title",
  "company": "company name",
  "location": "location",
  "salary": "salary if shown",
  "description": "first 500 chars of job description"
}`
    }]
  })

  // Parse Haiku's response
  const text = message.content[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)

  if (jsonMatch) {
    return Response.json(JSON.parse(jsonMatch[0]))
  }

  return Response.json({ error: 'Could not extract' }, { status: 400 })
}
```

**Cost Estimate:**
- Haiku: $0.25/million input tokens, $1.25/million output tokens
- Average job page HTML (cleaned): ~10K tokens
- Cost per extraction: ~$0.003 (0.3 cents)
- 1000 extractions: ~$3

---

### Phase 4: Smart Extraction Flow

**Goal**: Only use AI when necessary (cost optimization)

```javascript
async function extractJobData() {
  const url = window.location.href

  // Layer 1: Try structured data first (free, fast)
  let data = extractFromStructuredData()
  if (isComplete(data)) {
    return { ...data, source: 'structured', confidence: 'high' }
  }

  // Layer 2: Try site-specific rules (free, fast)
  data = extractFromSiteRules(url, data)
  if (isComplete(data)) {
    return { ...data, source: 'rules', confidence: 'medium' }
  }

  // Layer 3: AI extraction (costs money, but accurate)
  // Only if we have at least partial data or user explicitly requests
  if (data.title || data.company || shouldUseAI(url)) {
    const aiData = await extractWithAI(document.body.innerHTML, url)
    return {
      ...data,
      ...aiData, // AI fills in gaps
      source: 'ai',
      confidence: 'high'
    }
  }

  // Return partial data with low confidence
  return { ...data, source: 'heuristic', confidence: 'low' }
}

function isComplete(data) {
  return data?.title && data?.company
}
```

---

## UI Improvements

### Show Extraction Confidence
```
┌────────────────────────────────────┐
│  ✓ Connected as yuval@...          │
├────────────────────────────────────┤
│                                    │
│  Company                           │
│  ┌──────────────────────────────┐  │
│  │ Google              ✓ High   │  │  ← Confidence indicator
│  └──────────────────────────────┘  │
│                                    │
│  Position                          │
│  ┌──────────────────────────────┐  │
│  │ Senior Engineer     ⚠ Low    │  │  ← Warns user to verify
│  └──────────────────────────────┘  │
│                                    │
│  [🤖 Re-extract with AI]           │  ← Manual AI trigger
│                                    │
└────────────────────────────────────┘
```

### "Re-extract with AI" Button
- Only shown when confidence is low
- Explicitly uses AI to re-analyze the page
- User understands this is a "smart" extraction

---

## Implementation Checklist

### Phase 1: Remove Duplication
- [ ] Create `browser-extension/scripts/extractor.js` with shared extraction logic
- [ ] Move `extractJobData()` from `content.js` to `extractor.js`
- [ ] Update `content.js` to import and use `extractor.js`
- [ ] Remove `extractJobData()` from `popup.js` (lines 247-818)
- [ ] Update `popup.js` to use content script messaging only
- [ ] Update `manifest.json` to include `extractor.js` in content scripts
- [ ] Test: Verify extraction still works on LinkedIn, Indeed, Greenhouse, Lever

### Phase 2: Refactor Extraction Layers
- [ ] Implement `extractFromStructuredData()` - JSON-LD, OpenGraph, Microdata
- [ ] Create `SITE_RULES` config object for site-specific selectors
- [ ] Implement `extractFromSiteRules()` using config
- [ ] Add `cleanHtmlForAI()` function - strips scripts, styles, nav, footer
- [ ] Implement layered extraction flow with confidence scoring
- [ ] Test: Verify each layer works independently

### Phase 3: AI Extraction Endpoint
- [ ] Add `@anthropic-ai/sdk` to dependencies: `bun add @anthropic-ai/sdk`
- [ ] Create `src/app/api/extract-job-ai/route.ts`
- [ ] Implement Haiku extraction with structured JSON output
- [ ] Add rate limiting (10 requests/minute per user)
- [ ] Add error handling for API failures
- [ ] Test: Verify AI extraction works on various job sites

### Phase 4: Integration & UI
- [ ] Add `extractWithAI()` function in extension
- [ ] Implement smart extraction flow (layers 1→2→3)
- [ ] Add confidence indicator to popup UI
- [ ] Add "Re-extract with AI" button
- [ ] Add loading state for AI extraction
- [ ] Test: Full flow on 10+ different job sites

### Phase 5: Testing & Polish
- [ ] Test on LinkedIn (multiple layouts)
- [ ] Test on Indeed
- [ ] Test on Greenhouse
- [ ] Test on Lever
- [ ] Test on random company career pages
- [ ] Test on international job sites
- [ ] Measure AI extraction accuracy
- [ ] Monitor costs

---

## Success Metrics

1. **Accuracy**: 95%+ correct extraction on supported sites
2. **Coverage**: Works on any job posting page (via AI fallback)
3. **Speed**: <500ms for rule-based, <3s for AI extraction
4. **Cost**: <$0.01 per AI extraction
5. **Code quality**: Single extraction codebase, <300 lines total

---

## Future Improvements

- [ ] Cache AI extractions by URL hash (avoid re-extracting same page)
- [ ] Learn from user corrections (if user edits a field, remember for that site)
- [ ] Browser extension settings to enable/disable AI extraction
- [ ] Batch extraction for job search results pages
