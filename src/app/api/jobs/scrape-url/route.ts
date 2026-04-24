import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { scrapeJobUrl } from '@/lib/jobs/scrape-job-url'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/jobs/scrape-url
 * Body: { url: string }
 * Runs scraping in a dedicated route (not a server action) so Vercel maxDuration applies.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { url?: string }
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const result = await scrapeJobUrl(url)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[api/jobs/scrape-url]', e)
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Scrape failed' },
      { status: 500 }
    )
  }
}
