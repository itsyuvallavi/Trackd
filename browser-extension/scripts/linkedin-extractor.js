// LinkedIn Job Data Extractor
// IMPORTANT: This extractor is tested and working. Be careful when modifying!
// This file is loaded after content.js, so helper functions (htmlToFormattedText, isJobBoardName) are available

(function() {
  'use strict';

  // Attach to global namespace so content.js can call it
  window.TrackdExtractors = window.TrackdExtractors || {};

  window.TrackdExtractors.extractFromLinkedIn = function() {
    console.log('[Trackd LinkedIn Debug] === LinkedIn extractor called ===')
    const url = window.location.href
    const data = { title: '', company: '', location: '', salary: '', description: '', url }
    
    // Early return if not on a job page
    if (!url.includes('/jobs/')) {
      console.log('[Trackd LinkedIn Debug] Not on a job page, returning empty data')
      return data
    }

    // CRITICAL: Find the top card container directly - this is where all job info is
    // Based on actual HTML: .job-details-jobs-unified-top-card__container--two-pane
    // This container is INSIDE .jobs-search__job-details--container but we want the inner container
    let topCard = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane')
    
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
    
    // If we still can't find the top card, we're probably on the wrong page
    if (!topCard) {
      console.log('[Trackd LinkedIn Debug] Could not find top card container')
      return data
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
