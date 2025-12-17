import { NextRequest, NextResponse } from 'next/server'
import { scrapeJobUrl } from '@/app/(authenticated)/jobs/scrape-actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Scrape the job URL
    const result = await scrapeJobUrl(url)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to scrape job URL' },
        { status: 422 } // Unprocessable Entity
      )
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Scrape job API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape job URL',
      },
      { status: 500 }
    )
  }
}

// Enable CORS for browser extension
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

