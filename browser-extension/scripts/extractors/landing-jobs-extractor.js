// Landing.jobs Job Data Extractor
// This file is loaded after content.js, so helper functions (htmlToFormattedText, isJobBoardName) are available

(function() {
  'use strict';

  // Attach to global namespace so content.js can call it
  window.TrackdExtractors = window.TrackdExtractors || {};

  window.TrackdExtractors.extractFromLandingJobs = function() {
    console.log('[Trackd Landing.jobs] Extractor called')
    const url = window.location.href
    const data = { title: '', company: '', location: '', salary: '', description: '', url }

    // Container - find the main job content area
    const container = document.querySelector('[class*="JobPage-module"]') ||
                      document.querySelector('main') ||
                      document.body

    // TITLE - Simple approach: find the largest text element near the top that's not a section header
    // Section headers to exclude
    const excludedHeaders = ['skills', 'location', 'salary', 'description', 'overview', 'requirements', 
                             'remote details', 'related', 'more info', 'nice to have', 'required', 
                             'share', 'average hiring process', 'perks', 'description', 'remote details']
    
    // Strategy 1: Look for h1 or large heading near the top
    const titleSelectors = ['h1', 'h2[class*="title"]', '[class*="Title-module"]', 'h2']
    
    for (const selector of titleSelectors) {
      const els = container.querySelectorAll(selector)
      
      for (const el of els) {
        const text = el.textContent?.trim() || ''
        const lower = text.toLowerCase()
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        const fontSize = parseFloat(style.fontSize)
        
        // Must be visible, near top (first 600px), and not a section header
        if (text && 
            text.length > 10 && 
            text.length < 200 &&
            rect.top < 600 &&
            rect.top > 0 &&
            fontSize >= 16 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !excludedHeaders.some(header => lower === header || lower.startsWith(header + ' ')) &&
            !lower.includes('landing.jobs') &&
            !lower.includes('sign up') &&
            !lower.includes('apply')) {
          data.title = text
          console.log('[Trackd Landing.jobs] Title extracted:', data.title)
          break
        }
      }
      if (data.title) break
    }
    
    // Strategy 2: Find largest text element near top (similar to ZipRecruiter approach)
    if (!data.title) {
      const allElements = Array.from(container.querySelectorAll('*'))
      
      const candidates = allElements
        .filter(el => {
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          const fontSize = parseFloat(style.fontSize)
          const text = el.textContent?.trim() || ''
          
          return rect.top < 600 &&
                 rect.top > 0 &&
                 fontSize >= 20 &&
                 text.length > 10 &&
                 text.length < 200 &&
                 style.display !== 'none' &&
                 style.visibility !== 'hidden'
        })
        .map(el => ({
          text: el.textContent?.trim() || '',
          fontSize: parseFloat(window.getComputedStyle(el).fontSize),
          top: el.getBoundingClientRect().top
        }))
        .filter(item => {
          const lower = item.text.toLowerCase()
          return !excludedHeaders.some(header => lower === header || lower.startsWith(header + ' ')) &&
                 !lower.includes('landing.jobs') &&
                 !lower.includes('sign up') &&
                 !lower.includes('apply') &&
                 !lower.includes('skills') &&
                 !lower.includes('nice to have') &&
                 !lower.includes('required') &&
                 !lower.includes('perks') &&
                 !lower.includes('average hiring process') &&
                 !lower.includes('remote details') &&
                 !lower.includes('description') &&
                 !lower.includes('requirements')
        })
        .sort((a, b) => {
          // Sort by font size (larger first), then by position (higher first)
          if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize
          return a.top - b.top
        })
      
      if (candidates.length > 0) {
        data.title = candidates[0].text
        console.log('[Trackd Landing.jobs] Title extracted:', data.title)
      }
    }
    
    // Strategy 3: Extract from URL (slug format: /at/company-slug/job-title-slug)
    if (!data.title) {
      try {
        const pathname = window.location.pathname
        
        // Pattern: /at/company-slug/job-title-slug
        // Example: /at/geoatributo/machine-learning-engineer-generative-ai-rag
        const urlMatch = pathname.match(/\/at\/[^\/]+\/(.+?)(?:\/|$|\?)/i)
        if (urlMatch && urlMatch[1]) {
          // Convert slug to title: "machine-learning-engineer-generative-ai-rag" -> "Machine Learning Engineer (Generative AI & RAG)"
          let titleSlug = urlMatch[1]
          // Replace hyphens with spaces and capitalize words
          let titleFromUrl = titleSlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          
          // Handle special cases like "ai" -> "AI", "rag" -> "RAG"
          titleFromUrl = titleFromUrl
            .replace(/\bAi\b/g, 'AI')
            .replace(/\bRag\b/g, 'RAG')
            .replace(/\bMl\b/g, 'ML')
          
          // Try to detect patterns like "(Generative AI & RAG)" and format them
          // Check for "Generative AI RAG" pattern first (before it gets split by other replacements)
          if (titleFromUrl.includes('Generative AI RAG')) {
            titleFromUrl = titleFromUrl.replace(/Generative AI RAG/g, '(Generative AI & RAG)')
          } else if (titleFromUrl.includes('Generative AI') && !titleFromUrl.includes('(Generative AI')) {
            // Only add parentheses if not already present and not part of the RAG pattern
            titleFromUrl = titleFromUrl.replace(/Generative AI(?! RAG)/g, '(Generative AI)')
          }
          
          if (titleFromUrl && titleFromUrl.length > 5 && titleFromUrl.length < 200) {
            data.title = titleFromUrl
            console.log('[Trackd Landing.jobs] Title extracted from URL:', data.title)
          }
        }
      } catch (e) {
        console.error('[Trackd Landing.jobs] Error extracting title from URL:', e)
      }
    }

    // COMPANY - Simple approach: look for company class or near title
    const companySelectors = [
      '[class*="Title-module_company"]',
      '[class*="company"]',
      'a[href*="/at/"]',
    ]
    
    for (const selector of companySelectors) {
      const companyEls = container.querySelectorAll(selector)
      
      for (const companyEl of companyEls) {
        const companyText = companyEl.textContent?.trim() || ''
        // Clean up company text (remove trailing dashes)
        let cleanCompanyText = companyText.replace(/[-–—]\s*$/, '').trim()
        
        if (cleanCompanyText && 
            cleanCompanyText.length > 2 && 
            cleanCompanyText.length < 60 &&
            (typeof isJobBoardName !== 'function' || !isJobBoardName(cleanCompanyText)) &&
            !cleanCompanyText.toLowerCase().includes('landing.jobs') &&
            !cleanCompanyText.toLowerCase().includes('sign up') &&
            !cleanCompanyText.toLowerCase().includes('apply') &&
            cleanCompanyText !== data.title) {
          data.company = cleanCompanyText
          console.log('[Trackd Landing.jobs] Company extracted:', data.company)
          break
        }
      }
      if (data.company) break
    }
    
    // Fallback: Extract company from URL slug
    if (!data.company) {
      try {
        const pathname = window.location.pathname
        const urlMatch = pathname.match(/\/at\/([^\/]+)\//i)
        if (urlMatch && urlMatch[1]) {
          // Convert slug to company name: "geoatributo" -> "GeoAtributo"
          let companySlug = urlMatch[1]
          let companyFromUrl = companySlug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
          
          if (companyFromUrl && companyFromUrl.length > 2 && companyFromUrl.length < 60) {
            data.company = companyFromUrl
            console.log('[Trackd Landing.jobs] Company extracted from URL:', data.company)
          }
        }
      } catch (e) {
        console.error('[Trackd Landing.jobs] Error extracting company from URL:', e)
      }
    }

    // Location
    const locationEl = container.querySelector('.location-label') ||
                       container.querySelector('[class*="location"]')
    if (locationEl) {
      data.location = locationEl.textContent.trim()
      console.log('[Trackd Landing.jobs] Location extracted:', data.location)
    }

    // Salary
    const salaryEl = container.querySelector('[class*="Header-module_salary"]') ||
                     container.querySelector('[class*="salary"]')
    if (salaryEl) {
      const salaryText = salaryEl.textContent.trim()
      
      // Look for salary range pattern (€25.000 - €35.000 or $50k - $70k)
      const salaryMatch = salaryText.match(/[€$][\d,.]+ ?- ?[€$][\d,.]+/i)
      if (salaryMatch) {
        data.salary = salaryMatch[0]
        console.log('[Trackd Landing.jobs] Salary extracted:', data.salary)
      } else {
        // If no range, try to extract just the salary amount
        const singleSalaryMatch = salaryText.match(/[€$][\d,.]+/i)
        if (singleSalaryMatch) {
          data.salary = singleSalaryMatch[0]
        } else {
          // Fallback: use the whole text if it contains currency symbols
          if (salaryText.includes('€') || salaryText.includes('$')) {
            data.salary = salaryText
          }
        }
      }
    }

    // Description
    const descEl = container.querySelector('[class*="description"]') ||
                   container.querySelector('.Overview') ||
                   container.querySelector('article')
    if (descEl) {
      data.description = (typeof htmlToFormattedText === 'function' 
        ? htmlToFormattedText(descEl) 
        : descEl.textContent)
        .substring(0, 2000)
    }

    console.log('[Trackd Landing.jobs] Final extraction:', {
      title: data.title,
      company: data.company,
      location: data.location,
      salary: data.salary,
    })

    return data
  };

  console.log('[Trackd Landing.jobs] Landing.jobs extractor module loaded');
})();
