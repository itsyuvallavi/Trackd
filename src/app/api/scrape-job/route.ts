import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTimeout } from '@/lib/with-timeout'
import { fetchPublicHttpText, validatePublicHttpUrl } from '@/lib/url-security'
import { hashExtensionKey, isValidExtensionKeyFormat } from '@/lib/extension-jobs'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

async function handleScrapeJob(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate via extension key
    const key = request.headers.get('X-Extension-Key')
    
    if (!key) {
      return NextResponse.json({ error: 'Missing extension key' }, { status: 401 })
    }

    if (!isValidExtensionKeyFormat(key)) {
      return NextResponse.json({ error: 'Invalid extension key format' }, { status: 400 })
    }

    const keyHash = hashExtensionKey(key)

    const rateLimitResult = checkRateLimit(
      `extension:key:${keyHash.slice(0, 16)}`,
      RATE_LIMITS.extension.limit,
      RATE_LIMITS.extension.window
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: 'Too many requests from extension. Please try again later.',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.extension.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const extensionKey = await prisma.extensionKey.findUnique({
      where: { keyHash }
    })

    if (!extensionKey) {
      return NextResponse.json({ error: 'Invalid extension key' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const initialUrl = validatePublicHttpUrl(url)
    if (!initialUrl.ok) {
      return NextResponse.json({ error: initialUrl.error }, { status: 400 })
    }

    // LinkedIn requires JavaScript execution and authentication - server-side scraping won't work
    if (initialUrl.url.hostname.toLowerCase().includes('linkedin.com')) {
      return NextResponse.json({ 
        error: 'LinkedIn jobs cannot be imported via URL. Please navigate to the LinkedIn job page and use the extension\'s automatic extraction instead.',
        success: false,
        requiresClientSide: true
      }, { status: 400 })
    }

    const fetched = await fetchPublicHttpText(initialUrl.url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeoutMs: 10000,
      maxBytes: 5 * 1024 * 1024,
      maxRedirects: 5,
    })

    if (!fetched.ok) {
      return NextResponse.json({ error: fetched.error }, { status: fetched.status })
    }

    if (fetched.status < 200 || fetched.status >= 300) {
      return NextResponse.json({
        error: 'Failed to fetch URL',
        success: false,
      }, { status: 400 })
    }

    // Extract job data from HTML
    const jobData = extractJobDataFromHTML(fetched.text, fetched.url.toString())

    if (!jobData.title) {
      return NextResponse.json({ 
        error: 'Could not extract job title from this page',
        success: false 
      }, { status: 400 })
    }

    // Update extension key last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() }
    })

    return NextResponse.json({
      success: true,
      data: jobData
    })
  } catch (error) {
    console.error('Error scraping job:', error)
    return NextResponse.json(
      { 
        error: 'Failed to scrape job data',
        success: false 
      },
      { status: 500 }
    )
  }
}

// Export with timeout wrapper (30 seconds)
export const POST = withTimeout(handleScrapeJob, 30000)

function extractJobDataFromHTML(html: string, url: string): {
  title: string
  company: string
  location: string
  salary: string
  source: string
} {
  const hostname = new URL(url).hostname

  // Determine source
  let source = 'Unknown'
  if (hostname.includes('linkedin.com')) source = 'LinkedIn'
  else if (hostname.includes('indeed.com')) source = 'Indeed'
  else if (hostname.includes('greenhouse.io')) source = 'Greenhouse'
  else if (hostname.includes('lever.co')) source = 'Lever'
  else if (hostname.includes('workable.com')) source = 'Workable'
  else if (hostname.includes('euremotejobs.com')) source = 'EU Remote Jobs'
  else if (hostname.includes('ziprecruiter.com')) source = 'ZipRecruiter'
  else if (hostname.includes('landing.jobs')) source = 'Landing.jobs'

  // Try to extract data using regex patterns
  const data = {
    title: '',
    company: '',
    location: '',
    salary: '',
    source
  }

  // Extract title - try multiple methods
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i)
  if (h1Match) {
    data.title = stripHTML(h1Match[1])
  }

  // Try og:title as fallback
  if (!data.title) {
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
    if (ogTitleMatch) {
      data.title = stripHTML(ogTitleMatch[1])
    }
  }

  // Extract company
  const companyMatch = html.match(/company[^>]*>([^<]+)</i) ||
                       html.match(/og:site_name[^>]*content="([^"]+)"/i)
  if (companyMatch) {
    data.company = stripHTML(companyMatch[1])
  }

  // Extract location - look for common patterns
  const locationMatch = html.match(/location[^>]*>([^<]+)</i) ||
                       html.match(/([A-Z][a-z]+,\s*[A-Z]{2})/i) ||
                       html.match(/(Remote|Hybrid|On-site)/i)
  if (locationMatch) {
    data.location = stripHTML(locationMatch[1])
  }

  // Extract salary
  const salaryMatch = html.match(/\$[\d,]+\s*[-–]\s*\$[\d,]+/i)
  if (salaryMatch) {
    data.salary = salaryMatch[0]
  }

  return data
}

function stripHTML(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}
