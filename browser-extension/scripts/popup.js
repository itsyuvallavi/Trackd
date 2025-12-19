console.log('[Trackd] Extension loaded')

// API URL - change this for your environment
const API_URL = 'http://localhost:3000' // For local development
// const API_URL = 'https://your-app.vercel.app' // For production

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
    showMessage('error', 'Invalid key format. Key should start with "tk_"')
    return
  }

  connectBtn.disabled = true
  connectBtn.innerHTML = '<span class="spinner"></span>Connecting...'

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
    connectBtn.disabled = false
    connectBtn.innerHTML = 'Connect'
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

    // Execute content script to extract job data
    let results
    try {
      results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractJobData
      })
      console.log('[Trackd] Script execution results:', results)
    } catch (scriptErr) {
      console.error('[Trackd] Script injection failed:', scriptErr.message)
      showNoJobView()
      return
    }

    const jobData = results[0]?.result
    console.log('[Trackd] Extracted job data:', jobData)

    // Check if we got valid job data - require at least title (company can be filled manually)
    if (jobData && jobData.title) {
      currentJobData = { ...jobData, url: tab.url }

      companyInput.value = jobData.company || ''
      titleInput.value = jobData.title || ''
      locationInput.value = jobData.location || ''
      salaryInput.value = jobData.salary || ''

      // Detect source from URL
      const source = detectSource(tab.url)
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

// Content script function (injected into page)
function extractJobData() {
  const url = window.location.href
  let source = 'Unknown'
  let company = ''
  let title = ''
  let location = ''
  let salary = ''

  // LinkedIn - try multiple selectors to handle different page layouts
  if (url.includes('linkedin.com') && url.includes('/jobs/')) {
    source = 'LinkedIn'

    // LinkedIn uses obfuscated classes, so we need to be creative
    // Strategy: Find elements by their visual/structural characteristics

    // 1. Try to get the job title from the page title (most reliable)
    const pageTitle = document.title
    console.log('[Trackd LinkedIn Debug] Page title:', pageTitle)
    if (pageTitle && pageTitle.includes('|')) {
      // Format is usually "Job Title | Company | LinkedIn" or similar
      title = pageTitle.split('|')[0].trim()
      if (title.toLowerCase().includes('linkedin') || title.length < 3) {
        title = ''
      }
    }

    // 2. Try to find the company first (we know this selector works based on earlier test)
    company = document.querySelector('a[href*="/company/"]')?.textContent?.trim() || ''
    console.log('[Trackd LinkedIn Debug] Company from link:', company)

    // 3. Look for large text elements near the top that could be the job title
    if (!title) {
      // Find all text elements and look for one that looks like a job title
      const allElements = document.querySelectorAll('div, span, h1, h2, h3, a')
      for (const el of allElements) {
        const text = el.textContent?.trim() || ''
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)

        // Job titles are usually large text (20px+), not too long, and near the top
        if (fontSize >= 20 && text.length > 5 && text.length < 100 &&
            el.getBoundingClientRect().top < 400 &&
            !text.toLowerCase().includes('linkedin') &&
            !text.toLowerCase().includes('sign in') &&
            !text.toLowerCase().includes('premium') &&
            !text.includes('applicant') &&
            text !== company) {
          title = text
          console.log('[Trackd LinkedIn Debug] Found title by font size:', title, 'fontSize:', fontSize)
          break
        }
      }
    }

    // 4. Fallback: Look for any div/span with the exact job title text pattern
    if (!title) {
      const candidates = document.querySelectorAll('div, span')
      for (const el of candidates) {
        // Only direct text content (not nested)
        if (el.children.length === 0 || el.children.length === 1) {
          const text = el.textContent?.trim() || ''
          if (text.length > 10 && text.length < 80 &&
              !text.includes('·') && !text.includes('|') &&
              !text.toLowerCase().includes('apply') &&
              !text.toLowerCase().includes('save') &&
              text !== company) {
            const rect = el.getBoundingClientRect()
            if (rect.top > 100 && rect.top < 350) {
              title = text
              console.log('[Trackd LinkedIn Debug] Found title by position:', title)
              break
            }
          }
        }
      }
    }

    console.log('[Trackd LinkedIn Debug] Final - title:', title, 'company:', company)

    // ROBUST Location extraction for LinkedIn (no class-based selectors)
    // LinkedIn uses obfuscated class names, so we use pattern matching instead

    // Location patterns: "City, State", "City, Country", "Remote", etc.
    const locationPatterns = [
      /^([A-Z][a-zA-Z\s]+,\s*[A-Z]{2})$/,  // "San Francisco, CA"
      /^([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)$/,  // "San Francisco, California" or "London, United Kingdom"
      /^([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+)$/,  // "San Francisco, California, United States"
      /^(Remote|Hybrid|On-?site)$/i,  // Work type
      /^([A-Z][a-zA-Z\s]+)\s*\((?:Remote|Hybrid|On-?site)\)$/i,  // "New York (Remote)"
    ]

    // Common location keywords to help identify location elements
    const locationKeywords = ['remote', 'hybrid', 'on-site', 'onsite', 'united states', 'united kingdom', 'canada', 'australia', 'germany', 'france', 'india']
    const usStates = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

    // Common country names for detection (expanded list)
    const countryNames = ['poland', 'germany', 'france', 'spain', 'italy', 'netherlands', 'belgium', 'sweden', 'norway', 'denmark', 'finland', 'austria', 'switzerland', 'portugal', 'ireland', 'czech', 'hungary', 'romania', 'bulgaria', 'croatia', 'greece', 'turkey', 'israel', 'united states', 'united kingdom', 'canada', 'australia', 'new zealand', 'india', 'china', 'japan', 'korea', 'singapore', 'brazil', 'mexico', 'argentina', 'lithuania', 'latvia', 'estonia', 'slovakia', 'slovenia', 'serbia', 'ukraine', 'belarus', 'russia', 'iceland', 'luxembourg', 'malta', 'cyprus', 'albania', 'macedonia', 'montenegro', 'bosnia', 'moldova', 'georgia', 'armenia', 'azerbaijan']

    // 1. First try: Look in the primary description area (usually contains company · location · time)
    const allSpans = document.querySelectorAll('span')
    const allDivs = document.querySelectorAll('div')

    // Look for text that matches location patterns (supporting international characters)
    const locationCandidates = []

    for (const el of [...allSpans, ...allDivs]) {
      const text = el.textContent?.trim() || ''

      // CRITICAL: Skip if element has multiple child elements (it's a container, not pure text)
      if (el.children.length > 2) continue
      
      // CRITICAL: If element has children, make sure the text isn't just concatenated from children
      // This prevents matching containers like "<div><span>Set alert</span><span>California</span></div>"
      if (el.children.length > 0) {
        let childrenText = ''
        for (const child of el.children) {
          childrenText += child.textContent?.trim() || ''
        }
        // If children's text is basically the same as element text, it's a container
        if (childrenText.length > text.length * 0.7) continue
      }

      // Skip if too long or too short
      if (text.length < 3 || text.length > 100) continue

      // Skip if it contains common non-location text (expanded list)
      if (text.includes('applicant') || text.includes('viewer') ||
          text.includes('Apply') || text.includes('Save') ||
          text.includes('$') || text.includes('week ago') ||
          text.includes('day ago') || text.includes('hour ago') ||
          text.includes('minute ago') || text.includes('month ago') ||
          text.includes('Set alert') || text.includes('alert for') ||
          text.includes('Similar jobs') || text.includes('similar job') ||
          text.includes('Follow') || text.includes('Share') ||
          text.includes('Easy Apply') || text.includes('Sign in') ||
          text.includes('Premium') || text.toLowerCase().includes('engineer') ||
          text.toLowerCase().includes('developer') || text.toLowerCase().includes('manager') ||
          text.toLowerCase().includes('designer') || text.toLowerCase().includes('analyst') ||
          text === company || text === title) continue
      
      // Skip if it looks like it contains a job title (has multiple capitalized words in sequence)
      const capitalizedWords = text.match(/[A-Z][a-z]+/g) || []
      if (capitalizedWords.length > 4) continue

      // PATTERN 1: US state abbreviation (City, ST) - highest confidence
      const usStateMatch = text.match(/^([A-Z][a-zA-Z\s\-\.]+),\s*([A-Z]{2})(?:\s|$)/)
      if (usStateMatch && usStates.includes(usStateMatch[2])) {
        const rect = el.getBoundingClientRect()
        locationCandidates.push({ text: usStateMatch[0].trim(), priority: 1, top: rect.top, reason: 'US state pattern' })
        continue
      }

      // PATTERN 2: "City, Region, Country" (3 parts) - high confidence
      // Matches: "Wrocław, Dolnośląskie, Poland" or "Munich, Bavaria, Germany"
      const threePartMatch = text.match(/^([^,\d\(\)\[\]]+),\s*([^,\d\(\)\[\]]+),\s*([^,\d\(\)\[\]]+)$/)
      if (threePartMatch && text.length < 80) {
        const rect = el.getBoundingClientRect()
        // Boost priority if last part is in known countries (fallback check)
        const lastPart = threePartMatch[3].trim().toLowerCase()
        const inKnownCountries = countryNames.some(c => lastPart.includes(c))
        locationCandidates.push({ 
          text: text.trim(), 
          priority: inKnownCountries ? 1 : 2, 
          top: rect.top,
          reason: inKnownCountries ? '3-part location (verified)' : '3-part location (pattern)'
        })
        continue
      }

      // PATTERN 3: "City, Country" (2 parts) - high confidence
      // Matches: "Warsaw, Poland" or "München, Germany" or "Malibu, CA"
      const twoPartMatch = text.match(/^([^,\d\(\)\[\]]+),\s*([^,\d\(\)\[\]]+)$/)
      if (twoPartMatch && text.length < 60) {
        const rect = el.getBoundingClientRect()
        // Boost priority if last part is in known countries (fallback check)
        const lastPart = twoPartMatch[2].trim().toLowerCase()
        const inKnownCountries = countryNames.some(c => lastPart.includes(c))
        locationCandidates.push({ 
          text: text.trim(), 
          priority: inKnownCountries ? 1 : 2, 
          top: rect.top,
          reason: inKnownCountries ? '2-part location (verified)' : '2-part location (pattern)'
        })
        continue
      }

      // PATTERN 4: Single capitalized word (4+ chars) - medium confidence
      // Matches: "Lithuania", "Poland", "Remote", "California"
      // This works for most single-word countries WITHOUT needing the hardcoded list
      if (text.match(/^[A-Z][a-zA-Z]{3,}$/) && !text.match(/^(Remote|Hybrid|Apply|Save|Follow|Share|Premium|Insights|Messages)$/i)) {
        const rect = el.getBoundingClientRect()
        // Use hardcoded list only to boost priority (fallback)
        const inKnownCountries = countryNames.some(c => text.toLowerCase() === c)
        locationCandidates.push({ 
          text: text, 
          priority: inKnownCountries ? 2 : 3, 
          top: rect.top,
          reason: inKnownCountries ? 'Single word (verified country)' : 'Single word (pattern match)'
        })
        continue
      }
      
      // PATTERN 5: Location with work type - "Warsaw, Poland (Remote)"
      const locationWorkTypeMatch = text.match(/^([^,\d\(\)\[\]]+,\s*[^,\d\(\)\[\]]+)\s*\((?:Remote|Hybrid|On-?site)\)/i)
      if (locationWorkTypeMatch) {
        const rect = el.getBoundingClientRect()
        locationCandidates.push({ text: text.trim(), priority: 1, top: rect.top, reason: 'Location with work type' })
        continue
      }

      // PATTERN 6: Work type only - "Remote", "Hybrid", "On-site" (low priority)
      const workTypeMatch = text.match(/^(Remote|Hybrid|On-?site)(?:\s|$)/i)
      if (workTypeMatch) {
        const rect = el.getBoundingClientRect()
        locationCandidates.push({ text: workTypeMatch[1], priority: 7, top: rect.top, reason: 'Work type only' })
        continue
      }

      // FALLBACK: Text contains known country name (only when patterns don't match)
      // This is our safety net for unusual formats
      for (const country of countryNames) {
        if (text.toLowerCase().includes(country) && text.length < 50) {
          const rect = el.getBoundingClientRect()
          locationCandidates.push({ text: text.trim(), priority: 5, top: rect.top, reason: 'Contains known country (fallback)' })
          break
        }
      }

      // FALLBACK: Text contains location keywords (lowest priority)
      for (const keyword of locationKeywords) {
        if (text.toLowerCase().includes(keyword) && text.length < 50) {
          const rect = el.getBoundingClientRect()
          locationCandidates.push({ text: text.trim(), priority: 8, top: rect.top, reason: 'Contains location keyword (fallback)' })
          break
        }
      }
    }
    
    // Remove "Remote", "Hybrid", "On-site" if we have better candidates
    if (locationCandidates.length > 1) {
      const nonWorkTypeCandidates = locationCandidates.filter(c => 
        !c.text.match(/^(Remote|Hybrid|On-?site)$/i)
      )
      if (nonWorkTypeCandidates.length > 0) {
        // We have real locations, remove work types
        const workTypes = locationCandidates.filter(c => c.text.match(/^(Remote|Hybrid|On-?site)$/i))
        if (workTypes.length > 0) {
          console.log('[Trackd LinkedIn Debug] Removing work type candidates:', workTypes.map(w => w.text))
          locationCandidates.splice(0, locationCandidates.length, ...nonWorkTypeCandidates)
        }
      }
    }

    console.log('[Trackd LinkedIn Debug] Location candidates found:', locationCandidates.length)
    if (locationCandidates.length > 0) {
      console.log('[Trackd LinkedIn Debug] Top 5 candidates:', locationCandidates.slice(0, 5).map(c => `"${c.text}" (priority: ${c.priority}, reason: ${c.reason})`))
    }

    // Sort by priority (lower is better), then by position (top of page preferred for job details)
    locationCandidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      // Prefer elements in the header area (top 400px)
      if (a.top < 400 && b.top >= 400) return -1
      if (b.top < 400 && a.top >= 400) return 1
      return a.top - b.top
    })

    if (locationCandidates.length > 0) {
      let locationRaw = locationCandidates[0].text
      // Clean up the location
      location = locationRaw.split('·')[0].trim()
      location = location.split('(')[0].trim() // Remove work type if in parentheses
      location = location.replace(/\d+\s+(applicant|application|viewer)s?.*$/i, '').trim()
      location = location.replace(/\d+\s+(week|day|hour)s?\s+ago.*$/i, '').trim()
      location = location.replace(/^Location:\s*/i, '').trim()
      console.log('[Trackd LinkedIn Debug] Selected location:', location, 'from candidate:', locationRaw)
    } else {
      console.log('[Trackd LinkedIn Debug] No location candidates found')
    }

    // Fallback: Try legacy class-based selectors (may work on some pages)
    if (!location) {
      let locationRaw = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim()
        || document.querySelector('.topcard__flavor--bullet')?.textContent?.trim()
        || document.querySelector('[data-test-id="job-location"]')?.textContent?.trim()
        || ''

      if (locationRaw) {
        location = locationRaw.split('·')[0].trim()
        location = location.replace(/\d+\s+(applicant|application|viewer)s?.*$/i, '').trim()
        location = location.replace(/^Location:\s*/i, '').trim()
      }
    }
    
    // Try multiple selectors for salary
    salary = document.querySelector('.job-details-jobs-unified-top-card__salary-info')?.textContent?.trim()
      || document.querySelector('.salary-main-rail__data-body')?.textContent?.trim()
      || document.querySelector('.compensation__salary')?.textContent?.trim()
      || document.querySelector('[data-testid="salary-info"]')?.textContent?.trim()
      || ''
    
    // Also try searching for salary patterns in job insights
    if (!salary) {
      const insights = document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight-text')
      for (const insight of insights) {
        const text = insight.textContent?.trim() || ''
        if (text.match(/\$[\d,]+/)) {
          salary = text
          break
        }
      }
    }
    
    // Try to find salary in metadata list items
    if (!salary) {
      const metadataItems = document.querySelectorAll('.topcard__flavor--metadata-list-item, .job-details-jobs-unified-top-card__job-insight')
      for (const item of metadataItems) {
        const text = item.textContent?.toLowerCase() || ''
        if (text.includes('$') || text.includes('salary') || text.includes('compensation')) {
          salary = item.textContent?.trim() || ''
          break
        }
      }
    }
    
    // Clean up salary
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '')
        .replace(/^Compensation:\s*/i, '')
        .replace(/\s*per\s+(year|month|week|hour|hr|yr|mo|wk)\s*/gi, '/$1 ')
        .replace(/\s*\/\s*(year|month|week|hour|yr|mo|wk)\s*/gi, '/$1 ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Extract just the salary range if there's extra text
      const salaryMatch = salary.match(/\$[\d,]+\s*(?:-\s*\$[\d,]+)?(?:\/\s*(?:year|month|week|hour|yr|mo|wk|day|d))?/i)
      if (salaryMatch) {
        salary = salaryMatch[0]
      }
    }
    
    // AGGRESSIVE Fallback: If title/company not found, try very generic approaches
    if (!title || !company) {
      // Find main content area
      const mainContent = document.querySelector('main') 
        || document.querySelector('[role="main"]') 
        || document.querySelector('.jobs-search__job-details')
        || document.querySelector('[class*="job-details" i]')
        || document.body
      
      // Find the best h1 candidate for title
      if (!title) {
        const h1s = Array.from(mainContent.querySelectorAll('h1')).filter(h1 => {
          const text = h1.textContent?.trim() || ''
          return text.length > 5 && text.length < 150 && 
                 !text.toLowerCase().includes('linkedin') &&
                 !text.toLowerCase().includes('home') &&
                 !text.toLowerCase().includes('sign in')
        })
        
        if (h1s.length > 0) {
          title = h1s[0].textContent.trim()
        }
      }
      
      // Very aggressive company finding - look anywhere near the title
      if (!company) {
        // Strategy 1: Look for company links anywhere on the page
        const companyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]')).filter(link => {
          const text = link.textContent?.trim() || ''
          return text.length > 1 && text.length < 60 && !text.includes('@')
        })
        
        if (companyLinks.length > 0) {
          company = companyLinks[0].textContent.trim()
        }
        
        // Strategy 2: If title was found, look near it
        if (!company && title) {
          const titleEl = Array.from(document.querySelectorAll('h1, h2')).find(el => 
            el.textContent?.trim() === title
          )
          
          if (titleEl) {
            // Look in parent containers
            let container = titleEl.parentElement
            for (let i = 0; i < 3 && container; i++) {
              // Look for links or text that could be company
              const candidates = container.querySelectorAll('a, span, div, p, strong, b')
              for (const el of candidates) {
                const text = el.textContent?.trim() || ''
                if (text.length >= 2 && text.length <= 60 &&
                    !text.includes('@') &&
                    !text.match(/^\d+$/) &&
                    !text.match(/^\d+\s*(day|week|month|year|hour|minute|applicant|application)/i) &&
                    !['apply', 'save', 'share', 'more', 'less', 'view', 'hide', 'show'].includes(text.toLowerCase()) &&
                    text !== title &&
                    !text.includes('http') &&
                    !text.match(/^[A-Z]{2,3}$/)) {
                  company = text
                  break
                }
              }
              if (company) break
              container = container.parentElement
            }
          }
        }
        
        // Strategy 3: Last resort - try to extract from page structure
        if (!company) {
          // Look for text that appears after "at" or "with" (common patterns)
          const allText = document.body.textContent || ''
          const companyMatch = allText.match(/(?:at|with|from)\s+([A-Z][a-zA-Z\s&,.-]{2,50})(?:\s|$|,|\.)/i)
          if (companyMatch && companyMatch[1]) {
            company = companyMatch[1].trim()
          }
        }
      }
    }
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
    salary = document.querySelector('#salaryInfoAndJobType')?.textContent?.trim()
      || document.querySelector('[data-testid="job-salary"]')?.textContent?.trim()
      || document.querySelector('.jobsearch-JobMetadataHeader-item')?.textContent?.trim()
      || ''
    
    // Clean up Indeed salary
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '')
        .replace(/^Pay:\s*/i, '')
        .trim()
      
      // Extract salary range/amount
      const salaryMatch = salary.match(/\$[\d,]+\s*(?:-\s*\$[\d,]+)?(?:\/\s*(?:year|month|week|hour|yr|mo|wk|day|d))?/i)
      if (salaryMatch) {
        salary = salaryMatch[0]
      }
    }
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

  // Workable
  else if (url.includes('workable.com') || url.includes('apply.workable.com')) {
    source = 'Workable'
    
    // Company - from logo or header
    company = document.querySelector('[alt*="logo" i]')?.alt?.replace(/logo/i, '').trim()
      || document.querySelector('.company-name')?.textContent?.trim()
      || document.querySelector('header img')?.alt
      || ''
    
    // Title - in h1
    title = document.querySelector('h1')?.textContent?.trim() || ''
    
    // Location - Workable shows full location like "New York, New York, United States"
    // Look for location text in the header metadata area
    const locationEl = Array.from(document.querySelectorAll('div, span, p'))
      .find(el => {
        const text = el.textContent?.trim() || ''
        // Match pattern: City, State/Region, Country
        return text.match(/^[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+$/) &&
               el.getBoundingClientRect().top < 400
      })
    location = locationEl?.textContent?.trim() || ''
    
    // If full location not found, try simpler pattern
    if (!location) {
      const simpleLocationEl = Array.from(document.querySelectorAll('div, span, p'))
        .find(el => {
          const text = el.textContent?.trim() || ''
          return text.match(/^[A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+$/) &&
                 el.getBoundingClientRect().top < 400 &&
                 text !== title
        })
      location = simpleLocationEl?.textContent?.trim() || ''
    }
    
    // Salary - Look for "Compensations:" label or salary range
    const salaryEl = Array.from(document.querySelectorAll('div, span, p'))
      .find(el => {
        const text = el.textContent?.trim() || ''
        return text.match(/Compensation[s]?:/i) || text.match(/\$[\d,]+K?\s*[-–]\s*\$[\d,]+K?/i)
      })
    
    if (salaryEl) {
      const salaryText = salaryEl.textContent?.trim() || ''
      // Extract just the salary range
      const salaryMatch = salaryText.match(/\$[\d,]+K?\s*[-–]\s*\$[\d,]+K?/i)
      salary = salaryMatch ? salaryMatch[0] : ''
    }
    
    console.log('[Trackd Workable] Title:', title)
    console.log('[Trackd Workable] Company:', company)
    console.log('[Trackd Workable] Location:', location)
    console.log('[Trackd Workable] Salary:', salary)
  }

  // EU Remote Jobs
  else if (url.includes('euremotejobs.com')) {
    source = 'EU Remote Jobs'
    
    // Title - in h1
    title = document.querySelector('h1')?.textContent?.trim() || ''
    console.log('[Trackd EU Remote] Title:', title)
    
    // Company - look for text near h1 or in metadata
    const companyEl = document.querySelector('h1 + div') || document.querySelector('.company-name')
    company = companyEl?.textContent?.trim() || 
              document.querySelector('[class*="company" i]')?.textContent?.trim() ||
              ''
    console.log('[Trackd EU Remote] Company:', company)
    
    // Location - EU Remote Jobs shows it with a location pin icon
    // Strategy: Find the location icon, then get the adjacent text
    let locationText = ''
    
    // Method 1: Look for SVG location icon or location emoji, then get nearby text
    const locationIcons = document.querySelectorAll('svg, span')
    for (const icon of locationIcons) {
      const iconRect = icon.getBoundingClientRect()
      // Only check elements in header (top 600px)
      if (iconRect.top > 600) continue
      
      const iconText = icon.textContent?.trim() || ''
      const iconHTML = icon.innerHTML || ''
      
      // Check if it's a location icon (📍 or SVG with location/pin/map)
      if (iconText === '📍' || 
          iconHTML.includes('location') || 
          iconHTML.includes('pin') ||
          iconHTML.includes('map-marker') ||
          icon.getAttribute('aria-label')?.includes('ocation')) {
        
        // Found location icon, now find the text next to it
        let sibling = icon.nextSibling
        if (sibling && sibling.textContent) {
          locationText = sibling.textContent.trim()
          console.log('[Trackd EU Remote] Found via icon sibling:', locationText)
          break
        }
        
        // Try parent's next sibling
        const parentNext = icon.parentElement?.nextSibling
        if (parentNext && parentNext.textContent) {
          locationText = parentNext.textContent.trim()
          console.log('[Trackd EU Remote] Found via parent sibling:', locationText)
          break
        }
        
        // Try finding nearby span/div with location-like text
        const parent = icon.parentElement
        if (parent) {
          const nearbyText = parent.textContent?.trim() || ''
          // Extract location-like text (2-30 chars, no numbers/special chars)
          const match = nearbyText.match(/\b([A-Z]{2,3}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|Worldwide|Remote|EMEA)\b/)
          if (match) {
            locationText = match[1]
            console.log('[Trackd EU Remote] Found via parent text:', locationText)
            break
          }
        }
      }
    }
    
    // Method 2: Look for common location patterns in header
    if (!locationText) {
      const headerElements = Array.from(document.querySelectorAll('span, div, a, p'))
        .filter(el => {
          const rect = el.getBoundingClientRect()
          return rect.top > 0 && rect.top < 600 && rect.width < 200 // Header area, small elements
        })
      
      for (const el of headerElements) {
        const text = el.textContent?.trim() || ''
        
        // Skip if has children or wrong length
        if (el.children.length > 1 || text.length < 2 || text.length > 30) continue
        
        // Skip title/company
        if (text === title || text === company) continue
        
        // Skip if contains non-location words
        if (text.includes('Posted') || text.includes('ago') || text.includes('$') || 
            text.includes('Salary') || text.includes('FULL') || text.includes('Apply')) continue
        
        // Match location patterns
        if (text.match(/^(US|UK|EU|USA|Europe|EMEA|Worldwide|Remote|Hybrid)$/i)) {
          locationText = text
          console.log('[Trackd EU Remote] Found pattern match:', locationText)
          break
        }
        
        // Match "United States" etc
        if (text.match(/^(United States|United Kingdom|European Union)$/i)) {
          locationText = text
          console.log('[Trackd EU Remote] Found full name:', locationText)
          break
        }
      }
    }
    
    // Method 3: Look for "Location:" label
    if (!locationText) {
      const allText = Array.from(document.querySelectorAll('*'))
        .filter(el => el.getBoundingClientRect().top < 600)
        .map(el => el.textContent)
        .join('|||')
      
      const locationMatch = allText.match(/Location[:\s]+([A-Z][A-Za-z\s]+?)(?:\||Posted|Salary|$)/i)
      if (locationMatch) {
        locationText = locationMatch[1].trim()
        console.log('[Trackd EU Remote] Found via label:', locationText)
      }
    }
    
    location = locationText
    console.log('[Trackd EU Remote] Final location:', location)
    
    // Salary - extract from header area
    const salaryElements = Array.from(document.querySelectorAll('*'))
      .filter(el => el.getBoundingClientRect().top < 600)
    const salaryText = salaryElements.map(el => el.textContent).join(' ')
    const salaryMatch = salaryText.match(/(?:Salary[:\s]*)?(\$[\d,]+\s*[-–]\s*\$[\d,]+)/i)
    salary = salaryMatch ? salaryMatch[1] : ''
    console.log('[Trackd EU Remote] Salary:', salary)
  }

  // Generic fallback - try to extract from any job posting site
  else {
    source = new URL(url).hostname.replace('www.', '').split('.')[0]
    
    // Try structured data (JSON-LD) first - many sites use this
    const jsonLd = document.querySelector('script[type="application/ld+json"]')
    if (jsonLd) {
      try {
        const data = JSON.parse(jsonLd.textContent)
        if (Array.isArray(data)) {
          const jobPosting = data.find(item => item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting')
          if (jobPosting) {
            title = jobPosting.title || jobPosting.name || ''
            company = jobPosting.hiringOrganization?.name || jobPosting.employer?.name || ''
            location = jobPosting.jobLocation?.address?.addressLocality || 
                      jobPosting.jobLocation?.address?.addressRegion ||
                      jobPosting.jobLocation?.address?.addressCountry ||
                      jobPosting.jobLocation?.name || ''
            salary = jobPosting.baseSalary?.value?.value || 
                    jobPosting.baseSalary?.value || 
                    jobPosting.baseSalary || ''
            if (salary && typeof salary === 'object') {
              salary = `${salary.minValue || ''}${salary.maxValue ? ' - ' + salary.maxValue : ''} ${salary.currency || ''}`
            }
          }
        } else if (data['@type'] === 'JobPosting' || data['@type'] === 'http://schema.org/JobPosting') {
          title = data.title || data.name || ''
          company = data.hiringOrganization?.name || data.employer?.name || ''
          location = data.jobLocation?.address?.addressLocality || 
                    data.jobLocation?.address?.addressRegion ||
                    data.jobLocation?.address?.addressCountry ||
                    data.jobLocation?.name || ''
          salary = data.baseSalary?.value?.value || 
                  data.baseSalary?.value || 
                  data.baseSalary || ''
          if (salary && typeof salary === 'object') {
            salary = `${salary.minValue || ''}${salary.maxValue ? ' - ' + salary.maxValue : ''} ${salary.currency || ''}`
          }
        }
      } catch {
        // If JSON parsing fails, continue with other methods
      }
    }
    
    // If we didn't get data from structured data, try other methods
    if (!title || !company) {
      // Try Open Graph meta tags
      title = title || document.querySelector('meta[property="og:title"]')?.content || ''
      company = company || document.querySelector('meta[property="og:site_name"]')?.content || ''
      
      // Try to find h1 (most common for job titles)
      if (!title) {
        const h1s = Array.from(document.querySelectorAll('h1')).filter(h1 => {
          const text = h1.textContent?.trim() || ''
          // Filter out navigation, headers, etc.
          return text.length > 5 && text.length < 150 && 
                 !text.toLowerCase().includes('home') &&
                 !text.toLowerCase().includes('about') &&
                 !text.toLowerCase().includes('contact') &&
                 !text.toLowerCase().includes('sign in') &&
                 !text.toLowerCase().includes('login')
        })
        if (h1s.length > 0) {
          title = h1s[0].textContent.trim()
        }
      }
      
      // Try to find company name - look near the title
      if (!company && title) {
        // Find the title element
        const titleEl = Array.from(document.querySelectorAll('h1, h2')).find(el => 
          el.textContent?.trim() === title
        )
        
        if (titleEl) {
          const container = titleEl.closest('article, section, main, [role="main"], .content, .job-detail, .job-posting') || titleEl.parentElement
          
          // Look for company in nearby elements
          const nearby = container.querySelectorAll('a, span, div, p, h2, h3')
          for (const el of nearby) {
            const text = el.textContent?.trim() || ''
            // Heuristic: company names are usually 2-50 chars, not emails, not dates, not common UI words
            if (text.length >= 2 && text.length <= 50 &&
                !text.includes('@') &&
                !text.match(/^\d+\s*(day|week|month|year|hour|minute)/i) &&
                !text.match(/^[A-Z]{2,3}$/) && // Not state codes
                !['apply', 'save', 'share', 'more', 'less', 'view', 'hide', 'show', 'close', 'open'].includes(text.toLowerCase()) &&
                text !== title &&
                !text.match(/^\d+$/) && // Not just numbers
                !text.includes('http')) {
              company = text
              break
            }
          }
        }
      }
      
      // Fallback: try common class/attribute patterns
      if (!title) {
        title = document.querySelector('[itemprop="title"], [class*="title" i], [id*="title" i]')?.textContent?.trim() || ''
      }
      if (!company) {
        company = document.querySelector('[itemprop="hiringOrganization"], [class*="company" i], [id*="company" i], [data-company]')?.textContent?.trim() || 
                  document.querySelector('meta[property="og:site_name"]')?.content || ''
      }
    }
    
    // Try to find location - look for common patterns
    if (!location) {
      // Look for city, state patterns
      const locationPatterns = [
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/g, // "City, ST"
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)/g, // "City, State"
        /Remote/i,
        /Hybrid/i,
        /On-site/i
      ]
      
      const allText = document.body.textContent || ''
      for (const pattern of locationPatterns) {
        const match = allText.match(pattern)
        if (match) {
          location = match[0]
          break
        }
      }
      
      // Also try common location selectors
      if (!location) {
        location = document.querySelector('[itemprop="jobLocation"], [class*="location" i], [id*="location" i], [data-location]')?.textContent?.trim() || ''
      }
    }
    
    // Try to find salary - look for $ patterns
    if (!salary) {
      const salaryPattern = /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\/\s*(?:hr|hour|year|yr|month|mo|week|wk|day))?/gi
      const allText = document.body.textContent || ''
      const matches = allText.match(salaryPattern)
      if (matches && matches.length > 0) {
        // Prefer ranges or amounts with time units
        salary = matches.find(m => m.includes('-') || m.includes('/')) || matches[0]
      }
      
      // Also try common salary selectors
      if (!salary) {
        salary = document.querySelector('[itemprop="baseSalary"], [class*="salary" i], [id*="salary" i], [class*="compensation" i], [data-salary]')?.textContent?.trim() || ''
      }
    }
    
    // Clean up extracted salary for generic sites
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '')
        .replace(/^Compensation:\s*/i, '')
        .replace(/^Pay:\s*/i, '')
        .replace(/\s*per\s+(year|month|week|hour|hr|yr|mo|wk)\s*/gi, '/$1 ')
        .replace(/\s*\/\s*(year|month|week|hour|yr|mo|wk)\s*/gi, '/$1 ')
        .trim()
      
      // Extract just the salary range/amount if there's extra text
      const salaryMatch = salary.match(/\$[\d,]+\s*(?:-\s*\$[\d,]+)?(?:\/\s*(?:year|month|week|hour|yr|mo|wk|day|d))?/i)
      if (salaryMatch) {
        salary = salaryMatch[0]
      }
    }
  }

  return { source, company, title, location, salary }
}

function detectSource(url) {
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('indeed.com')) return 'Indeed'
  if (url.includes('greenhouse.io')) return 'Greenhouse'
  if (url.includes('lever.co')) return 'Lever'
  if (url.includes('workable.com')) return 'Workable'
  if (url.includes('euremotejobs.com')) return 'EU Remote Jobs'
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

  saveBtn.disabled = true
  saveBtn.innerHTML = '<span class="spinner"></span>Saving...'
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
    saveBtn.disabled = false
    saveBtn.innerHTML = 'Save to Trackd'
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
  try {
    new URL(url)
  } catch {
    showMessage('error', 'Invalid URL format')
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
    importUrlBtn.disabled = false
    importUrlBtn.innerHTML = 'Import from URL'
  }
})
