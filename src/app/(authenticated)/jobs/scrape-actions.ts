'use server'

/**
 * @deprecated import from @/lib/jobs/scrape-job-url for API routes; clients should
 * call POST /api/jobs/scrape-url so heavy Puppeteer work runs in a route handler
 * (longer `maxDuration`) instead of blocking a server action.
 */
export { scrapeJobUrl, type ScrapedJobData } from '@/lib/jobs/scrape-job-url'
