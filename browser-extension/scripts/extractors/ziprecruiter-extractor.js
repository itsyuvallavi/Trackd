// ZipRecruiter Job Data Extractor
// This file is loaded after content.js, so helper functions (htmlToFormattedText, isJobBoardName) are available

(function() {
  'use strict';

  window.TrackdExtractors = window.TrackdExtractors || {};

  window.TrackdExtractors.extractFromZipRecruiter = function() {
    console.log('[Trackd ZipRecruiter] Extractor called')
    const url = window.location.href
    const data = { title: '', company: '', location: '', salary: '', description: '', url }

    // CRITICAL: Use the exact container ZipRecruiter uses for job details
    const detailContainer = document.querySelector('[data-testid="job-details-scroll-container"]')
    
    if (!detailContainer) {
      console.log('[Trackd ZipRecruiter] Detail container not found')
      return data
    }

    console.log('[Trackd ZipRecruiter] Detail container found')

    // TITLE - h2 with font-bold class
    const titleEl = detailContainer.querySelector('h2.font-bold')
    if (titleEl) {
      data.title = titleEl.textContent.trim()
      console.log('[Trackd ZipRecruiter] Title extracted:', data.title)
    }

    // COMPANY - Link with href containing /co/CompanyName/
    // Example: <a href="/co/Relay/Jobs/...">Relay</a>
    const companyLink = detailContainer.querySelector('a[href*="/co/"]')
    if (companyLink) {
      const companyText = companyLink.textContent?.trim() || ''
      if (companyText && companyText.length > 2 && companyText.length < 60 &&
          (typeof isJobBoardName !== 'function' || !isJobBoardName(companyText))) {
        data.company = companyText
        console.log('[Trackd ZipRecruiter] Company extracted:', data.company)
      }
    }

    // LOCATION - p.text-body-md in div.mb-24 after company link
    // Structure: <div class="mb-24"><p class="text-body-md">San Diego, CA • Remote</p></div>
    if (companyLink) {
      // Find the parent container of company link, then look for next div.mb-24
      const companyParent = companyLink.closest('div')
      if (companyParent) {
        let current = companyParent.nextElementSibling
        while (current) {
          if (current.classList.contains('mb-24')) {
            const locP = current.querySelector('p.text-body-md')
            if (locP) {
              const locText = locP.textContent.trim()
              // Location pattern: "City, ST • Remote" or "City, ST"
              if (locText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}/)) {
                data.location = locText
                console.log('[Trackd ZipRecruiter] Location extracted:', data.location)
                break
              }
            }
          }
          current = current.nextElementSibling
        }
      }
    }
    
    // Fallback: find all p.text-body-md and pick the one that looks like location
    if (!data.location) {
      const paragraphs = detailContainer.querySelectorAll('p.text-body-md')
      for (const p of paragraphs) {
        const text = p.textContent.trim()
        // Location pattern: "City, ST • Remote" or "City, ST"
        if (text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}/)) {
          data.location = text
          console.log('[Trackd ZipRecruiter] Location extracted (fallback):', data.location)
          break
        }
      }
    }

    // SALARY - Look for flex container with dollar sign SVG, then p.text-body-md
    // Structure: <div class="flex gap-x-12"><svg>...</svg><p class="text-body-md">$2K/wk</p></div>
    const salaryContainers = detailContainer.querySelectorAll('div.flex.gap-x-12')
    for (const container of salaryContainers) {
      // Check if this container has a dollar sign SVG
      const svg = container.querySelector('svg')
      const salaryText = container.querySelector('p.text-body-md')?.textContent?.trim() || ''
      
      if (svg && salaryText && (salaryText.includes('$') || salaryText.match(/[\d,]+(?:K|k)?/))) {
        // Check if it's actually a salary (not location or other info)
        if (salaryText.match(/\$[\d,.]+(?:K|k)?/i) || salaryText.match(/[\d,]+(?:K|k)?\s*\/\s*(?:wk|yr|year|hr|hour)/i)) {
          data.salary = salaryText
          console.log('[Trackd ZipRecruiter] Salary extracted:', data.salary)
          break
        }
      }
    }
    
    // Fallback: search for salary pattern in detail container
    if (!data.salary) {
      const salaryMatch = detailContainer.textContent.match(/\$[\d,.]+(?:K|k)?\s*-\s*\$[\d,.]+(?:K|k)?(?:\/\s*(?:yr|year|wk|week))?/i) ||
                         detailContainer.textContent.match(/\$[\d,.]+(?:\/\s*(?:yr|year|wk|week|hr|hour))?/i)
      if (salaryMatch) {
        data.salary = salaryMatch[0]
        console.log('[Trackd ZipRecruiter] Salary extracted (fallback):', data.salary)
      }
    }

    // DESCRIPTION - Job description section
    // Find h2 with "Job description" text, then get its next sibling
    let descSection = null
    const descHeaders = detailContainer.querySelectorAll('h2')
    for (const h2 of descHeaders) {
      if (h2.textContent?.trim().toLowerCase().includes('job description')) {
        descSection = h2.nextElementSibling
        break
      }
    }
    
    // Fallback selectors
    if (!descSection) {
      descSection = detailContainer.querySelector('[class*="job-description"]') ||
                   detailContainer.querySelector('div[class*="description"]')
    }
    
    if (descSection) {
      data.description = (typeof htmlToFormattedText === 'function' 
        ? htmlToFormattedText(descSection) 
        : descSection.textContent)
        .substring(0, 2000)
      console.log('[Trackd ZipRecruiter] Description extracted, length:', data.description.length)
    }

    console.log('[Trackd ZipRecruiter] Final extraction:', {
      title: data.title,
      company: data.company,
      location: data.location,
      salary: data.salary,
    })

    return data
  };

  console.log('[Trackd ZipRecruiter] ZipRecruiter extractor module loaded');
})();
