import type { ScrapedJobData } from '@/lib/jobs/scrape-job-url'

export type ScrapeUrlResult = {
  success: boolean
  data?: ScrapedJobData
  error?: string
}

/**
 * Scrape a job URL via the dedicated API route (Puppeteer + long `maxDuration`),
 * not a server action.
 */
export async function scrapeJobUrlClient(url: string): Promise<ScrapeUrlResult> {
  const res = await fetch('/api/jobs/scrape-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim() }),
  })
  const data = (await res.json()) as ScrapeUrlResult
  if (!res.ok) {
    return { success: false, error: data.error || res.statusText }
  }
  return data
}
