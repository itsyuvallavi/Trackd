// LinkedIn Job Data Extractor
// IMPORTANT: This extractor is tested and working. Be careful when modifying!
// This file is loaded after content.js, so helper functions (htmlToFormattedText, isJobBoardName) are available

(function() {
  'use strict';

  // Attach to global namespace so content.js can call it
  window.TrackdExtractors = window.TrackdExtractors || {};

  // Helper function to wait for an element to appear
  function waitForElement(selectors, timeout = 3000) {
    return new Promise((resolve) => {
      // First check if any selector already exists
      for (const selector of selectors) {
        const el = document.querySelector(selector)
        if (el) {
          resolve(el)
          return
        }
      }

      // Set up mutation observer to wait for element
      const observer = new MutationObserver(() => {
        for (const selector of selectors) {
          const el = document.querySelector(selector)
          if (el) {
            observer.disconnect()
            resolve(el)
            return
          }
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, timeout)
    })
  }

  // Fallback extraction for when main selectors don't work
  function extractFallback(data) {
    console.log('[Trackd LinkedIn Debug] Using fallback extraction methods')
    
    // MOST RELIABLE: Try document title FIRST - this is always available on LinkedIn
    // LinkedIn titles are usually: "Job Title at Company | LinkedIn" or "(1) Job Title at Company | LinkedIn"
    const docTitle = document.title
    console.log('[Trackd LinkedIn Debug] Document title:', docTitle)
    
    // Remove notification count like "(1) " at the start
    const cleanTitle = docTitle.replace(/^\(\d+\)\s*/, '')
    
    // Try multiple patterns for LinkedIn title format
    const titlePatterns = [
      /^(.+?)\s+at\s+(.+?)\s*\|/i,           // "Job Title at Company | LinkedIn"
      /^(.+?)\s+-\s+(.+?)\s*\|/,              // "Job Title - Company | LinkedIn"
      /^(.+?)\s+–\s+(.+?)\s*\|/,              // "Job Title – Company | LinkedIn" (en dash)
      /^(.+?)\s*\|\s*(.+?)\s*\|/,             // "Job Title | Company | LinkedIn"
      /^(.+?)\s+hiring\s+at\s+(.+?)\s*\|/i,  // "Company hiring at Location | LinkedIn"
    ]
    
    for (const pattern of titlePatterns) {
      const titleMatch = cleanTitle.match(pattern)
      if (titleMatch) {
        const part1 = titleMatch[1].trim()
        const part2 = titleMatch[2].trim()
        
        // Check if this looks like a job title (not a company or page name)
        if (!data.title && part1.length > 3 && part1.length < 150) {
          data.title = part1
          console.log('[Trackd LinkedIn Debug] Title from document title:', data.title)
        }
        if (!data.company && part2.length >= 2 && part2.length <= 80) {
          // Make sure it's not "LinkedIn" or a job board name
          if (part2.toLowerCase() !== 'linkedin' && 
              (typeof isJobBoardName !== 'function' || !isJobBoardName(part2))) {
            data.company = part2
            console.log('[Trackd LinkedIn Debug] Company from document title:', data.company)
          }
        }
        break
      }
    }
    
    // Try to find title from h1 elements if not found in document title
    if (!data.title) {
      const h1Elements = document.querySelectorAll('h1, h2.t-24, [class*="t-24"][class*="bold"], [class*="job-title"]')
      for (const el of h1Elements) {
        const text = el.textContent?.trim() || ''
        if (text && text.length > 5 && text.length < 150) {
          // Skip page headers that are clearly not job titles
          const lower = text.toLowerCase()
          if (!lower.includes('job search') && 
              !lower.includes('top job picks') &&
              !lower.match(/^\d+\s/) &&
              !lower.includes('you might like')) {
            data.title = text
            console.log('[Trackd LinkedIn Debug] Fallback title from h1:', text)
            break
          }
        }
      }
    }

    // Try to find company from company links if not found in document title
    if (!data.company) {
      const companyLinks = document.querySelectorAll('a[href*="/company/"]')
      for (const link of companyLinks) {
        const text = link.textContent?.trim() || ''
        if (text && text.length >= 2 && text.length <= 60) {
          // Skip "LinkedIn" itself
          if (text.toLowerCase() !== 'linkedin' && 
              (typeof isJobBoardName !== 'function' || !isJobBoardName(text))) {
            data.company = text
            console.log('[Trackd LinkedIn Debug] Fallback company from link:', text)
            break
          }
        }
      }
    }

    // Look for location in page content
    if (!data.location) {
      const locationPatterns = [
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\s*\(/,
        /Location[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/i,
        /\b(Remote|Hybrid|On-site)\b/i
      ]
      const pageText = document.body.textContent || ''
      for (const pattern of locationPatterns) {
        const match = pageText.match(pattern)
        if (match) {
          data.location = match[1]
          console.log('[Trackd LinkedIn Debug] Fallback location:', data.location)
          break
        }
      }
    }

    // Look for salary with $ sign
    if (!data.salary) {
      const pageText = document.body.textContent || ''
      const salaryMatch = pageText.match(/\$[\d,]+(?:K|k)?\s*[-–]\s*\$[\d,]+(?:K|k)?(?:\s*\/\s*(?:yr|year))?/i)
      if (salaryMatch) {
        data.salary = salaryMatch[0]
        console.log('[Trackd LinkedIn Debug] Fallback salary:', data.salary)
      }
    }

    // Try to get description
    const descSelectors = [
      '.jobs-description__content',
      '.show-more-less-html__markup',
      '[class*="description"]',
      '[class*="job-details"]'
    ]
    for (const selector of descSelectors) {
      const el = document.querySelector(selector)
      if (el && el.textContent && el.textContent.length > 100) {
        data.description = (typeof htmlToFormattedText === 'function' 
          ? htmlToFormattedText(el) 
          : el.textContent)
          .replace(/Show (more|less)/gi, '')
          .substring(0, 2000)
          .trim()
        break
      }
    }

    console.log('[Trackd LinkedIn Debug] Fallback extraction result:', {
      title: data.title,
      company: data.company,
      location: data.location,
      salary: data.salary
    })

    return data
  }

  // Wait for LinkedIn page to be ready (title changes from "LinkedIn" to actual job title)
  async function waitForPageReady(timeout = 5000) {
    const startTime = Date.now()
    
    return new Promise((resolve) => {
      const check = () => {
        const title = document.title
        const elapsed = Date.now() - startTime
        
        // LinkedIn is ready when title contains more than just "LinkedIn"
        // e.g., "Web Developer at Company | LinkedIn"
        if (title && title.length > 15 && title.includes('|')) {
          console.log('[Trackd LinkedIn Debug] Page ready, title:', title)
          resolve(true)
          return
        }
        
        // Also check if DOM has job content
        const hasJobContent = document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card__job-title, h1')
        if (hasJobContent && hasJobContent.textContent?.trim().length > 5) {
          console.log('[Trackd LinkedIn Debug] Page ready, found job content in DOM')
          resolve(true)
          return
        }
        
        if (elapsed >= timeout) {
          console.log('[Trackd LinkedIn Debug] Timeout waiting for page, proceeding anyway')
          resolve(false)
          return
        }
        
        // Check again in 200ms
        setTimeout(check, 200)
      }
      
      check()
    })
  }

  window.TrackdExtractors.extractFromLinkedIn = async function() {
    console.log('[Trackd LinkedIn Debug] === LinkedIn extractor called ===')
    const url = window.location.href
    console.log('[Trackd LinkedIn Debug] URL:', url)
    console.log('[Trackd LinkedIn Debug] Initial document title:', document.title)
    
    const data = { title: '', company: '', location: '', salary: '', description: '', url }
    
    // Early return if not on a job page - check for /jobs/ in URL
    if (!url.includes('/jobs/')) {
      console.log('[Trackd LinkedIn Debug] Not on a job page, returning empty data')
      return data
    }
    
    // CRITICAL: Wait for LinkedIn SPA to finish loading
    // The document title starts as just "LinkedIn" and updates when job loads
    await waitForPageReady(5000)
    
    // Now get the updated document title
    const docTitle = document.title
    console.log('[Trackd LinkedIn Debug] Document title after wait:', docTitle)
    console.log('[Trackd LinkedIn Debug] Trying document title extraction')
    
    // Remove notification count like "(1) " at the start
    const cleanTitle = docTitle.replace(/^\(\d+\)\s*/, '')
    console.log('[Trackd LinkedIn Debug] Clean title:', cleanTitle)
    
    // LinkedIn titles: "Job Title at Company | LinkedIn" or variations
    const titlePatterns = [
      /^(.+?)\s+at\s+(.+?)\s*\|/i,           // "Job Title at Company | LinkedIn"
      /^(.+?)\s+-\s+(.+?)\s*\|/,              // "Job Title - Company | LinkedIn"  
      /^(.+?)\s+–\s+(.+?)\s*\|/,              // "Job Title – Company | LinkedIn" (en dash)
      /^(.+?)\s*\|\s*(.+?)\s*\|/,             // "Job Title | Company | LinkedIn"
    ]
    
    for (const pattern of titlePatterns) {
      const match = cleanTitle.match(pattern)
      if (match) {
        const part1 = match[1].trim()
        const part2 = match[2].trim()
        console.log('[Trackd LinkedIn Debug] Title pattern matched:', part1, '|', part2)
        
        if (part1.length > 3 && part1.length < 150) {
          data.title = part1
        }
        if (part2.length >= 2 && part2.length <= 80 && part2.toLowerCase() !== 'linkedin') {
          data.company = part2
        }
        break
      }
    }
    
    // If we got title and company from document title, try to get salary/location quickly
    // then return - no need to wait for DOM elements
    if (data.title && data.company) {
      console.log('[Trackd LinkedIn Debug] Got title/company from document title!')
      
      // Quick scan for salary in page text
      const pageText = document.body?.textContent || ''
      const salaryMatch = pageText.match(/\$[\d,]+(?:K|k)?(?:\/hr)?\s*[-–]\s*\$[\d,]+(?:K|k)?(?:\/hr)?/i)
      if (salaryMatch) {
        data.salary = salaryMatch[0]
        console.log('[Trackd LinkedIn Debug] Found salary:', data.salary)
      }
      
      // Quick scan for location (Remote, city names, etc.)
      const locationMatch = pageText.match(/\b(Remote|Hybrid|On-site)\b/i) ||
                           pageText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})\b/)
      if (locationMatch) {
        data.location = locationMatch[1] || locationMatch[0]
        console.log('[Trackd LinkedIn Debug] Found location:', data.location)
      }
      
      console.log('[Trackd LinkedIn Debug] Returning early with data:', JSON.stringify(data))
      return data
    }
    
    console.log('[Trackd LinkedIn Debug] Document title extraction failed, trying DOM selectors...')

    // LinkedIn job detail selectors - multiple fallbacks for different page layouts
    const topCardSelectors = [
      '.job-details-jobs-unified-top-card__container--two-pane',
      '.jobs-unified-top-card',
      '.job-details-jobs-unified-top-card',
      '[class*="jobs-unified-top-card"]',
      '.jobs-search__job-details--container',
      '.scaffold-layout__detail',
      '[data-job-id]',
      '.jobs-details__main-content'
    ]

    // Wait for the job detail panel to load (LinkedIn is a SPA)
    // Use shorter timeout since document title fallback is reliable
    console.log('[Trackd LinkedIn Debug] Waiting for job details panel to load...')
    let topCard = await waitForElement(topCardSelectors, 1500)
    
    // If not found via waiting, try direct query as last resort
    if (!topCard) {
      for (const selector of topCardSelectors) {
        topCard = document.querySelector(selector)
        if (topCard) break
      }
    }

    // CRITICAL: Find the top card container directly - this is where all job info is
    // Based on actual HTML: .job-details-jobs-unified-top-card__container--two-pane
    // This container is INSIDE .jobs-search__job-details--container but we want the inner container
    if (!topCard) {
      topCard = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane')
    }
    
    // If not found, try finding via detail panel
    if (!topCard) {
      const detailPanel = document.querySelector('.jobs-search__job-details--container') ||
                          document.querySelector('.scaffold-layout__detail') ||
                          document.querySelector('[class*="jobs-details"]')
      
      if (detailPanel) {
        topCard = detailPanel.querySelector('.job-details-jobs-unified-top-card__container--two-pane') ||
                  detailPanel.querySelector('.job-details-jobs-unified-top-card') ||
                  detailPanel.querySelector('[class*="unified-top-card"]')
      }
    }
    
    // If we still can't find the top card, try broader fallback extraction
    if (!topCard) {
      console.log('[Trackd LinkedIn Debug] Could not find top card container, trying fallback extraction')
      return extractFallback(data)
    }

    console.log('[Trackd LinkedIn Debug] Found top card container')

    // TITLE - Must be from the top card, specifically the h1 with job title
    // LinkedIn structure: div.job-details-jobs-unified-top-card__job-title > h1.t-24.t-bold.inline > a
    const titleContainer = topCard.querySelector('.job-details-jobs-unified-top-card__job-title')
    
    if (titleContainer) {
      // The link is inside the h1: h1.t-24.t-bold.inline > a
      const titleLink = titleContainer.querySelector('h1.t-24.t-bold.inline a') || 
                       titleContainer.querySelector('h1 a') || 
                       titleContainer.querySelector('a')
      if (titleLink) {
        const titleText = titleLink.textContent?.trim() || ''
        console.log('[Trackd LinkedIn Debug] Title link found:', titleText)
        if (titleText && titleText.length > 5 && titleText.length < 200) {
          // Double-check it's not a page header
          if (!titleText.toLowerCase().includes('top job picks') &&
              !titleText.toLowerCase().includes('job search') &&
              !titleText.match(/^\d+\s/)) {
            data.title = titleText
            console.log('[Trackd LinkedIn Debug] Title extracted:', data.title)
          }
        }
      }
      
      // Fallback to h1 text if no link
      if (!data.title) {
        const titleH1 = titleContainer.querySelector('h1.t-24.t-bold.inline') || titleContainer.querySelector('h1')
        if (titleH1) {
          const titleText = titleH1.textContent?.trim() || ''
          console.log('[Trackd LinkedIn Debug] Title h1 found:', titleText)
          if (titleText && 
              titleText.length > 5 && 
              titleText.length < 200 &&
              !titleText.toLowerCase().includes('top job picks') &&
              !titleText.toLowerCase().includes('job search') &&
              !titleText.match(/^\d+\s/)) {
            data.title = titleText
            console.log('[Trackd LinkedIn Debug] Title extracted from h1:', data.title)
          }
        }
      }
    } else {
      console.log('[Trackd LinkedIn Debug] Title container not found')
    }

    // COMPANY - Look for company name in the top card
    // LinkedIn structure: div.job-details-jobs-unified-top-card__company-name > a
    const companyContainer = topCard.querySelector('.job-details-jobs-unified-top-card__company-name')
    
    if (companyContainer) {
      const companyLink = companyContainer.querySelector('a')
      if (companyLink) {
        const companyText = companyLink.textContent?.trim() || ''
        console.log('[Trackd LinkedIn Debug] Company link found:', companyText)
        if (companyText && companyText.length >= 2 && companyText.length <= 60 && 
            typeof isJobBoardName === 'function' && !isJobBoardName(companyText)) {
          data.company = companyText
          console.log('[Trackd LinkedIn Debug] Company extracted:', data.company)
        }
      }
    }

    // Fallback: look for any company link in the top card
    if (!data.company) {
      const companyLinks = topCard.querySelectorAll('a[href*="/company/"]')
      console.log('[Trackd LinkedIn Debug] Found', companyLinks.length, 'company links in top card')
      for (const link of companyLinks) {
        const companyText = link.textContent?.trim() || ''
        console.log('[Trackd LinkedIn Debug] Company link candidate:', companyText)
        if (companyText && 
            companyText.length >= 2 && 
            companyText.length <= 60 &&
            (typeof isJobBoardName !== 'function' || !isJobBoardName(companyText)) &&
            companyText !== data.title) {
          data.company = companyText
          console.log('[Trackd LinkedIn Debug] Company extracted from link:', data.company)
          break
        }
      }
    }

    // LOCATION - Look in tertiary description container
    // LinkedIn shows location in: span.tvm__text.tvm__text--low-emphasis with "Denver, CO"
    // It's in: div.job-details-jobs-unified-top-card__tertiary-description-container
    const tertiaryDesc = topCard.querySelector('.job-details-jobs-unified-top-card__tertiary-description-container')
    
    if (tertiaryDesc) {
      // Look for tvm__text spans that contain location patterns (city, state)
      const tvmSpans = tertiaryDesc.querySelectorAll('span.tvm__text')
      console.log('[Trackd LinkedIn Debug] Found', tvmSpans.length, 'tvm spans in tertiary description')
      
      for (const span of tvmSpans) {
        const text = span.textContent?.trim() || ''
        console.log('[Trackd LinkedIn Debug] TVM span text:', text)
        
        // Skip if it's empty or too long
        if (!text || text.length === 0 || text.length > 100) continue
        
        // Skip if it's exactly the company name
        if (data.company && text === data.company) {
          console.log('[Trackd LinkedIn Debug] Skipping - matches company name')
          continue
        }
        
        // Look for location patterns: "City, ST" 
        const cityStatePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*[A-Z]{2}/i
        
        // Check if this is a location (city, state pattern)
        // Skip metadata text like "Reposted", "Over 100 applicants", etc.
        if (cityStatePattern.test(text)) {
          // Make sure it's not metadata text
          if (!text.toLowerCase().includes('applicants') && 
              !text.toLowerCase().includes('reposted') && 
              !text.toLowerCase().includes('promoted') &&
              !text.toLowerCase().includes('actively') &&
              !text.toLowerCase().includes('hours') &&
              !text.toLowerCase().includes('days')) {
            data.location = text
            console.log('[Trackd LinkedIn Debug] Location extracted from TVM:', data.location)
            break
          }
        }
      }
    }

    // Fallback: look for "Remote" in the fit-level-preferences buttons
    if (!data.location) {
      const fitPrefs = topCard.querySelector('.job-details-fit-level-preferences')
      if (fitPrefs) {
        const buttons = fitPrefs.querySelectorAll('button')
        for (const button of buttons) {
          const buttonText = button.textContent?.trim() || ''
          if (buttonText && /Remote|Hybrid|On-site/i.test(buttonText)) {
            // Extract just "Remote", "Hybrid", etc.
            const remoteMatch = buttonText.match(/(Remote|Hybrid|On-site)/i)
            if (remoteMatch) {
              data.location = remoteMatch[0]
              console.log('[Trackd LinkedIn Debug] Location from button (remote):', data.location)
              break
            }
          }
        }
      }
    }
    
    console.log('[Trackd LinkedIn Debug] Final location:', data.location)

    // SALARY - Look in job-details-fit-level-preferences buttons
    // LinkedIn shows salary in: div.job-details-fit-level-preferences > button > span.tvm__text > strong
    const fitPreferences = topCard.querySelector('.job-details-fit-level-preferences')
    
    if (fitPreferences) {
      // Look in buttons for salary
      const buttons = fitPreferences.querySelectorAll('button')
      console.log('[Trackd LinkedIn Debug] Found', buttons.length, 'buttons in fit preferences')
      
      for (const button of buttons) {
        const strong = button.querySelector('strong')
        if (strong) {
          const text = strong.textContent?.trim() || ''
          console.log('[Trackd LinkedIn Debug] Strong text in button:', text)
          
          if (text && text.includes('$')) {
            // Look for salary range like "$140K/yr - $160K/yr" or "$140K - $160K/yr"
            // Pattern 1: "$140K/yr - $160K/yr" (with /yr after each number)
            let salaryMatch = text.match(/\$[\d,]+(?:K|k)?\/\s*(?:yr|year)\s*-\s*\$[\d,]+(?:K|k)?\/\s*(?:yr|year)/i)
            if (salaryMatch) {
              data.salary = salaryMatch[0]
              console.log('[Trackd LinkedIn Debug] Salary extracted from button (format 1):', data.salary)
              break
            }
            // Pattern 2: "$140K - $160K/yr" (with /yr at the end)
            salaryMatch = text.match(/\$[\d,]+(?:K|k)?\s*-\s*\$[\d,]+(?:K|k)?\/\s*(?:yr|year)/i)
            if (salaryMatch) {
              data.salary = salaryMatch[0]
              console.log('[Trackd LinkedIn Debug] Salary extracted from button (format 2):', data.salary)
              break
            }
            // Pattern 3: "$140K - $160K" (no /yr)
            salaryMatch = text.match(/\$[\d,]+(?:K|k)?\s*-\s*\$[\d,]+(?:K|k)?/i)
            if (salaryMatch) {
              data.salary = salaryMatch[0]
              console.log('[Trackd LinkedIn Debug] Salary extracted from button (format 3):', data.salary)
              break
            }
          }
        }
      }
    }

    // Fallback: look for salary in job insights
    if (!data.salary) {
      const jobInsights = topCard.querySelectorAll('.job-details-jobs-unified-top-card__job-insight')
      console.log('[Trackd LinkedIn Debug] Found', jobInsights.length, 'job insights')
      
      for (const insight of jobInsights) {
        const text = insight.textContent?.trim() || ''
        if (text && text.includes('$')) {
          const salaryMatch = text.match(/\$[\d,]+(?:K|k)?\s*-\s*\$[\d,]+(?:K|k)?(?:\/\s*(?:yr|year))?/i)
          if (salaryMatch) {
            data.salary = salaryMatch[0]
            console.log('[Trackd LinkedIn Debug] Salary from job insight:', data.salary)
            break
          }
        }
      }
    }

    // Fallback: check all strong elements with salary pattern
    if (!data.salary) {
      const strongEls = topCard.querySelectorAll('strong')
      console.log('[Trackd LinkedIn Debug] Checking', strongEls.length, 'strong elements')
      for (const strong of strongEls) {
        const text = strong.textContent?.trim() || ''
        if (text && text.includes('$') && text.match(/\$[\d,]+(?:K|k)/i)) {
          console.log('[Trackd LinkedIn Debug] Strong element with $:', text)
          // Pattern 1: "$140K/yr - $160K/yr" (with /yr after each number)
          let salaryMatch = text.match(/\$[\d,]+(?:K|k)?\/\s*(?:yr|year)\s*-\s*\$[\d,]+(?:K|k)?\/\s*(?:yr|year)/i)
          if (salaryMatch) {
            data.salary = salaryMatch[0]
            console.log('[Trackd LinkedIn Debug] Salary from strong (format 1):', data.salary)
            break
          }
          // Pattern 2: "$140K - $160K/yr" (with /yr at the end)
          salaryMatch = text.match(/\$[\d,]+(?:K|k)?\s*-\s*\$[\d,]+(?:K|k)?\/\s*(?:yr|year)/i)
          if (salaryMatch) {
            data.salary = salaryMatch[0]
            console.log('[Trackd LinkedIn Debug] Salary from strong (format 2):', data.salary)
            break
          }
          // Pattern 3: "$140K - $160K" (no /yr)
          salaryMatch = text.match(/\$[\d,]+(?:K|k)?\s*-\s*\$[\d,]+(?:K|k)?/i)
          if (salaryMatch) {
            data.salary = salaryMatch[0]
            console.log('[Trackd LinkedIn Debug] Salary from strong (format 3):', data.salary)
            break
          }
        }
      }
    }
    
    console.log('[Trackd LinkedIn Debug] Final salary:', data.salary)

    // DESCRIPTION - Look for the job description content
    // Need to search in the document, not just topCard (description is below the top card)
    const descSelectors = [
      '.jobs-description__content',
      '.show-more-less-html__markup',
      '.jobs-description-content__text',
      '[class*="description__text"]',
      '[class*="job-description"]',
    ]

    // Find the main container first (jobs-search__job-details--container)
    const mainContainer = document.querySelector('.jobs-search__job-details--container') ||
                          document.querySelector('.scaffold-layout__detail') ||
                          document.body

    for (const selector of descSelectors) {
      const descEl = mainContainer.querySelector(selector)
      if (descEl && descEl.textContent && descEl.textContent.length > 100) {
        data.description = (typeof htmlToFormattedText === 'function' 
          ? htmlToFormattedText(descEl) 
          : descEl.textContent)
          .replace(/Show (more|less)/gi, '')
          .substring(0, 2000)
          .trim()
        break
      }
    }
    
    // If we didn't get title or company, try fallback methods
    if (!data.title || !data.company) {
      console.log('[Trackd LinkedIn Debug] Missing title or company, trying fallback methods')
      const fallbackData = extractFallback({ ...data })
      if (!data.title && fallbackData.title) {
        data.title = fallbackData.title
        console.log('[Trackd LinkedIn Debug] Got title from fallback:', data.title)
      }
      if (!data.company && fallbackData.company) {
        data.company = fallbackData.company
        console.log('[Trackd LinkedIn Debug] Got company from fallback:', data.company)
      }
      if (!data.location && fallbackData.location) {
        data.location = fallbackData.location
      }
      if (!data.salary && fallbackData.salary) {
        data.salary = fallbackData.salary
      }
      if (!data.description && fallbackData.description) {
        data.description = fallbackData.description
      }
    }
    
    console.log('[Trackd LinkedIn Debug] Final extraction:', {
      title: data.title,
      company: data.company,
      location: data.location,
      salary: data.salary,
    })

    return data
  };

  console.log('[Trackd LinkedIn] LinkedIn extractor module loaded');
})();
