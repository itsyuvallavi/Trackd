import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

/**
 * Receives performance metrics from Vercel Speed Insights Drains
 * This endpoint is called by Vercel whenever Speed Insights collects metrics
 */
export async function POST(request: Request) {
  try {
    // Vercel Drains sends data as JSON array of events
    const events = await request.json()
    
    // Validate we received an array
    if (!Array.isArray(events)) {
      console.error('Invalid payload: expected array of events', typeof events)
      return NextResponse.json(
        { error: 'Invalid payload format' },
        { status: 400 }
      )
    }

    // Process each performance metric event
    const metrics = []
    for (const event of events) {
      try {
        // Extract Core Web Vitals from the event
        // Vercel Speed Insights format may vary, adjust based on actual payload
        const metric = {
          lcp: extractMetric(event, 'lcp'),
          fcp: extractMetric(event, 'fcp'),
          fid: extractMetric(event, 'fid'),
          cls: extractMetric(event, 'cls'),
          ttfb: extractMetric(event, 'ttfb'),
          inp: extractMetric(event, 'inp'),
          
          // Route information
          route: event.pathname || event.route || extractRouteFromUrl(event.url) || null,
          pathname: event.pathname || extractPathnameFromUrl(event.url) || null,
          search: event.search || extractSearchFromUrl(event.url) || null,
          
          // Geographic info
          country: event.country || event.geo?.country || null,
          region: event.region || event.geo?.region || null,
          city: event.city || event.geo?.city || null,
          
          // Device/browser info
          deviceType: event.deviceType || extractDeviceType(event),
          browser: extractBrowser(event),
          os: extractOS(event),
          
          // Network info
          connectionType: event.connectionType || event.connection?.effectiveType || null,
          effectiveType: event.effectiveType || event.connection?.effectiveType || null,
          
          // Store full payload for future analysis
          metadata: event,
          userAgent: event.userAgent || event.headers?.['user-agent'] || null,
        }

        metrics.push(metric)
      } catch (error) {
        console.error('Error processing metric event:', error, event)
        // Continue processing other events even if one fails
      }
    }

    // Batch insert into database
    if (metrics.length > 0) {
      await prisma.performanceMetric.createMany({
        data: metrics,
        skipDuplicates: true,
      })

      console.log(`✅ Stored ${metrics.length} performance metrics`)
    }

    return NextResponse.json({
      success: true,
      processed: metrics.length,
    })
  } catch (error) {
    console.error('Error storing performance metrics:', error)
    return NextResponse.json(
      { 
        error: 'Failed to store metrics',
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    )
  }
}

// Helper functions to extract metrics from Vercel Speed Insights payload
function extractMetric(event: any, metricName: string): number | null {
  // Try various possible field names
  const value = event[metricName] || 
                event.metrics?.[metricName]?.value ||
                event.metrics?.[metricName] ||
                event.webVitals?.[metricName]?.value ||
                event.webVitals?.[metricName] ||
                event.performance?.[metricName] ||
                null
  
  return typeof value === 'number' && !isNaN(value) ? value : null
}

function extractRouteFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const pathname = new URL(url).pathname
    // Normalize route (remove trailing slash, etc.)
    return pathname === '/' ? '/' : pathname.replace(/\/$/, '')
  } catch {
    return null
  }
}

function extractPathnameFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

function extractSearchFromUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).search || null
  } catch {
    return null
  }
}

function extractDeviceType(event: any): string | null {
  const ua = event.userAgent || event.headers?.['user-agent'] || ''
  if (!ua) return null
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

function extractBrowser(event: any): string | null {
  const ua = event.userAgent || event.headers?.['user-agent'] || ''
  if (!ua) return null
  
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
  if (ua.includes('Edg')) return 'Edge'
  if (ua.includes('Opera')) return 'Opera'
  return null
}

function extractOS(event: any): string | null {
  const ua = event.userAgent || event.headers?.['user-agent'] || ''
  if (!ua) return null
  
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS') || /iPad|iPhone|iPod/.test(ua)) return 'iOS'
  return null
}

// Allow GET for health checks
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'performance-metrics',
    endpoint: '/api/analytics/performance'
  })
}
