# Job Tracker Browser Extension

Save job postings to your Job Tracker with one click!

## Installation

### Chrome/Edge/Brave

1. Open your browser and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `browser-extension` folder from this project
5. The extension is now installed!

### Firefox

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the `browser-extension` folder and select `manifest.json`
4. The extension is now installed temporarily (until you close Firefox)

## Usage

1. **Navigate to any job posting** on LinkedIn, Indeed, Google Careers, or any job site
2. **Click the extension icon** in your browser toolbar
3. The extension will **automatically extract** the job title, company, location, and description
4. **Review and edit** the details if needed
5. **Click "Save Job"** - done!

The job will appear in your Job Tracker immediately.

## Configuration

### API URL

By default, the extension connects to `http://localhost:3000` (your local development server).

To change this:
1. Click the extension icon
2. Click "Settings" at the bottom
3. Enter your Job Tracker URL (e.g., `https://your-app.vercel.app`)
4. Click OK

## Supported Sites

The extension works best on:
- ✅ LinkedIn job postings
- ✅ Indeed job listings
- ✅ Google Careers
- ✅ Most company career pages

It will attempt to extract data from any website, falling back to generic selectors.

## Icons

The extension currently uses placeholder icons. To add custom icons:

1. Create 16x16, 48x48, and 128x128 PNG images
2. Save them as `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder
3. Reload the extension

## Development

The extension consists of:

- **manifest.json** - Extension configuration
- **popup.html** - Popup UI when you click the extension icon
- **scripts/popup.js** - Handles the popup logic and API calls
- **scripts/content.js** - Runs on job pages to extract data

## Troubleshooting

**"Could not extract job data"**
- The site may have unusual HTML structure
- Fill in the details manually - the form will still work!

**"Failed to save job"**
- Make sure your Job Tracker app is running
- Check the API URL in Settings
- Check browser console for errors (F12 → Console)

**Extension not appearing**
- Make sure Developer Mode is enabled
- Try reloading the extension
- Check for errors in `chrome://extensions/`
