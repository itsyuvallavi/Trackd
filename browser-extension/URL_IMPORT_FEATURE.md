# URL Import Feature - RESTORED! ✅

## 🎯 What It Does

Paste any job URL and the extension will:
1. **Fetch the page** via API
2. **Extract job data** (title, company, location, salary)
3. **Pre-fill the form** with extracted data
4. **Let you review/edit** before saving

## 🔧 How to Use

### From "No Job Detected" View:

1. **Paste URL** in the input field
2. **Click "Import from URL"**
3. **Wait for extraction** (shows spinner)
4. **Review data** in the form
5. **Edit if needed**
6. **Click "Save to Trackd"**

### Example URLs:
```
✅ https://linkedin.com/jobs/view/123456789
✅ https://indeed.com/viewjob?jk=abc123
✅ https://jobs.lever.co/company/job-id
✅ https://boards.greenhouse.io/company/jobs/123
✅ https://apply.workable.com/company/j/job-id
✅ https://euremotejobs.com/job/job-slug
```

## 🎨 UI Flow

```
No job detected
├─ List of supported sites
└─ Or import from URL:
   ├─ [URL input field]
   └─ [Import from URL] ← Click here!
   
   ↓ (Extracting...)
   
Job form with extracted data
├─ Company: ✅ Pre-filled
├─ Title: ✅ Pre-filled  
├─ Location: ✅ Pre-filled
├─ Salary: ✅ Pre-filled
└─ [Save to Trackd]
```

## ⚡ Features

- **Smart extraction**: Adapts to different job boards
- **Fast**: Usually takes 1-3 seconds
- **Editable**: Review and fix any fields
- **Authenticated**: Uses your extension key
- **Fallback**: If extraction fails, you can still fill manually

## 🔐 How It Works

1. **Extension sends URL** to `/api/scrape-job`
2. **API fetches the page** (server-side)
3. **Extracts data** using regex + HTML parsing
4. **Returns JSON** with job data
5. **Extension populates form**

## 🎯 When to Use

### Perfect for:
- Application pages (like Workable forms)
- Pages where auto-detection fails
- Sharing job links with yourself
- Saving jobs from email/Slack links

### Example Scenario:
```
❌ On Workable application page
   → Can't auto-extract (it's a form, not a listing)
   
✅ Copy the URL
   → Paste in extension
   → Click "Import from URL"
   → Data extracted from the original job page!
```

## 🚀 Supported Extraction

- **Title**: H1, meta tags, JSON-LD
- **Company**: Meta tags, text patterns
- **Location**: City/State patterns, Remote/Hybrid
- **Salary**: Dollar ranges ($X - $Y)
- **Source**: Detected from hostname

## ⚠️ Limitations

- Requires public URL (no login-required pages)
- Some JavaScript-heavy sites may not work
- Quality depends on page HTML structure
- Rate limited to prevent abuse

## 💡 Pro Tips

1. **Use the actual job listing URL**, not the application form
2. **Try again if it fails** - some pages load slowly
3. **Edit the data** - extraction isn't 100% perfect
4. **Save the URL** - it's automatically included

## 🎉 You Asked, We Delivered!

URL import is back and better than ever. No more manual entry - just paste and go! 🚀
