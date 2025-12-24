// Content script to extract job data from the current page
// Universal extraction system that works across all job sites

// VERSION MARKER - If you see this, content.js is loaded!
console.log('%c[Trackd Content] ===== CONTENT.JS LOADED v2.0.0 =====', 'color: blue; font-weight: bold; font-size: 14px;')

// ============================================================================
// CONSTANTS
// ============================================================================
const CONSTANTS = {
  MIN_TITLE_LENGTH: 5,
  MAX_TITLE_LENGTH: 200,
  MIN_COMPANY_LENGTH: 2,
  MAX_COMPANY_LENGTH: 80,
  MIN_DESCRIPTION_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 2000,
  CONTAINER_MIN_TEXT_LENGTH: 200,
  CONTAINER_MAX_TEXT_LENGTH: 50000,
  TOP_POSITION_THRESHOLD: 600,
  MIN_FONT_SIZE: 16,
  MAX_LOCATION_LENGTH: 100
}

// Helper function to convert HTML to formatted text preserving structure
function htmlToFormattedText(element) {
  if (!element) return ''

  const html = element.innerHTML

  // Convert HTML elements to text with formatting
  const formatted = html
    .replace(/<\/p>/gi, '</p>\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li>/gi, '<li>• ')
    .replace(/<\/li>/gi, '</li>\n')
    .replace(/<\/h[1-6]>/gi, '</h>\n\n')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')

  // Create temporary div to extract text
  const temp = document.createElement('div')
  temp.innerHTML = formatted
  const text = temp.textContent || temp.innerText || ''

  return text.trim()
}

// Find the most likely job detail container on the page
// This helps distinguish between job detail panels and search result listings
function findJobDetailContainer() {
  // Prioritized list of selectors for job detail containers (generic patterns)
  const detailContainerSelectors = [
    // Detail/view panels (common in split-view layouts)
    '[class*="job-detail" i]',
    '[class*="jobDetail" i]',
    '[class*="job_detail" i]',
    '[class*="job-view" i]',
    '[class*="jobView" i]',
    '[class*="job-content" i]',
    '[class*="job-info" i]',
    '[class*="posting-detail" i]',
    '[class*="job-posting" i]',
    '[class*="listing-detail" i]',
    // Right/main panels in split views
    '[class*="right-panel" i]',
    '[class*="rightPanel" i]',
    '[class*="detail-panel" i]',
    '[class*="detailPanel" i]',
    '[class*="preview-panel" i]',
    '[class*="content-panel" i]',
    // Aria roles and semantic containers
    '[role="article"]',
    'article[class*="job" i]',
    // Generic description containers that might contain job details
    '[class*="description-container" i]',
    '[class*="job-body" i]'
  ]

  for (const selector of detailContainerSelectors) {
    const container = document.querySelector(selector)
    if (container) {
      // Verify this looks like a job detail (has substantial content)
      const text = container.textContent || ''
      if (text.length > CONSTANTS.CONTAINER_MIN_TEXT_LENGTH) {
        return container
      }
    }
  }

  // Fallback: look for a container that has job description keywords
  const allSections = document.querySelectorAll('section, article, [role="main"], main, div[class*="content"]')
  for (const section of allSections) {
    const text = (section.textContent || '').toLowerCase()
    // Look for job description indicators
    if ((text.includes('job description') ||
         text.includes('responsibilities') ||
         text.includes('requirements') ||
         text.includes('qualifications')) &&
        text.length > 500 &&
        text.length < 50000) {
      return section
    }
  }

  return null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Create empty data structure
function createEmptyData() {
  return {
    title: '',
    company: '',
    location: '',
    salary: '',
    description: '',
    url: window.location.href
  }
}

function getPrimaryContainer(jobDetailContainer) {
  return jobDetailContainer ||
    document.querySelector('main, [role="main"], article, [class*="job-detail"]') ||
    document.body
}

// List of common job board/platform names to filter out when detecting company
const JOB_BOARD_NAMES = [
  'ziprecruiter', 'indeed', 'linkedin', 'glassdoor', 'monster', 'careerbuilder',
  'simplyhired', 'dice', 'angel.co', 'stack overflow', 'github jobs', 'remoteok',
  'weworkremotely', 'greenhouse', 'lever', 'workable', 'smartrecruiters',
  'jobvite', 'icims', 'taleo', 'brassring', 'euremotejobs'
]

// Check if a string looks like a job board/platform name
function isJobBoardName(text) {
  if (!text) return false
  const lower = text.toLowerCase().trim()
  return JOB_BOARD_NAMES.some(board => lower.includes(board) || board.includes(lower))
}

function extractStructuredData() {
  const data = { title: '', company: '', location: '', salary: '', description: '' }

  // Try JSON-LD first (most reliable)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of jsonLdScripts) {
    try {
      const structured = JSON.parse(script.textContent)
      const items = Array.isArray(structured) ? structured : [structured]

      // If there's a @graph, extract items from it too
      for (const item of items) {
        if (item['@graph'] && Array.isArray(item['@graph'])) {
          items.push(...item['@graph'])
        }
      }

      for (const item of items) {
        const type = item['@type'] || ''
        if (type === 'JobPosting' || type === 'http://schema.org/JobPosting') {
          // Extract title but validate it's not a search results header
          const candidateTitle = item.title || item.name || ''
          if (candidateTitle && 
              candidateTitle.length >= CONSTANTS.MIN_TITLE_LENGTH &&
              candidateTitle.length <= CONSTANTS.MAX_TITLE_LENGTH &&
              !isSearchResultsHeader(candidateTitle)) {
            data.title = data.title || candidateTitle
          }

          // Extract company but validate it's not a job board
          const candidateCompany = item.hiringOrganization?.name || item.employer?.name || ''
          if (candidateCompany && !isJobBoardName(candidateCompany)) {
            data.company = data.company || candidateCompany
          }

          // Extract location
          const jobLocation = item.jobLocation
          if (jobLocation) {
            if (typeof jobLocation === 'string') {
              data.location = data.location || jobLocation
            } else if (jobLocation.address) {
              const addr = jobLocation.address
              const parts = [
                addr.addressLocality,
                addr.addressRegion,
                addr.addressCountry
              ].filter(Boolean)
              data.location = data.location || parts.join(', ')
            } else if (jobLocation.name) {
              data.location = data.location || jobLocation.name
            }
          }

          // Extract salary
          let baseSalary = item.baseSalary?.value?.value ||
                         item.baseSalary?.value ||
                         item.baseSalary
          if (baseSalary && typeof baseSalary === 'object') {
            const min = baseSalary.minValue || ''
            const max = baseSalary.maxValue || ''
            const currency = baseSalary.currency || '$'
            const unit = baseSalary.unitText || ''
            if (min || max) {
              // Format nicely (convert to K if large numbers)
              let minStr = min
              let maxStr = max
              if (min >= 1000) minStr = (min / 1000).toFixed(min % 1000 === 0 ? 0 : 2) + 'K'
              if (max >= 1000) maxStr = (max / 1000).toFixed(max % 1000 === 0 ? 0 : 2) + 'K'
              data.salary = `${currency}${minStr}${max ? ' - ' + currency + maxStr : ''}${unit ? '/' + unit.toLowerCase() : ''}`
            }
          } else if (baseSalary && typeof baseSalary === 'string') {
            data.salary = baseSalary
          }

          data.description = data.description || item.description || ''

          // If we got valid title and company, we're done
          if (data.title && data.company) {
            return data
          }
        }
      }
    } catch (e) {
      // Continue to next script
    }
  }

  // Try microdata
  const jobPosting = document.querySelector('[itemtype*="JobPosting"], [itemtype*="jobPosting"]')
  if (jobPosting) {
    const microdataTitle = jobPosting.querySelector('[itemprop="title"]')?.textContent?.trim() || ''
    if (microdataTitle && !isSearchResultsHeader(microdataTitle)) {
      data.title = data.title || microdataTitle
    }

    const microdataCompany = jobPosting.querySelector('[itemprop="hiringOrganization"] [itemprop="name"]')?.textContent?.trim() || ''
    if (microdataCompany && !isJobBoardName(microdataCompany)) {
      data.company = data.company || microdataCompany
    }

    data.location = data.location || jobPosting.querySelector('[itemprop="jobLocation"]')?.textContent?.trim() || ''
    data.salary = data.salary || jobPosting.querySelector('[itemprop="baseSalary"]')?.textContent?.trim() || ''
    data.description = data.description || jobPosting.querySelector('[itemprop="description"]')?.textContent?.trim() || ''
  }

  return data
}

function isSearchResultsHeader(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  return /^\d+\s/.test(text) || /\d+\s*(job|position|opening|result)/i.test(text) ||
    lower.includes('now hiring') || lower.includes('job search') || lower.includes('find jobs') ||
    lower.includes('search results') || lower.includes('jobs found') || lower.includes('matching jobs') ||
    lower.includes('jobs in') || /jobs?\s+near\s+/i.test(text) || /hiring\s+in\s+/i.test(text)
}

// Extract title from page content
function extractTitle(structuredData, jobDetailContainer) {
  // Check structured data first, but validate it's not a search results header
  if (structuredData.title && !isSearchResultsHeader(structuredData.title)) {
    return structuredData.title
  }

  // Prefer job detail container if found, otherwise use broader main content
  const primaryContainer = jobDetailContainer ||
    document.querySelector('main, [role="main"], article, [class*="job-detail"], [class*="job-posting"]') ||
    document.body

  // Try headings (h1 > h2 > h3)
  for (const level of ['h1', 'h2', 'h3']) {
    const headings = Array.from(primaryContainer.querySelectorAll(level)).filter(h => {
      const text = h.textContent?.trim() || ''
      return text.length >= CONSTANTS.MIN_TITLE_LENGTH &&
             text.length <= CONSTANTS.MAX_TITLE_LENGTH &&
             !isSearchResultsHeader(text) &&
             !isJobBoardName(text)
    })

    if (headings.length > 0) {
      const titleHeading = headings.find(h => h.className && /title|heading|name/i.test(h.className))
      return (titleHeading || headings[0]).textContent.trim()
    }
  }

  // Try class selectors, itemprop, Open Graph, then document title
  const titleSelectors = [
    '[class*="job-title" i]', '[class*="jobTitle" i]', '[class*="job_title" i]',
    '[class*="position-title" i]', '[class*="posting-title" i]',
    '[id*="job-title" i]', '[data-testid*="title" i]'
  ]
  for (const selector of titleSelectors) {
    const text = primaryContainer.querySelector(selector)?.textContent?.trim() || ''
    if (text.length >= CONSTANTS.MIN_TITLE_LENGTH && 
        text.length <= CONSTANTS.MAX_TITLE_LENGTH && 
        !isSearchResultsHeader(text)) {
      return text
    }
  }
  const itempropTitle = primaryContainer.querySelector('[itemprop="title"]')?.textContent?.trim()
  if (itempropTitle && !isSearchResultsHeader(itempropTitle)) return itempropTitle

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content
  if (ogTitle && ogTitle.length >= CONSTANTS.MIN_TITLE_LENGTH && 
      ogTitle.length <= CONSTANTS.MAX_TITLE_LENGTH && 
      !isSearchResultsHeader(ogTitle)) {
    return ogTitle
  }

  const docTitle = document.title
  if (docTitle) {
    const cleaned = docTitle.split('|')[0].split(' - ')[0].split(' | ')[0]
      .replace(/\s*[-–]\s*(Job|Jobs|Hiring|Now Hiring|Apply Now).*$/i, '')
      .replace(/\s*on\s+(ZipRecruiter|Indeed|LinkedIn|Glassdoor|Monster).*$/i, '')
      .trim()
    if (cleaned.length >= CONSTANTS.MIN_TITLE_LENGTH && 
        cleaned.length <= CONSTANTS.MAX_TITLE_LENGTH && 
        !isSearchResultsHeader(cleaned)) {
      return cleaned
    }
  }

  return ''
}

function isValidCompanyName(text, title) {
  if (!text) return false
  const trimmed = text.trim()
  if (trimmed.length < CONSTANTS.MIN_COMPANY_LENGTH || trimmed.length > CONSTANTS.MAX_COMPANY_LENGTH) return false
  if (isJobBoardName(trimmed) || trimmed === title || trimmed.includes('@')) return false
  if (/^\d+$/.test(trimmed) || /^[A-Z]{2,3}$/.test(trimmed) || /^\$[\d,.]+/i.test(trimmed)) return false
  if (['apply', 'save', 'share', 'view', 'more', 'less', 'search', 'filter', 'show', 'hide', 'close', 'open'].includes(trimmed.toLowerCase())) return false
  if (/^\d+\s*(job|position|opening|result)/i.test(trimmed) || /^[A-Z][a-z]+,?\s*[A-Z]{2}$/.test(trimmed)) return false
  return true
}

function extractCompany(structuredData, title, jobDetailContainer) {
  if (structuredData.company && isValidCompanyName(structuredData.company, title)) {
    return structuredData.company
  }

  const primaryContainer = getPrimaryContainer(jobDetailContainer)

  // Try class selectors, links, itemprop, then generic
  const selectors = [
    '[class*="company-name" i]', '[class*="companyName" i]', '[class*="company_name" i]',
    '[class*="employer-name" i]', '[class*="employerName" i]', '[class*="hiring-company" i]',
    '[class*="organization-name" i]', '[data-testid*="company" i]', '[data-testid*="employer" i]',
    'a[href*="/company/"]', 'a[href*="/employer/"]', 'a[href*="/cmp/"]',
    'a[href*="/companies/"]', 'a[href*="/jobs/company/"]',
    '[itemprop="hiringOrganization"] [itemprop="name"]', '[itemprop="hiringOrganization"]', '[itemprop="employer"]'
  ]

  for (const selector of selectors) {
    const elements = selector.startsWith('a') || selector.includes('itemprop')
      ? document.querySelectorAll(selector)
      : primaryContainer.querySelectorAll(selector)
    for (const el of elements) {
      const text = el.textContent?.trim() || ''
      if (isValidCompanyName(text, title)) {
        return text
      }
    }
  }

  // Look near title
  if (title && primaryContainer) {
    const titleEl = Array.from(primaryContainer.querySelectorAll('h1, h2, h3')).find(el =>
      el.textContent?.trim() === title
    )
    if (titleEl) {
      const parent = titleEl.parentElement
      if (parent) {
        for (const link of parent.querySelectorAll('a')) {
          const text = link.textContent?.trim() || ''
          if (isValidCompanyName(text, title) && text !== title) return text
        }
        const nextSibling = titleEl.nextElementSibling
        if (nextSibling) {
          for (const link of nextSibling.querySelectorAll('a')) {
            const text = link.textContent?.trim() || ''
            if (isValidCompanyName(text, title)) return text
          }
          const siblingText = nextSibling.textContent?.trim() || ''
          if (siblingText.length < 60 && isValidCompanyName(siblingText, title)) {
            return siblingText.split('·')[0].split('•')[0].trim()
          }
        }
      }
    }
  }

  // Generic company/employer classes
  for (const selector of ['[class*="company" i]:not([class*="companies" i])', '[class*="employer" i]']) {
    for (const el of primaryContainer.querySelectorAll(selector)) {
      const text = (el.querySelector('a')?.textContent || el.textContent)?.trim() || ''
      if (text.length < 60 && isValidCompanyName(text, title)) return text
    }
  }

  return ''
}

// Extract location
function extractLocation(structuredData, jobDetailContainer) {
  if (structuredData.location) return structuredData.location

  const primaryContainer = getPrimaryContainer(jobDetailContainer)

  const locationSelectors = [
    '[class*="job-location" i]', '[class*="jobLocation" i]', '[class*="location-info" i]',
    '[itemprop="jobLocation"]', '[data-testid*="location" i]',
    '[class*="location" i]:not([class*="locations" i])', '[data-location]'
  ]
  for (const selector of locationSelectors) {
    const text = primaryContainer.querySelector(selector)?.textContent?.trim() || ''
    if (text && text.length > 0 && text.length < CONSTANTS.MAX_LOCATION_LENGTH) {
      return text.replace(/^Location:\s*/i, '').trim()
    }
  }

  const allText = primaryContainer.textContent || ''
  const patterns = [
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\s*[·•]\s*Remote/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})(?:\s*[·•]\s*(?:Hybrid|On-site|Onsite))?/i,
    /Remote\s*[·•]\s*([A-Z][a-z]+,\s*[A-Z]{2})/i,
    /\b(Remote|Hybrid|On-site|Onsite)\b/i
  ]
  for (const pattern of patterns) {
    const match = allText.match(pattern)
    if (match) return match[0].trim()
  }
  return ''
}

function extractSalary(structuredData, jobDetailContainer) {
  if (structuredData.salary) return structuredData.salary

  const primaryContainer = getPrimaryContainer(jobDetailContainer)
  const salarySelectors = [
    '[class*="salary-range" i]', '[class*="salaryRange" i]', '[class*="compensation" i]',
    '[class*="pay-range" i]', '[class*="salary" i]', '[itemprop="baseSalary"]',
    '[data-testid*="salary" i]', '[data-testid*="pay" i]', '[class*="pay" i]', '[data-salary]'
  ]

  for (const selector of salarySelectors) {
    const text = primaryContainer.querySelector(selector)?.textContent?.trim() || ''
    if (text && text.includes('$')) {
      const match = text.match(/\$[\d,.]+(?:K|k)?\s*-\s*\$[\d,.]+(?:K|k)?(?:\/\s*(?:yr|year|hr|hour|mo|month|wk|week))?/i)
      if (match) return match[0]
    }
  }

  const allText = primaryContainer.textContent || ''
  const patterns = [
    { regex: /\$[\d,.]+(?:K|k)\s*-\s*\$[\d,.]+(?:K|k)?(?:\/\s*(?:yr|year))?/gi, priority: 1 },
    { regex: /\$[\d,]+(?:\.\d+)?\s*-\s*\$[\d,]+(?:\.\d+)?\/\s*(?:yr|year)/gi, priority: 2 },
    { regex: /\$[\d,.]+(?:K|k)?\s*-\s*\$[\d,.]+(?:K|k)?(?:\/\s*(?:hr|hour|mo|month|wk|week))?/gi, priority: 3 }
  ]

  const matches = []
  for (const { regex, priority } of patterns) {
    let match
    while ((match = regex.exec(allText)) !== null) {
      if (!matches.some(m => m.text === match[0])) {
        const isHourly = /\/\s*(?:hr|hour)/i.test(match[0])
        matches.push({ text: match[0], priority: isHourly ? 4 : priority })
      }
    }
  }

  return matches.sort((a, b) => a.priority - b.priority)[0]?.text || ''
}

function extractDescription(structuredData, jobDetailContainer) {
  if (structuredData.description) return structuredData.description

  const primaryContainer = getPrimaryContainer(jobDetailContainer)

  const descSelectors = [
    '[class*="job-description" i]',
    '[class*="jobDescription" i]',
    '[class*="description-content" i]',
    '[itemprop="description"]',
    '[class*="posting-description" i]',
    '[class*="detail-description" i]',
    '[class*="description" i]',
    '[role="article"]',
    'article'
  ]

  for (const selector of descSelectors) {
    const el = primaryContainer.querySelector(selector)
    if (el && el.textContent && el.textContent.length > CONSTANTS.MIN_DESCRIPTION_LENGTH) {
      return htmlToFormattedText(el)
    }
  }

  // Fallback: if we have a job detail container, use its content
  if (jobDetailContainer && jobDetailContainer.textContent && jobDetailContainer.textContent.length > CONSTANTS.CONTAINER_MIN_TEXT_LENGTH) {
    return htmlToFormattedText(jobDetailContainer)
  }

  return ''
}

function extractUniversal() {
  const jobDetailContainer = findJobDetailContainer()
  const structuredData = extractStructuredData()
  const data = createEmptyData()

  data.title = extractTitle(structuredData, jobDetailContainer)
  data.company = extractCompany(structuredData, data.title, jobDetailContainer)
  data.location = extractLocation(structuredData, jobDetailContainer)
  data.salary = extractSalary(structuredData, jobDetailContainer)
  data.description = extractDescription(structuredData, jobDetailContainer)

  // Clean up
  if (data.description) {
    data.description = data.description
      .replace(/Show (more|less)|Apply now|Save job/gi, '')
      .substring(0, CONSTANTS.MAX_DESCRIPTION_LENGTH)
      .trim()
  }
  if (data.salary) {
    data.salary = data.salary.replace(/^(Estimated\s+pay|Salary|Compensation):\s*|Estimated pay/gi, '').trim()
  }
  if (data.location) {
    data.location = data.location.replace(/^Location:\s*/i, '').trim()
  }
  if (data.title && data.location) {
    data.title = data.title.replace(/\s*:\s*[A-Z][a-z]+\s*\([^)]+\)\s*$/, '').trim()
  }

  return data
}

function createExtractorWrapper(extractorName, displayName) {
  return function() {
    const extractor = window.TrackdExtractors?.[extractorName]
    if (typeof extractor === 'function') {
      return extractor()
    }
    console.error(`[Trackd Router] ${displayName} extractor module not loaded!`)
    return createEmptyData()
  }
}

const extractFromZipRecruiter = createExtractorWrapper('extractFromZipRecruiter', 'ZipRecruiter')
const extractFromLinkedIn = createExtractorWrapper('extractFromLinkedIn', 'LinkedIn')
const extractFromLandingJobs = createExtractorWrapper('extractFromLandingJobs', 'Landing.jobs')
const extractFrom4DayWeek = createExtractorWrapper('extractFrom4DayWeek', '4DayWeek')
const extractFromRemoteRocketship = createExtractorWrapper('extractFromRemoteRocketship', 'RemoteRocketship')

const EXTRACTOR_ROUTES = [
  { hostname: 'ziprecruiter.com', extractor: extractFromZipRecruiter, name: 'ZipRecruiter' },
  { hostname: 'linkedin.com', extractor: extractFromLinkedIn, name: 'LinkedIn' },
  { hostname: 'landing.jobs', extractor: extractFromLandingJobs, name: 'Landing.jobs' },
  { hostname: '4dayweek', extractor: extractFrom4DayWeek, name: '4dayweek' },
  { hostname: 'remoterocketship.com', extractor: extractFromRemoteRocketship, name: 'RemoteRocketship' }
]

function extractJobData() {
  console.log('%c[Trackd Router] ===== NEW VERSION LOADED =====', 'color: green; font-weight: bold; font-size: 14px;')
  const hostname = window.location.hostname.toLowerCase()

  for (const route of EXTRACTOR_ROUTES) {
    if (hostname.includes(route.hostname)) {
      console.log(`[Trackd Router] Routing to ${route.name} extractor`)
      try {
        return route.extractor()
      } catch (error) {
        console.error(`[Trackd Router] ${route.name} extractor failed:`, error)
        break
      }
    }
  }

  console.log('[Trackd Router] Routing to Universal extractor (fallback)')
  try {
    return extractUniversal()
  } catch (error) {
    console.error('[Trackd Router] Universal extractor also failed:', error)
    return createEmptyData()
  }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJobData') {
    const jobData = extractJobData()
    sendResponse(jobData)
  }
  return true
})
