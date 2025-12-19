# Trackd Chrome Extension

Save job postings to Trackd with one click!

## Installation

### For Development

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `browser-extension` folder
5. The extension is now installed!

### For Production

1. Download the extension from Chrome Web Store (when published)
2. Click "Add to Chrome"

## First-Time Setup (~30 seconds)

1. Install the extension
2. Open [Trackd web app → Settings → Integrations](https://trackd.app/settings/integrations)
3. Click "Generate Extension Key" → Copy the key
4. Open the extension → Paste key → Click "Connect"
5. You're all set!

## Daily Use (~5 seconds per job)

1. Navigate to any job posting (LinkedIn, Indeed, Greenhouse, Lever, etc.)
2. Click the Trackd extension icon
3. Review/edit the extracted job data
4. Click "Save to Trackd"
5. Done! The job appears in your dashboard immediately

## Extension States

### 🔗 Not Connected
- First-time users will see a connection screen
- Paste your extension key from Trackd settings
- Click "Connect" to authenticate

### ✓ Connected + Job Detected
- Shows extracted job data (company, position, location, salary)
- Edit any fields before saving
- Click "Save to Trackd" to save the job

### 🔍 No Job Detected
- Appears when not on a recognized job posting page
- Navigate to a job board (LinkedIn, Indeed, etc.)
- Then click the extension again

### ✅ Job Saved Successfully
- Confirmation screen after saving
- "View in Trackd" - opens the job in Trackd
- "Save Another" - returns to extraction mode

### ⚠️ Duplicate Detected
- Shows when you try to save a job you've already saved
- Displays the date you originally saved it
- Prevents duplicate entries

## Supported Job Boards

The extension works on:
- ✅ **LinkedIn** - Full extraction support
- ✅ **Indeed** - Full extraction support
- ✅ **Greenhouse** - Company career pages
- ✅ **Lever** - Company career pages
- ✅ **Generic sites** - Best-effort extraction using structured data

## Configuration

### Changing API URL (for development)

Edit `scripts/popup.js` and change the `API_URL` constant:

```javascript
const API_URL = 'https://trackd.app' // Your production URL
// or
const API_URL = 'http://localhost:3000' // Local development
```

### Reconnecting

Click "🔓 Disconnect" in the extension footer, then reconnect with a new key.

## Security

- **Extension Key**: Your key is stored locally in Chrome's storage
- **Key Format**: `tk_` + 32 random characters
- **Single Key**: Only one active key per user
- **Regeneration**: Regenerating your key disconnects all extensions using the old key

## Troubleshooting

### "Invalid key" or "Session expired"
- Your key may have been regenerated
- Go to Trackd Settings → Integrations
- Generate a new key and reconnect

### "No job detected"
- The extension might not recognize the page
- Try a different job board (LinkedIn, Indeed)
- Fields can be filled manually

### "Already saved"
- You've saved this job in the last 30 days
- Click "View Existing" to see your saved job

### Extension not working
1. Check that Developer Mode is enabled (`chrome://extensions/`)
2. Make sure the extension is enabled
3. Try reloading the extension
4. Check for errors in the extension's console

## Development

### File Structure

```
browser-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Extension popup UI
├── icons/                 # Extension icons (16, 32, 48, 128px)
└── scripts/
    ├── popup.js           # Main extension logic
    └── content.js         # Job data extraction (reference)
```

### How It Works

1. **Authentication**: Uses API key stored in `chrome.storage.local`
2. **Extraction**: Injects `extractJobData()` function into the current tab
3. **API Communication**: Sends extracted data to `/api/extension/save-job`
4. **Duplicate Detection**: Server checks for duplicates (same company + title in 30 days)

### API Endpoints Used

- `POST /api/extension/validate-key` - Validates extension key
- `POST /api/extension/save-job` - Saves job with authentication

## Testing Checklist

- [ ] Generate key → copy → paste in extension → connected
- [ ] Save job from LinkedIn → appears in Trackd
- [ ] Save duplicate job → shows warning with date
- [ ] Regenerate key → old extension disconnected
- [ ] Invalid key → proper error message
- [ ] Extension remembers connection after browser restart
- [ ] Test on Indeed, Greenhouse, Lever
- [ ] No job detected on non-job pages

## Publishing (Future)

To publish to Chrome Web Store:

1. Create promotional images (1280x800, 440x280)
2. Write store description
3. Package extension as ZIP
4. Submit to Chrome Web Store
5. Update `API_URL` to production URL before packaging

## Support

For issues or feature requests:
- Open an issue in the main repository
- Contact support through Trackd web app
