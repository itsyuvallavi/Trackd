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

  // LinkedIn - most comprehensive extraction with aggressive fallbacks
  if (hostname.includes('linkedin.com') && url.includes('/jobs/')) {
    // Try multiple selectors for job title - comprehensive list
    data.title = document.querySelector('h1.job-details-jobs-unified-top-card__job-title')?.textContent?.trim()
      || document.querySelector('.job-details-jobs-unified-top-card__job-title-link')?.textContent?.trim()
      || document.querySelector('h1.topcard__title')?.textContent?.trim()
      || document.querySelector('.top-card-layout__title')?.textContent?.trim()
      || document.querySelector('h1.t-24')?.textContent?.trim()
      || document.querySelector('h1.top-card-layout__title')?.textContent?.trim()
      || document.querySelector('h1[class*="job-title" i]')?.textContent?.trim()
      || document.querySelector('h1[class*="title" i]')?.textContent?.trim()
      || document.querySelector('h2[class*="job-title" i]')?.textContent?.trim()
      || ''
    
    // Try multiple selectors for company - comprehensive with new patterns
    data.company = document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim()
      || document.querySelector('.job-details-jobs-unified-top-card__company-name a')?.textContent?.trim()
      || document.querySelector('.job-details-jobs-unified-top-card__primary-description-without-tagline a')?.textContent?.trim()
      || document.querySelector('.job-details-jobs-unified-top-card__primary-description-without-tagline span')?.textContent?.trim()
      || document.querySelector('a.topcard__org-name-link')?.textContent?.trim()
      || document.querySelector('.topcard__org-name-link')?.textContent?.trim()
      || document.querySelector('.jobs-company__box a')?.textContent?.trim()
      || document.querySelector('a[href*="/company/"]')?.textContent?.trim()
      || document.querySelector('[class*="company-name" i]')?.textContent?.trim()
      || document.querySelector('[class*="company" i] a')?.textContent?.trim()
      || ''

    // Location - clean it up
    let locationRaw = document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim()
      || document.querySelector('.topcard__flavor--bullet')?.textContent?.trim()
      || document.querySelector('[data-test-id="job-location"]')?.textContent?.trim()
      || document.querySelector('[class*="location" i]')?.textContent?.trim()
      || ''
    
    if (locationRaw) {
      data.location = locationRaw.split('·')[0].trim()
        .split('|')[0].trim()
        .replace(/\d+\s+(applicant|application|viewer)s?.*$/i, '')
        .replace(/\d+\s+(week|day|hour)s?\s+ago.*$/i, '')
        .replace(/^Location:\s*/i, '')
        .trim()
    } else {
      data.location = ''
    }

    // Salary - try multiple selectors and clean up
    let salary = document.querySelector('.job-details-jobs-unified-top-card__salary-info')?.textContent?.trim()
      || document.querySelector('.salary-main-rail__data-body')?.textContent?.trim()
      || document.querySelector('.compensation__salary')?.textContent?.trim()
      || document.querySelector('.salary-main-rail__salary-info')?.textContent?.trim()
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
    data.salary = salary

    // Description with formatting preserved
    const descEl = document.querySelector('.show-more-less-html__markup') 
      || document.querySelector('.description__text')
      || document.querySelector('.jobs-description__text')
    data.description = descEl ? htmlToFormattedText(descEl) : ''
    
    // AGGRESSIVE Fallback: If title/company not found, try very generic approaches
    if (!data.title || !data.company) {
      const mainContent = document.querySelector('main') 
        || document.querySelector('[role="main"]') 
        || document.querySelector('.jobs-search__job-details')
        || document.querySelector('[class*="job-details" i]')
        || document.body
      
      if (!data.title) {
        const h1s = Array.from(mainContent.querySelectorAll('h1')).filter(h1 => {
          const text = h1.textContent?.trim() || ''
          return text.length > 5 && text.length < 150 && 
                 !text.toLowerCase().includes('linkedin') &&
                 !text.toLowerCase().includes('home') &&
                 !text.toLowerCase().includes('sign in')
        })
        
        if (h1s.length > 0) {
          data.title = h1s[0].textContent.trim()
        }
      }
      
      // Very aggressive company finding
      if (!data.company) {
        // Strategy 1: Look for company links anywhere
        const companyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]')).filter(link => {
          const text = link.textContent?.trim() || ''
          return text.length > 1 && text.length < 60 && !text.includes('@')
        })
        
        if (companyLinks.length > 0) {
          data.company = companyLinks[0].textContent.trim()
        }
        
        // Strategy 2: Look near title
        if (!data.company && data.title) {
          const titleEl = Array.from(document.querySelectorAll('h1, h2')).find(el => 
            el.textContent?.trim() === data.title
          )
          
          if (titleEl) {
            let container = titleEl.parentElement
            for (let i = 0; i < 3 && container; i++) {
              const candidates = container.querySelectorAll('a, span, div, p, strong, b')
              for (const el of candidates) {
                const text = el.textContent?.trim() || ''
                if (text.length >= 2 && text.length <= 60 &&
                    !text.includes('@') &&
                    !text.match(/^\d+$/) &&
                    !text.match(/^\d+\s*(day|week|month|year|hour|minute|applicant|application)/i) &&
                    !['apply', 'save', 'share', 'more', 'less', 'view', 'hide', 'show'].includes(text.toLowerCase()) &&
                    text !== data.title &&
                    !text.includes('http') &&
                    !text.match(/^[A-Z]{2,3}$/)) {
                  data.company = text
                  break
                }
              }
              if (data.company) break
              container = container.parentElement
            }
          }
        }
        
        // Strategy 3: Extract from text patterns
        if (!data.company) {
          const allText = document.body.textContent || ''
          const companyMatch = allText.match(/(?:at|with|from)\s+([A-Z][a-zA-Z\s&,.-]{2,50})(?:\s|$|,|\.)/i)
          if (companyMatch && companyMatch[1]) {
            data.company = companyMatch[1].trim()
          }
        }
      }
    }
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

  // Generic extraction for other sites - comprehensive approach
  else {
    // Try structured data (JSON-LD) first - many sites use this
    const jsonLd = document.querySelector('script[type="application/ld+json"]')
    if (jsonLd) {
      try {
        const structured = JSON.parse(jsonLd.textContent)
        if (Array.isArray(structured)) {
          const jobPosting = structured.find(item => item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting')
          if (jobPosting) {
            data.title = jobPosting.title || jobPosting.name || ''
            data.company = jobPosting.hiringOrganization?.name || jobPosting.employer?.name || ''
            data.location = jobPosting.jobLocation?.address?.addressLocality || 
                          jobPosting.jobLocation?.address?.addressRegion ||
                          jobPosting.jobLocation?.name || ''
            let baseSalary = jobPosting.baseSalary?.value?.value || 
                            jobPosting.baseSalary?.value || 
                            jobPosting.baseSalary
            if (baseSalary && typeof baseSalary === 'object') {
              data.salary = `${baseSalary.minValue || ''}${baseSalary.maxValue ? ' - ' + baseSalary.maxValue : ''} ${baseSalary.currency || ''}`
            } else if (baseSalary) {
              data.salary = String(baseSalary)
            }
            data.description = jobPosting.description || ''
          }
        } else if (structured['@type'] === 'JobPosting' || structured['@type'] === 'http://schema.org/JobPosting') {
          data.title = structured.title || structured.name || ''
          data.company = structured.hiringOrganization?.name || structured.employer?.name || ''
          data.location = structured.jobLocation?.address?.addressLocality || 
                        structured.jobLocation?.address?.addressRegion ||
                        structured.jobLocation?.name || ''
          let baseSalary = structured.baseSalary?.value?.value || 
                          structured.baseSalary?.value || 
                          structured.baseSalary
          if (baseSalary && typeof baseSalary === 'object') {
            data.salary = `${baseSalary.minValue || ''}${baseSalary.maxValue ? ' - ' + baseSalary.maxValue : ''} ${baseSalary.currency || ''}`
          } else if (baseSalary) {
            data.salary = String(baseSalary)
          }
          data.description = structured.description || ''
        }
      } catch {
        // If JSON parsing fails, continue with other methods
      }
    }
    
    // If we didn't get complete data from structured data, try other methods
    if (!data.title || !data.company) {
      // Try Open Graph meta tags
      data.title = data.title || document.querySelector('meta[property="og:title"]')?.content || ''
      data.company = data.company || document.querySelector('meta[property="og:site_name"]')?.content || ''
      
      // Try to find h1 (most common for job titles)
      if (!data.title) {
        const h1s = Array.from(document.querySelectorAll('h1')).filter(h1 => {
          const text = h1.textContent?.trim() || ''
          // Filter out navigation, headers, etc.
          return text.length > 5 && text.length < 150 && 
                 !text.toLowerCase().includes('home') &&
                 !text.toLowerCase().includes('about') &&
                 !text.toLowerCase().includes('contact') &&
                 !text.toLowerCase().includes('sign in') &&
                 !text.toLowerCase().includes('login') &&
                 !text.toLowerCase().includes('menu')
        })
        if (h1s.length > 0) {
          data.title = h1s[0].textContent.trim()
        }
      }
      
      // Fallback to document title if still no title
      if (!data.title) {
        data.title = document.title.split('|')[0].split('-')[0].trim()
      }
      
      // Try to find company name - look near the title
      if (!data.company && data.title) {
        // Find the title element
        const titleEl = Array.from(document.querySelectorAll('h1, h2')).find(el => 
          el.textContent?.trim() === data.title
        )
        
        if (titleEl) {
          const container = titleEl.closest('article, section, main, [role="main"], .content, .job-detail, .job-posting, .posting') || titleEl.parentElement
          
          // Look for company in nearby elements
          const nearby = container.querySelectorAll('a, span, div, p, h2, h3, strong, b')
          for (const el of nearby) {
            const text = el.textContent?.trim() || ''
            // Heuristic: company names are usually 2-50 chars, not emails, not dates, not common UI words
            if (text.length >= 2 && text.length <= 50 &&
                !text.includes('@') &&
                !text.match(/^\d+\s*(day|week|month|year|hour|minute)/i) &&
                !text.match(/^[A-Z]{2,3}$/) && // Not state codes
                !['apply', 'save', 'share', 'more', 'less', 'view', 'hide', 'show', 'close', 'open', 'back', 'next', 'previous'].includes(text.toLowerCase()) &&
                text !== data.title &&
                !text.match(/^\d+$/) && // Not just numbers
                !text.includes('http') &&
                !text.includes('www.')) {
              data.company = text
              break
            }
          }
        }
      }
      
      // Fallback: try common class/attribute patterns
      if (!data.title) {
        data.title = document.querySelector('[itemprop="title"], [class*="title" i], [id*="title" i]')?.textContent?.trim() || ''
      }
      if (!data.company) {
        data.company = document.querySelector('[itemprop="hiringOrganization"], [class*="company" i], [id*="company" i], [data-company]')?.textContent?.trim() || 
                      document.querySelector('meta[property="og:site_name"]')?.content ||
                      hostname.replace('www.', '').split('.')[0]
      }
    }
    
    // Try to find location - look for common patterns
    if (!data.location) {
      // Look for city, state patterns
      const locationPatterns = [
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/g, // "City, ST"
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z][a-z]+)\b/g, // "City, State"
        /Remote/i,
        /Hybrid/i,
        /On-site/i
      ]
      
      const allText = document.body.textContent || ''
      for (const pattern of locationPatterns) {
        const match = allText.match(pattern)
        if (match) {
          data.location = match[0]
          break
        }
      }
      
      // Also try common location selectors
      if (!data.location) {
        data.location = document.querySelector('[itemprop="jobLocation"], [class*="location" i], [id*="location" i], [data-location]')?.textContent?.trim() || ''
      }
    }
    
    // Try to find salary - look for $ patterns
    if (!data.salary) {
      const salaryPattern = /\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\/\s*(?:hr|hour|year|yr|month|mo|week|wk|day))?/gi
      const allText = document.body.textContent || ''
      const matches = allText.match(salaryPattern)
      if (matches && matches.length > 0) {
        // Take the first match that looks like a salary range
        data.salary = matches.find(m => m.includes('-') || m.includes('/')) || matches[0]
      }
      
      // Also try common salary selectors
      if (!data.salary) {
        data.salary = document.querySelector('[itemprop="baseSalary"], [class*="salary" i], [id*="salary" i], [class*="compensation" i], [data-salary]')?.textContent?.trim() || ''
      }
    }
    
    // Try to find description
    if (!data.description) {
      // Try multiple common selectors
      const descSelectors = [
        '[itemprop="description"]',
        '[class*="description" i]',
        '[id*="description" i]',
        '[class*="job-description" i]',
        '[class*="posting-description" i]',
        '[class*="detail" i]',
        'article',
        '[role="article"]',
        '.content',
        '.main-content'
      ]
      
      for (const selector of descSelectors) {
        const el = document.querySelector(selector)
        if (el && el.textContent && el.textContent.length > 100) {
          data.description = htmlToFormattedText(el)
          break
        }
      }
    }
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
