'use server'

import * as cheerio from 'cheerio'
import puppeteer from 'puppeteer'
import { JobSource } from '@prisma/client'

export interface ScrapedJobData {
  title: string
  company: string
  location?: string
  description?: string
  salary?: string
  source: JobSource
  url: string
}

// Sites that require JavaScript rendering or block simple fetch
const JS_SITES = ['google.com/about/careers', 'greenhouse.io', 'lever.co', 'euremotejobs.com']

function requiresJavaScript(url: string): boolean {
  return JS_SITES.some(site => url.includes(site))
}

export async function scrapeJobUrl(url: string): Promise<{ success: boolean; data?: ScrapedJobData; error?: string }> {
  try {
    // Validate URL
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Use Puppeteer for JavaScript-heavy sites
    if (requiresJavaScript(url)) {
      return await scrapeWithPuppeteer(url, hostname)
    }

    // Use regular fetch for static sites
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) {
      return { success: false, error: `Failed to fetch URL: ${response.status} ${response.statusText}` }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Determine source from URL
    let source: JobSource = 'OTHER'

    if (hostname.includes('linkedin.com')) {
      source = 'LINKEDIN'
      return scrapeLinkedIn($, url)
    } else if (hostname.includes('indeed.com')) {
      source = 'INDEED'
      return scrapeIndeed($, url)
    } else {
      source = 'COMPANY_SITE'
      return scrapeGeneric($, url, source)
    }
  } catch (error) {
    console.error('Scraping error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape job URL'
    }
  }
}

async function scrapeWithPuppeteer(url: string, hostname: string): Promise<{ success: boolean; data?: ScrapedJobData; error?: string }> {
  let browser
  try {
    console.log('Launching Puppeteer for:', url)

    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ],
    })

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 })

    console.log('Navigating to page...')
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    })

    // Wait for content to load - use a more flexible wait
    await new Promise(resolve => setTimeout(resolve, 3000))

    console.log('Extracting content...')
    const html = await page.content()
    const $ = cheerio.load(html)

    // Debug: log some basic info
    const pageTitle = $('title').text()
    const h1Count = $('h1').length
    const h2Count = $('h2').length
    console.log('Page title:', pageTitle)
    console.log('H1 count:', h1Count, 'H2 count:', h2Count)

    if (hostname.includes('google.com')) {
      return scrapeGoogle($, url)
    } else {
      return scrapeGeneric($, url, 'COMPANY_SITE')
    }
  } catch (error) {
    console.error('Puppeteer scraping error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Failed to load page: ${errorMessage}. Try entering details manually.`
    }
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

function scrapeLinkedIn($: cheerio.CheerioAPI, url: string): { success: boolean; data?: ScrapedJobData; error?: string } {
  try {
    // Check if this is a job list/collection page rather than a specific job
    if (url.includes('/collections/') || url.includes('currentJobId')) {
      return {
        success: false,
        error: 'This appears to be a LinkedIn job list page. Please click on a specific job to get its direct URL (should look like linkedin.com/jobs/view/12345...).'
      }
    }

    const title = $('h1.top-card-layout__title').text().trim() ||
                  $('h1.topcard__title').text().trim() ||
                  $('h2.topcard__title').text().trim() ||
                  $('h1.t-24').text().trim()

    const company = $('a.topcard__org-name-link').text().trim() ||
                    $('span.topcard__flavor').text().trim() ||
                    $('.topcard__org-name-link').text().trim() ||
                    $('a.sub-nav-cta__optional-url').text().trim()

    let location = $('span.topcard__flavor--bullet').text().trim() ||
                   $('.topcard__flavor--bullet').first().text().trim() ||
                   $('span.sub-nav-cta__meta-text').text().trim()

    // Clean up location - remove applicant count and other metadata
    location = location.split('·')[0].trim() // Remove everything after bullet point
    location = location.replace(/\d+\s+(applicant|application)s?.*$/i, '').trim() // Remove "X applicants"
    location = location.replace(/\(.*?\)/g, '').trim() // Remove anything in parentheses

    // Get description with better formatting - convert HTML breaks to newlines
    let description = ''
    const descEl = $('.description__text').first().length ? $('.description__text').first() :
                    $('.show-more-less-html__markup').first().length ? $('.show-more-less-html__markup').first() :
                    $('div.description').first()

    if (descEl.length) {
      // Convert common block elements to newlines before extracting text
      const descHtml = descEl.html() || ''
      const withBreaks = descHtml
        .replace(/<\/p>/gi, '</p>\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<li>/gi, '<li>• ')  // Add bullet point before each list item
        .replace(/<\/li>/gi, '</li>\n')
        .replace(/<\/h[1-6]>/gi, '</h>\n\n')
        .replace(/<ul>/gi, '\n')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol>/gi, '\n')
        .replace(/<\/ol>/gi, '\n')

      const tempDiv = cheerio.load(`<div>${withBreaks}</div>`)
      description = tempDiv.text().trim()
    }

    // Clean up description
    description = description.replace(/Show (more|less)/gi, '').trim() // Remove "Show more/less" text
    description = description.replace(/ {2,}/g, ' ').trim() // Collapse multiple spaces (not newlines)
    description = description.replace(/\n{3,}/g, '\n\n').trim() // Collapse multiple newlines to max 2

    // Try multiple salary selectors for LinkedIn
    let salary = $('.salary-main-rail__salary-info').text().trim() ||
                 $('.compensation__salary').text().trim() ||
                 $('[data-testid="salary-info"]').text().trim() ||
                 $('.job-details-jobs-unified-top-card__salary-info').text().trim() ||
                 $('.salary-main-rail__data-body').text().trim() ||
                 ''
    
    // Search in job insights for salary patterns
    if (!salary) {
      $('.job-details-jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight-text').each((_, el) => {
        const text = $(el).text().trim()
        if (text.match(/\$[\d,]+/)) {
          salary = text
          return false // break
        }
      })
    }
    
    // Try metadata list items
    if (!salary) {
      $('.topcard__flavor--metadata-list-item, .job-details-jobs-unified-top-card__job-insight').each((_, el) => {
        const text = $(el).text().toLowerCase()
        if (text.includes('$') || text.includes('salary') || text.includes('compensation')) {
          salary = $(el).text().trim()
          return false // break
        }
      })
    }
    
    // Clean up salary text - remove prefixes and normalize format
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '')
        .replace(/^Compensation:\s*/i, '')
        .replace(/\s*per\s+(year|month|week|hour|hr|yr|mo|wk)\s*/gi, '/$1 ')
        .replace(/\s*\/\s*(year|month|week|hour|yr|mo|wk)\s*/gi, '/$1 ')
        .replace(/\s+/g, ' ')
        .trim()
      
      // Extract just the salary range/amount if there's extra text
      const salaryMatch = salary.match(/\$[\d,]+\s*(?:-\s*\$[\d,]+)?(?:\/\s*(?:year|month|week|hour|yr|mo|wk|day|d))?/i)
      if (salaryMatch) {
        salary = salaryMatch[0]
      }
    }

    if (!title || !company) {
      return {
        success: false,
        error: 'Could not extract job title or company from LinkedIn. Make sure you\'re using a direct job URL (not a list or search page).'
      }
    }

    return {
      success: true,
      data: {
        title,
        company,
        location: location || undefined,
        description: description || undefined,
        salary: salary || undefined,
        source: 'LINKEDIN',
        url,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to parse LinkedIn job posting' }
  }
}

function scrapeIndeed($: cheerio.CheerioAPI, url: string): { success: boolean; data?: ScrapedJobData; error?: string } {
  try {
    const title = $('h1.jobsearch-JobInfoHeader-title').text().trim() ||
                  $('.jobsearch-JobInfoHeader-title').text().trim()

    const company = $('div[data-company-name="true"]').text().trim() ||
                    $('.jobsearch-InlineCompanyRating-companyHeader').text().trim()

    const location = $('div[data-testid="job-location"]').text().trim() ||
                     $('.jobsearch-JobInfoHeader-subtitle').first().text().trim()

    const description = $('#jobDescriptionText').text().trim()

    // Try multiple approaches for Indeed salary
    let salary = $('.jobsearch-JobMetadataHeader-item').filter((_, el) => {
      const text = $(el).text().toLowerCase()
      return text.includes('$') || text.includes('salary') || text.includes('hour') || text.includes('year')
    }).first().text().trim() ||
    $('[data-testid="job-salary"]').text().trim() ||
    $('.jobsearch-JobMetadataHeader-iconLabel').filter((_, el) => {
      const text = $(el).text()
      return text.includes('$') || /^\$[\d,]+/.test(text)
    }).first().text().trim()
    
    // Clean up salary text
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '').replace(/^Pay:\s*/i, '').trim()
    }

    if (!title || !company) {
      return { success: false, error: 'Could not extract job title or company from Indeed' }
    }

    return {
      success: true,
      data: {
        title,
        company,
        location: location || undefined,
        description: description || undefined,
        salary: salary || undefined,
        source: 'INDEED',
        url,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to parse Indeed job posting' }
  }
}

function scrapeGoogle($: cheerio.CheerioAPI, url: string): { success: boolean; data?: ScrapedJobData; error?: string } {
  try {
    // Google Careers uses various selectors - try them all
    let title = $('h2').filter((_, el) => {
      const text = $(el).text().trim()
      return text.length > 5 && !text.includes('Google') && !text.includes('|')
    }).first().text().trim()

    // Alternative selectors
    if (!title) {
      title = $('[role="heading"]').filter((_, el) => {
        const text = $(el).text().trim()
        return text.length > 10 && !text.includes('Google Careers')
      }).first().text().trim()
    }

    // Try looking in structured data
    if (!title) {
      const scriptTags = $('script[type="application/ld+json"]')
      scriptTags.each((_, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}')
          if (json.title) {
            title = json.title
            return false // break
          }
        } catch (e) {
          // ignore JSON parse errors
        }
      })
    }

    const company = 'Google'

    // Location extraction
    let location = ''
    $('div, span, p').each((_, el) => {
      const text = $(el).text().trim()
      if (text.match(/^[A-Z][a-z]+,\s*[A-Z]{2}$/)) { // e.g., "Mountain View, CA"
        location = text
        return false
      }
    })

    // Description extraction
    const description = $('div[role="region"]').text().trim() ||
                       $('p').filter((_, el) => $(el).text().length > 100).first().text().trim()

    // Try to find salary for Google Careers
    let salary = $('[class*="salary" i]').first().text().trim() ||
                 $('[class*="compensation" i]').first().text().trim() ||
                 $('div, span, p').filter((_, el) => {
                   const text = $(el).text().trim()
                   return /^\$[\d,]+/.test(text) || (text.includes('$') && (text.includes('k') || text.includes('hour') || text.includes('year') || text.includes('range')))
                 }).first().text().trim()
    
    // Clean up salary text
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '').replace(/^Compensation:\s*/i, '').trim()
    }

    if (!title || title.length < 5) {
      return {
        success: false,
        error: 'Could not extract job title from Google Careers page. Try entering the details manually.'
      }
    }

    return {
      success: true,
      data: {
        title,
        company,
        location: location || undefined,
        description: description ? description.substring(0, 500) : undefined,
        salary: salary || undefined,
        source: 'COMPANY_SITE',
        url,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to parse Google Careers job posting' }
  }
}

function scrapeGeneric($: cheerio.CheerioAPI, url: string, source: JobSource): { success: boolean; data?: ScrapedJobData; error?: string } {
  try {
    // Get page title for fallback
    const pageTitle = $('title').text().trim()

    // Try common patterns for job titles - avoid getting the site name
    let title = $('h1').first().text().trim()

    // If h1 looks like a site title or is too short, try other selectors
    if (!title || title.length < 5 || title.includes(' | ')) {
      title = $('[class*="job-title" i]').first().text().trim() ||
              $('[class*="position" i]').first().text().trim() ||
              $('[id*="title" i]').first().text().trim() ||
              $('h2').first().text().trim()
    }

    // Last resort: try to parse from page title
    if (!title || title.length < 5) {
      // Page titles often look like: "Job Title - Company Name"
      const parts = pageTitle.split(/[-|]/)
      if (parts.length > 1) {
        title = parts[0].trim()
      }
    }

    // Try to find company name
    let company = $('[class*="company" i]').first().text().trim() ||
                  $('[class*="organization" i]').first().text().trim() ||
                  $('meta[property="og:site_name"]').attr('content')

    // Fallback to domain name
    if (!company || company.length < 2) {
      const hostname = new URL(url).hostname.replace('www.', '').replace('careers.', '').replace('jobs.', '')
      company = hostname.split('.')[0]
      // Capitalize first letter
      company = company.charAt(0).toUpperCase() + company.slice(1)
    }

    // Try to find location
    const location = $('[class*="location" i]').first().text().trim() ||
                     $('[itemprop="jobLocation"]').text().trim()

    // Try to find description
    const description = $('[class*="description" i]').first().text().trim() ||
                       $('[class*="content" i]').first().text().trim() ||
                       $('meta[name="description"]').attr('content')

    // Try to find salary for generic sites
    let salary = $('[class*="salary" i]').first().text().trim() ||
                 $('[class*="compensation" i]').first().text().trim() ||
                 $('[itemprop="baseSalary"]').text().trim() ||
                 $('meta[property="og:salary:amount"]').attr('content') ||
                 // Look for text containing $ signs
                 $('div, span, p').filter((_, el) => {
                   const text = $(el).text().trim()
                   return /^\$[\d,]+/.test(text) || (text.includes('$') && (text.includes('k') || text.includes('hour') || text.includes('year')))
                 }).first().text().trim()
    
    // Clean up salary text
    if (salary) {
      salary = salary.replace(/^Salary:\s*/i, '').replace(/^Compensation:\s*/i, '').replace(/^Pay:\s*/i, '').trim()
      // If salary contains multiple lines, take the first meaningful line
      const lines = salary.split('\n').filter(line => line.trim().includes('$'))
      if (lines.length > 0) {
        salary = lines[0].trim()
      }
    }

    if (!title || title.length < 3) {
      return {
        success: false,
        error: `Could not extract job title from page. Please enter details manually or try a different URL.`
      }
    }

    return {
      success: true,
      data: {
        title,
        company,
        location: location || undefined,
        description: description ? description.substring(0, 500) : undefined,
        salary: salary || undefined,
        source,
        url,
      },
    }
  } catch (error) {
    return { success: false, error: 'Failed to parse job posting' }
  }
}
