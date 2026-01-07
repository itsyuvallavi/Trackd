import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { withTimeout } from '@/lib/with-timeout'

async function handleScrapeJob(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate via extension key
    const key = request.headers.get('X-Extension-Key')
    
    if (!key) {
      return NextResponse.json({ error: 'Missing extension key' }, { status: 401 })
    }

    const keyHash = createHash('sha256').update(key).digest('hex')
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

    // Validate URL and prevent SSRF attacks
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Only HTTP and HTTPS URLs are allowed' }, { status: 400 })
    }

    // Block private/internal IP addresses and localhost
    const hostname = parsedUrl.hostname.toLowerCase()
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname)
    const isInternalDomain = hostname.endsWith('.local') || hostname.endsWith('.internal')
    
    if (isLocalhost || isPrivateIP || isInternalDomain) {
      return NextResponse.json({ error: 'Internal URLs are not allowed' }, { status: 400 })
    }

    // Fetch the page with timeout and size limits
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    let html = ''
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal,
        // Limit redirects to prevent redirect-based SSRF
        redirect: 'follow',
      })

      clearTimeout(timeoutId)

      // Check content length header if available (limit to 5MB)
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'Response too large' }, { status: 400 })
      }

      if (!response.ok) {
        return NextResponse.json({ 
          error: 'Failed to fetch URL',
          success: false 
        }, { status: 400 })
      }

      // Read response with size limit (5MB max)
      const reader = response.body?.getReader()
      if (!reader) {
        return NextResponse.json({ error: 'Failed to read response' }, { status: 400 })
      }

      let totalSize = 0
      const maxSize = 5 * 1024 * 1024 // 5MB

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        totalSize += value.length
        if (totalSize > maxSize) {
          return NextResponse.json({ error: 'Response too large' }, { status: 400 })
        }
        
        html += new TextDecoder().decode(value)
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
      }
      throw error
    }

    // Extract job data from HTML
    const jobData = extractJobDataFromHTML(html, url)

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
