# Manual Entry Feature

## ✅ Added Back

The manual entry button has been restored to the "No job detected" view.

## 🎯 When to Use

### Use Manual Entry When:
1. **On application pages** (like the Workable form you saw)
   - Application forms ≠ Job listings
   - Extension can't extract from forms
   
2. **Job board not supported**
   - Small company career pages
   - Regional job boards
   - PDF job postings
   
3. **Extraction fails**
   - Page structure changed
   - JavaScript-heavy sites
   - Protected/login-required pages

## 🔧 How It Works

**When you click "Enter Job Manually":**
1. Shows the job form with empty fields
2. Pre-fills the URL (current page)
3. You fill in: Company, Title, Location, Salary
4. Click "Save to Trackd"
5. Done! ✅

## 📍 Example: Workable Application Pages

The page you showed is:
```
jobs.workable.com/frontend → Application form
```

**To save this job:**
1. Go back to the job listing page (before clicking "Apply")
2. Click extension to extract automatically
   
**OR**

1. Click extension on application page
2. Click "Enter Job Manually"
3. Fill in the job details you remember
4. Save!

## 🎨 UI Location

```
No job detected
- List of supported sites
- "Then click this extension"

───────────────────────────
Or enter job details manually:
[Enter Job Manually] ← NEW!
```

## 💡 Tips

- The URL is automatically captured
- Source shows as "Manual Entry"
- You can edit any field before saving
- Company and Title are required

## 🚀 Next Steps

If you want automatic extraction from Workable job pages:
1. Make sure you're on the **job listing** page
2. Not the **application form** page
3. Extension will auto-extract company, title, location, salary

The manual entry is your safety net for when auto-extraction isn't available! 🎉
