// Popup script

const API_URL = 'http://localhost:3000' // Change to your deployed URL

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('jobForm')
  const loading = document.getElementById('loading')
  const status = document.getElementById('status')
  const saveBtn = document.getElementById('saveBtn')
  const cancelBtn = document.getElementById('cancelBtn')
  const settingsLink = document.getElementById('settingsLink')

  // Check if API URL is configured
  const settings = await chrome.storage.sync.get(['apiUrl'])
  const apiUrl = settings.apiUrl || API_URL

  // Extract job data from current page
  loading.style.display = 'block'

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })

    // Send message to content script to extract data
    const jobData = await chrome.tabs.sendMessage(tab.id, { action: 'extractJobData' })

    // Populate form
    document.getElementById('title').value = jobData.title || ''
    document.getElementById('company').value = jobData.company || ''
    document.getElementById('location').value = jobData.location || ''
    document.getElementById('salary').value = jobData.salary || ''
    document.getElementById('notes').value = jobData.description || ''
    document.getElementById('url').value = jobData.url || tab.url

    loading.style.display = 'none'
    form.style.display = 'block'
  } catch (error) {
    loading.style.display = 'none'
    showStatus('Could not extract job data. Please fill in manually.', 'error')
    form.style.display = 'block'

    // Get at least the URL
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    document.getElementById('url').value = tab.url
  }

  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    saveBtn.disabled = true
    saveBtn.textContent = 'Saving...'

    // Detect source from URL
    const url = document.getElementById('url').value || ''
    let source = 'MANUAL'

    if (url.includes('linkedin.com')) {
      source = 'LINKEDIN'
    } else if (url.includes('indeed.com')) {
      source = 'INDEED'
    } else if (url.includes('google.com/careers') || url.includes('careers.google.com')) {
      source = 'GOOGLE'
    } else if (url.includes('glassdoor.com')) {
      source = 'GLASSDOOR'
    } else if (url) {
      source = 'OTHER'
    }

    const jobData = {
      title: document.getElementById('title').value,
      company: document.getElementById('company').value,
      location: document.getElementById('location').value || null,
      salary: document.getElementById('salary').value || null,
      url: url || null,
      status: document.getElementById('status').value,
      priority: document.getElementById('priority').value,
      notes: document.getElementById('notes').value || null,
      source: source,
    }

    try {
      const response = await fetch(`${apiUrl}/api/jobs/from-extension`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      const result = await response.json()

      form.style.display = 'none'
      showStatus('✓ Job saved successfully!', 'success')

      // Close popup after 1.5 seconds
      setTimeout(() => {
        window.close()
      }, 1500)
    } catch (error) {
      console.error('Error saving job:', error)
      showStatus('Failed to save job. Make sure your Job Tracker is running.', 'error')
      saveBtn.disabled = false
      saveBtn.textContent = 'Save Job'
    }
  })

  // Handle cancel
  cancelBtn.addEventListener('click', () => {
    window.close()
  })

  // Handle settings link
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault()
    const newApiUrl = prompt('Enter your Job Tracker API URL:', apiUrl)
    if (newApiUrl) {
      chrome.storage.sync.set({ apiUrl: newApiUrl })
      alert('API URL updated!')
    }
  })
})

function showStatus(message, type) {
  const statusEl = document.getElementById('status')
  statusEl.textContent = message
  statusEl.className = `status ${type}`
  statusEl.style.display = 'block'
}
