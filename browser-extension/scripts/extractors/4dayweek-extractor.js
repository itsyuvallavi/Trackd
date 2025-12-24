// 4DayWeek.io Job Data Extractor
// This file is loaded after content.js, so helper functions (htmlToFormattedText) are available

(function() {
  'use strict';

  window.TrackdExtractors = window.TrackdExtractors || {};

  window.TrackdExtractors.extractFrom4DayWeek = function() {
    const url = window.location.href
    const data = { title: '', company: '', location: '', salary: '', description: '', url }

    const container = document.querySelector('.job-page') ||
                      document.querySelector('.main-container-wrapper') ||
                      document.querySelector('main') ||
                      document.body

    // Title
    const titleEl = container.querySelector('h1')
    if (titleEl) data.title = titleEl.textContent.trim()

    // Company
    const companyEl = container.querySelector('a.btn-link.success') ||
                      container.querySelector('a.btn-hug') ||
                      container.querySelector('[class*="company"] a')
    if (companyEl) data.company = companyEl.textContent.trim()

    // Location
    const badges = container.querySelectorAll('.badge, [class*="tag"], [class*="label"]')
    for (const badge of badges) {
      const text = badge.textContent.trim()
      if (text.match(/(Remote|Hybrid|On-site|Auckland|London|New York|San Francisco)/i) && text.length < 50) {
        data.location = text
        break
      }
    }

    // Salary
    const allText = container.textContent
    const salaryMatch = allText.match(/\$[\d,]+(?:k|K)?\s*(?:-|to)\s*\$[\d,]+(?:k|K)?/i) ||
                        allText.match(/[\d,]+(?:k|K)?\s*(?:-|to)\s*[\d,]+(?:k|K)?\s*(?:USD|GBP|EUR|AUD|NZD)/i)
    if (salaryMatch) data.salary = salaryMatch[0]

    // Description
    const descEl = container.querySelector('[class*="description"]') ||
                   container.querySelector('.about, .overview') ||
                   container.querySelector('article')
    if (descEl) {
      data.description = (typeof htmlToFormattedText === 'function' 
        ? htmlToFormattedText(descEl) 
        : descEl.textContent)
        .substring(0, 2000)
    }

    return data
  };

  console.log('[Trackd 4DayWeek] 4DayWeek extractor module loaded');
})();
