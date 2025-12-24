// RemoteRocketship.com Job Data Extractor
// This file is loaded after content.js, so helper functions (htmlToFormattedText, isJobBoardName) are available

(function() {
  'use strict';

  window.TrackdExtractors = window.TrackdExtractors || {};

  window.TrackdExtractors.extractFromRemoteRocketship = function() {
    const url = window.location.href
    const data = { title: '', company: '', location: '', salary: '', description: '', url }

    const container = document.querySelector('[class*="bg-primary"]') ||
                      document.querySelector('main') ||
                      document.body

    // Title
    const titleEl = container.querySelector('h1[class*="text-3xl"]') ||
                    container.querySelector('h1.font-semibold') ||
                    container.querySelector('h1')
    if (titleEl) data.title = titleEl.textContent.trim()

    // Company
    const companyLinks = container.querySelectorAll('a[class*="text-primary"], a[href*="/company/"]')
    for (const link of companyLinks) {
      const text = link.textContent.trim()
      if (text && text.length > 2 && text.length < 60 && 
          (typeof isJobBoardName !== 'function' || !isJobBoardName(text)) && 
          text !== data.title) {
        data.company = text
        break
      }
    }

    // Location
    const allTags = container.querySelectorAll('[class*="tag"], [class*="badge"], span, div')
    for (const tag of allTags) {
      const text = tag.textContent.trim()
      if (text.match(/^(Remote|.*–\s*Remote|\+\d+\s*more\s*states?)/i) && text.length < 50) {
        data.location = text.replace(/\+\d+\s*more\s*states?/i, '').trim() || 'Remote'
        break
      }
    }

    // Salary
    const salaryMatch = container.textContent.match(/\$[\d]+k?\s*-\s*\$[\d]+k?\s*\/?\s*(?:year|yr)?/i)
    if (salaryMatch) data.salary = salaryMatch[0]

    // Description
    const descEl = container.querySelector('[class*="description"]') ||
                   container.querySelector('article') ||
                   container.querySelector('.prose')
    if (descEl) {
      data.description = (typeof htmlToFormattedText === 'function' 
        ? htmlToFormattedText(descEl) 
        : descEl.textContent)
        .substring(0, 2000)
    }

    return data
  };

  console.log('[Trackd RemoteRocketship] RemoteRocketship extractor module loaded');
})();
