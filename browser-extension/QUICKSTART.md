# Extension Quick Start

Get the Trackd extension running in 5 minutes!

## Step 1: Configure API URL (1 min)

Edit `browser-extension/scripts/popup.js`:

```javascript
// Line 4 - Change this based on your environment:
const API_URL = 'http://localhost:3000'  // For local development
// or
const API_URL = 'https://trackd.app'     // For production
```

## Step 2: Install Extension (1 min)

1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select folder: `/Users/yuval/TsCode/bun-test/my-app/browser-extension`
5. Extension appears in toolbar! 📌

## Step 3: Start Your App (1 min)

```bash
cd my-app
bun run dev
```

Open: http://localhost:3000

## Step 4: Generate Extension Key (1 min)

1. Navigate to: http://localhost:3000/settings/integrations
2. Scroll to "Chrome Extension" section
3. Click "Generate Extension Key"
4. Click "Copy" button (copies to clipboard)

## Step 5: Connect Extension (1 min)

1. Click the Trackd extension icon in Chrome toolbar
2. Paste the key in the input field
3. Click "Connect"
4. Should see "✓ Connected as [your-email]"

## Step 6: Test It! (30 seconds)

1. Go to a LinkedIn job: https://www.linkedin.com/jobs/search/
2. Click any job posting
3. Click Trackd extension icon
4. Should see extracted job data
5. Click "Save to Trackd"
6. Success! 🎉

## Verify

Go back to http://localhost:3000/jobs - you should see the saved job!

## Troubleshooting

**Extension not working?**
- Check browser console (F12)
- Reload extension in `chrome://extensions/`
- Verify API_URL matches your running server

**Can't connect?**
- Make sure dev server is running (`bun run dev`)
- Check key was copied correctly (starts with `tk_`)
- Try generating a new key

**No job detected?**
- Make sure you're on a job posting page (not search results)
- Try LinkedIn or Indeed first
- Some sites may not be supported yet

## What's Next?

- See `README.md` for full documentation
- See `TESTING.md` for comprehensive test suite
- See `IMPLEMENTATION_SUMMARY.md` for technical details

Happy job tracking! 🚀
