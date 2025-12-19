import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Authenticate via extension key
    const key = request.headers.get('X-Extension-Key')
    
    if (!key) {
      return Response.json({ error: 'Missing extension key' }, { status: 401 })
    }

    const keyHash = createHash('sha256').update(key).digest('hex')
    const extensionKey = await prisma.extensionKey.findUnique({
      where: { keyHash }
    })

    if (!extensionKey) {
      return Response.json({ error: 'Invalid extension key' }, { status: 401 })
    }

    const { url } = await request.json()

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return Response.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    })

    if (!response.ok) {
      return Response.json({ 
        error: 'Failed to fetch URL',
        success: false 
      }, { status: 400 })
    }

    const html = await response.text()

    // Extract job data from HTML
    const jobData = extractJobDataFromHTML(html, url)

    if (!jobData.title) {
      return Response.json({ 
        error: 'Could not extract job title from this page',
        success: false 
      }, { status: 400 })
    }

    // Update extension key last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() }
    })

    return Response.json({
      success: true,
      data: jobData
    })
  } catch (error) {
    console.error('Error scraping job:', error)
    return Response.json(
      { 
        error: 'Failed to scrape job data',
        success: false 
      },
      { status: 500 }
    )
  }
}

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
