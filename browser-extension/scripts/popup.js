console.log('[Trackd] Extension loaded')

// API URL - change this for your environment
// const API_URL = 'http://localhost:3000' // For local development
const API_URL = 'https://trackd-eight.vercel.app' // For production

// Content script files to inject
const CONTENT_SCRIPT_FILES = [
  'scripts/content.js',
  'scripts/extractors/linkedin-extractor.js',
  'scripts/extractors/ziprecruiter-extractor.js',
  'scripts/extractors/landing-jobs-extractor.js',
  'scripts/extractors/4dayweek-extractor.js',
  'scripts/extractors/remoterocketship-extractor.js'
]

// Fetch helper with timeout
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw error;
  }
}

// DOM Elements
const connectView = document.getElementById('connectView')
const loadingView = document.getElementById('loadingView')
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
const urlInput = document.getElementById('urlInput')

// Buttons
const connectBtn = document.getElementById('connectBtn')
const saveBtn = document.getElementById('saveBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const viewInTrackdBtn = document.getElementById('viewInTrackdBtn')
const saveAnotherBtn = document.getElementById('saveAnotherBtn')
const importUrlBtn = document.getElementById('importUrlBtn')

// State
let currentJobData = null
let savedJobId = null

// Initialize
document.addEventListener('DOMContentLoaded', init)

async function init() {
  // Set dynamic links based on API_URL
  const getKeyLink = document.getElementById('getKeyLink')
  if (getKeyLink) {
    getKeyLink.href = `${API_URL}/settings/integrations`
  }

  // Loading view is shown by default in HTML, check connection status
  const data = await chrome.storage.local.get(['extensionKey', 'userEmail'])

  if (data.extensionKey) {
    // User is connected - show loading while extracting
    showConnectedState(data.userEmail)
    await loadJobData()
  } else {
    // User not connected - show connect view
    showConnectView()
  }
}

// Views
function showConnectView() {
  connectView.classList.remove('hidden')
  loadingView.classList.add('hidden')
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
  // Hide connect view immediately
  connectView.classList.add('hidden')
}

function showLoadingState() {
  connectView.classList.add('hidden')
  loadingView.classList.remove('hidden')
  jobView.classList.add('hidden')
  noJobView.classList.add('hidden')
  successView.classList.add('hidden')
}

function hideLoadingState() {
  loadingView.classList.add('hidden')
}

function showJobView() {
  connectView.classList.add('hidden')
  loadingView.classList.add('hidden')
  jobView.classList.remove('hidden')
  noJobView.classList.add('hidden')
  successView.classList.add('hidden')
}

function showNoJobView() {
  connectView.classList.add('hidden')
  loadingView.classList.add('hidden')
  jobView.classList.add('hidden')
  noJobView.classList.remove('hidden')
  successView.classList.add('hidden')
}

function showSuccessView(company, title) {
  connectView.classList.add('hidden')
  loadingView.classList.add('hidden')
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

// Button state helpers
function setButtonLoading(button, loadingText) {
  button.disabled = true
  button.innerHTML = `<span class="spinner"></span>${loadingText}`
}

function setButtonNormal(button, normalText) {
  button.disabled = false
  button.innerHTML = normalText
}

// Connect
connectBtn.addEventListener('click', async () => {
  const key = keyInput.value.trim()

  if (!key.startsWith('tk_')) {
    showMessage('error', 'Invalid key format. Key should start with "tk_"')
    return
  }

  setButtonLoading(connectBtn, 'Connecting...')

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/extension/validate-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    })

    const data = await res.json()

    if (res.ok && data.valid) {
      await chrome.storage.local.set({ extensionKey: key, userEmail: data.email })
      showConnectedState(data.email)
      await loadJobData()
    } else {
      showMessage('error', data.error || 'Invalid key. Please check and try again.')
    }
  } catch (err) {
    console.error('Connection error:', err)
    showMessage('error', err.message || 'Unable to connect. Check your internet connection.')
  } finally {
    setButtonNormal(connectBtn, 'Connect')
  }
})

// Disconnect
disconnectBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['extensionKey', 'userEmail'])
  showConnectView()
  keyInput.value = ''
})

// Settings
document.getElementById('settingsBtn')?.addEventListener('click', () => {
  chrome.tabs.create({ url: `${API_URL}/settings/integrations` })
})

// Load job data from current tab
async function loadJobData() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    console.log('[Trackd] Attempting to extract from:', tab.url)
    console.log('[Trackd] Tab ID:', tab.id)

    // Check if we can inject into this tab
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('[Trackd] Cannot inject into this page type')
      showNoJobView()
      return
    }

    // Inject content scripts and then send message to extract job data
    let jobData
    try {
      // First, try to send message (in case content scripts are already loaded)
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' })
        jobData = response
        console.log('[Trackd] Extracted job data from existing content scripts:', jobData)
      } catch (msgErr) {
        // Content scripts not loaded, inject them
        console.log('[Trackd] Content scripts not loaded, injecting...')
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: CONTENT_SCRIPT_FILES
        })
        console.log('[Trackd] Content scripts injected')
        
        // Wait for scripts to initialize (LinkedIn needs more time as it's a SPA)
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Now send message to extract job data
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' })
        jobData = response
        console.log('[Trackd] Extracted job data from injected content scripts:', jobData)
      }
    } catch (scriptErr) {
      console.error('[Trackd] Content script injection/message failed:', scriptErr.message)
      showNoJobView()
      return
    }
    
    // Detailed logging to debug extraction issues
    console.log('[Trackd] Extracted job data:', JSON.stringify(jobData, null, 2))
    console.log('[Trackd] Title:', jobData?.title, '| Company:', jobData?.company)
    console.log('[Trackd] URL:', jobData?.url)
    
    // Log debug info from content script
    if (jobData?._debug) {
      console.log('[Trackd] Debug info from page:')
      console.log('  - Document title:', jobData._debug.documentTitle)
      console.log('  - Hostname:', jobData._debug.hostname)
      console.log('  - Has extractors:', jobData._debug.hasTrackdExtractors)
      console.log('  - Extractor names:', jobData._debug.extractorNames)
      if (jobData._debug.error) {
        console.log('  - Error:', jobData._debug.error)
      }
    }

    // Check if we got valid job data - require at least title (company can be filled manually)
    if (jobData && jobData.title) {
      // Detect source from URL
      const source = detectSource(tab.url)
      
      currentJobData = { 
        ...jobData, 
        url: tab.url,
        source: source  // Store source in currentJobData
      }

      companyInput.value = jobData.company || ''
      titleInput.value = jobData.title || ''
      locationInput.value = jobData.location || ''
      salaryInput.value = jobData.salary || ''
      sourceLabel.textContent = source

      showJobView()
    } else {
      console.log('[Trackd] No valid job data found')
      showNoJobView()
    }
  } catch (err) {
    console.error('[Trackd] Failed to extract job data:', err)
    showNoJobView()
  }
}

function detectSource(url) {
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('indeed.com')) return 'Indeed'
  if (url.includes('greenhouse.io')) return 'Greenhouse'
  if (url.includes('lever.co')) return 'Lever'
  if (url.includes('workable.com')) return 'Workable'
  if (url.includes('euremotejobs.com')) return 'EU Remote Jobs'
  if (url.includes('landing.jobs')) return 'Landing.jobs'
  if (url.includes('ziprecruiter.com')) return 'ZipRecruiter'
  return 'Unknown'
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

  setButtonLoading(saveBtn, 'Saving...')
  hideMessage()

  try {
    const res = await fetchWithTimeout(`${API_URL}/api/extension/save-job`, {
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
    console.error('Save job error:', err)
    showMessage('error', err.message || 'Unable to save. Check your internet connection.')
  } finally {
    setButtonNormal(saveBtn, 'Save to Trackd')
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

// Import from URL
importUrlBtn?.addEventListener('click', async () => {
  const url = urlInput.value.trim()
  
  if (!url) {
    showMessage('error', 'Please enter a URL')
    return
  }
  
  // Validate URL
  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    showMessage('error', 'Invalid URL format')
    return
  }

  // Check for LinkedIn - warn user that URL import doesn't work for LinkedIn
  if (parsedUrl.hostname.includes('linkedin.com')) {
    showMessage('error', 'LinkedIn jobs cannot be imported via URL. Please navigate to the LinkedIn job page directly and the extension will extract it automatically.')
    return
  }
  
  importUrlBtn.disabled = true
  importUrlBtn.innerHTML = '<span class="spinner"></span>Extracting...'
  hideMessage()
  
  try {
    const { extensionKey } = await chrome.storage.local.get('extensionKey')
    
    if (!extensionKey) {
      showConnectView()
      showMessage('error', 'Please connect your extension first')
      return
    }
    
    // Call the scrape API endpoint
    const res = await fetchWithTimeout(`${API_URL}/api/scrape-job`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Extension-Key': extensionKey
      },
      body: JSON.stringify({ url })
    }, 15000)

    const response = await res.json()

    if (!res.ok || !response.success) {
      // Special handling for LinkedIn or sites that require client-side extraction
      if (response.requiresClientSide) {
        showMessage('error', response.error)
        return
      }
      throw new Error(response.error || 'Could not extract job data from this URL')
    }
    
    const jobData = response.data
    
    if (!jobData || !jobData.title) {
      throw new Error('No job data found at this URL')
    }
    
    // Populate form with scraped data
    companyInput.value = jobData.company || ''
    titleInput.value = jobData.title || ''
    locationInput.value = jobData.location || ''
    salaryInput.value = jobData.salary || ''
    
    const source = jobData.source || detectSource(url)
    sourceLabel.textContent = source
    
    currentJobData = {
      url: url,
      company: jobData.company || '',
      title: jobData.title || '',
      location: jobData.location || '',
      salary: jobData.salary || '',
      source: source
    }
    
    showJobView()
    showMessage('success', 'Job data imported successfully!')
  } catch (error) {
    console.error('Import URL error:', error)
    showMessage('error', error.message || 'Failed to import job data from URL')
  } finally {
    setButtonNormal(importUrlBtn, 'Import from URL')
  }
})
