// Content script to extract job data from the current page

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

function extractJobData() {
  const url = window.location.href
  const hostname = window.location.hostname

  let data = {
    title: '',
    company: '',
    location: '',
    salary: '',
    description: '',
    url: url
  }

  // LinkedIn
  if (hostname.includes('linkedin.com')) {
    data.title = document.querySelector('h1.top-card-layout__title, h1.t-24')?.textContent?.trim() || ''
    data.company = document.querySelector('a.topcard__org-name-link, span.topcard__flavor')?.textContent?.trim() || ''

    // Location - clean it up
    let location = document.querySelector('span.topcard__flavor--bullet')?.textContent?.trim() || ''
    location = location.split('·')[0].trim()
    location = location.replace(/\d+\s+(applicant|application)s?.*$/i, '').trim()
    data.location = location

    // Salary - try multiple selectors and clean up
    let salary = document.querySelector('.salary-main-rail__salary-info, .compensation__salary')?.textContent?.trim() || ''
    salary = salary.replace(/^Salary:\s*/i, '').trim() // Remove "Salary:" prefix
    data.salary = salary

    // Description with formatting preserved
    const descEl = document.querySelector('.show-more-less-html__markup, .description__text')
    data.description = descEl ? htmlToFormattedText(descEl) : ''
  }

  // Indeed
  else if (hostname.includes('indeed.com')) {
    data.title = document.querySelector('h1.jobsearch-JobInfoHeader-title')?.textContent?.trim() || ''
    data.company = document.querySelector('[data-company-name="true"]')?.textContent?.trim() || ''
    data.location = document.querySelector('[data-testid="job-location"]')?.textContent?.trim() || ''
    data.salary = document.querySelector('.jobsearch-JobMetadataHeader-item')?.textContent?.trim() || ''

    const descEl = document.querySelector('#jobDescriptionText')
    data.description = descEl ? htmlToFormattedText(descEl) : ''
  }

  // Google Careers
  else if (hostname.includes('google.com') && url.includes('careers')) {
    // Try multiple selectors
    const h2s = Array.from(document.querySelectorAll('h2'))
    const titleElement = h2s.find(el => el.textContent.length > 10 && !el.textContent.includes('Google Careers'))
    data.title = titleElement?.textContent?.trim() || ''
    data.company = 'Google'
    data.location = Array.from(document.querySelectorAll('div, span, p'))
      .find(el => /^[A-Z][a-z]+,\s*[A-Z]{2}$/.test(el.textContent.trim()))?.textContent?.trim() || ''

    // Try to find description section
    const descEl = document.querySelector('div[role="region"]')
    data.description = descEl ? htmlToFormattedText(descEl) : ''
  }

  // Generic extraction for other sites
  else {
    data.title = document.querySelector('h1')?.textContent?.trim() || document.title
    data.company = document.querySelector('[class*="company" i]')?.textContent?.trim() || hostname.replace('www.', '').split('.')[0]
    data.location = document.querySelector('[class*="location" i]')?.textContent?.trim() || ''
    data.salary = document.querySelector('[class*="salary" i], [class*="compensation" i]')?.textContent?.trim() || ''

    const descEl = document.querySelector('[class*="description" i]')
    data.description = descEl ? htmlToFormattedText(descEl) : ''
  }

  // Clean up the data
  if (data.description) {
    // Remove "Show more/less" text
    data.description = data.description.replace(/Show (more|less)/gi, '').trim()
    // Limit to 2000 characters (was 500)
    data.description = data.description.substring(0, 2000)
  }

  return data
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractJobData') {
    const jobData = extractJobData()
    sendResponse(jobData)
  }
  return true
})
