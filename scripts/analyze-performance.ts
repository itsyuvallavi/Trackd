#!/usr/bin/env bun

/**
 * Performance Metrics Analysis Script
 * 
 * Analyzes performance metrics stored from Vercel Speed Insights
 * and provides actionable recommendations for improvements.
 * 
 * Usage:
 *   bun run scripts/analyze-performance.ts
 *   bun run scripts/analyze-performance.ts --route /jobs
 *   bun run scripts/analyze-performance.ts --device mobile
 */

import { prisma } from '../src/lib/prisma'

// Web Vitals thresholds (Google's recommended targets)
const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 }, // Largest Contentful Paint (ms)
  fcp: { good: 1800, poor: 3000 }, // First Contentful Paint (ms)
  fid: { good: 100, poor: 300 },   // First Input Delay (ms)
  cls: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift (score)
  ttfb: { good: 800, poor: 1800 }, // Time to First Byte (ms)
  inp: { good: 200, poor: 500 },   // Interaction to Next Paint (ms)
}

interface MetricStats {
  count: number
  avg: number
  median: number
  p75: number
  p95: number
  min: number
  max: number
  good: number
  needsImprovement: number
  poor: number
}

interface RouteStats {
  route: string
  count: number
  lcp?: MetricStats
  fcp?: MetricStats
  cls?: MetricStats
  ttfb?: MetricStats
  fid?: MetricStats
  inp?: MetricStats
}

function calculateStats(values: number[], threshold: { good: number; poor: number }): MetricStats {
  if (values.length === 0) {
    return {
      count: 0,
      avg: 0,
      median: 0,
      p75: 0,
      p95: 0,
      min: 0,
      max: 0,
      good: 0,
      needsImprovement: 0,
      poor: 0,
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  const median = sorted[Math.floor(sorted.length / 2)]
  const p75 = sorted[Math.floor(sorted.length * 0.75)]
  const p95 = sorted[Math.floor(sorted.length * 0.95)]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  const good = values.filter((v) => v <= threshold.good).length
  const needsImprovement = values.filter((v) => v > threshold.good && v <= threshold.poor).length
  const poor = values.filter((v) => v > threshold.poor).length

  return {
    count: values.length,
    avg: Math.round(avg),
    median: Math.round(median),
    p75: Math.round(p75),
    p95: Math.round(p95),
    min: Math.round(min),
    max: Math.round(max),
    good,
    needsImprovement,
    poor,
  }
}

function getPerformanceGrade(stats: MetricStats, threshold: { good: number; poor: number }): string {
  const goodPercent = (stats.good / stats.count) * 100
  if (goodPercent >= 75) return '🟢 Good'
  if (goodPercent >= 50) return '🟡 Needs Improvement'
  return '🔴 Poor'
}

async function analyzePerformance() {
  const args = process.argv.slice(2)
  const routeFilter = args.find((arg) => arg.startsWith('--route='))?.split('=')[1]
  const deviceFilter = args.find((arg) => arg.startsWith('--device='))?.split('=')[1]
  const daysFilter = args.find((arg) => arg.startsWith('--days='))?.split('=')[1] || '7'

  const daysAgo = new Date()
  daysAgo.setDate(daysAgo.getDate() - parseInt(daysFilter))

  console.log('\n📊 Performance Metrics Analysis\n')
  console.log(`📅 Date range: Last ${daysFilter} days\n`)

  // Build query filters
  const where: any = {
    createdAt: {
      gte: daysAgo,
    },
  }

  if (routeFilter) {
    where.route = routeFilter
    console.log(`📍 Route filter: ${routeFilter}\n`)
  }

  if (deviceFilter) {
    where.deviceType = deviceFilter
    console.log(`📱 Device filter: ${deviceFilter}\n`)
  }

  // Get all metrics
  // @ts-expect-error - performanceMetric exists after schema sync
  const metrics = await prisma.performanceMetric.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  if (metrics.length === 0) {
    console.log('⚠️  No performance metrics found in the specified time range.')
    console.log('   Make sure Speed Insights Drains are configured and data is being collected.')
    await prisma.$disconnect()
    return
  }

  console.log(`📈 Total metrics collected: ${metrics.length}\n`)

  // Overall statistics
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('OVERALL PERFORMANCE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  type MetricType = typeof metrics[number]
  
  const overallMetrics = ['lcp', 'fcp', 'cls', 'ttfb', 'fid', 'inp'] as const
  for (const metricName of overallMetrics) {
    const values = metrics.map((m: MetricType) => m[metricName]).filter((v: number | null): v is number => v !== null)
    if (values.length === 0) continue

    const stats = calculateStats(values, THRESHOLDS[metricName])
    const grade = getPerformanceGrade(stats, THRESHOLDS[metricName])

    console.log(`${metricName.toUpperCase().padEnd(6)} ${grade}`)
    console.log(`  Avg: ${stats.avg}ms | Median: ${stats.median}ms | P95: ${stats.p95}ms`)
    console.log(`  Good: ${stats.good} (${((stats.good / stats.count) * 100).toFixed(1)}%) | Needs Improvement: ${stats.needsImprovement} | Poor: ${stats.poor}`)
    console.log()
  }

  // Route breakdown
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PERFORMANCE BY ROUTE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const routeGroups = new Map<string, typeof metrics>()
  for (const metric of metrics) {
    const route = metric.route || metric.pathname || '(unknown)'
    if (!routeGroups.has(route)) {
      routeGroups.set(route, [])
    }
    routeGroups.get(route)!.push(metric)
  }

  const routeStats: RouteStats[] = []
  for (const [route, routeMetrics] of routeGroups.entries()) {
    const lcpValues = routeMetrics.map((m: MetricType) => m.lcp).filter((v: number | null): v is number => v !== null)
    const fcpValues = routeMetrics.map((m: MetricType) => m.fcp).filter((v: number | null): v is number => v !== null)
    const clsValues = routeMetrics.map((m: MetricType) => m.cls).filter((v: number | null): v is number => v !== null)
    const ttfbValues = routeMetrics.map((m: MetricType) => m.ttfb).filter((v: number | null): v is number => v !== null)
    const fidValues = routeMetrics.map((m: MetricType) => m.fid).filter((v: number | null): v is number => v !== null)
    const inpValues = routeMetrics.map((m: MetricType) => m.inp).filter((v: number | null): v is number => v !== null)

    routeStats.push({
      route,
      count: routeMetrics.length,
      lcp: lcpValues.length > 0 ? calculateStats(lcpValues, THRESHOLDS.lcp) : undefined,
      fcp: fcpValues.length > 0 ? calculateStats(fcpValues, THRESHOLDS.fcp) : undefined,
      cls: clsValues.length > 0 ? calculateStats(clsValues, THRESHOLDS.cls) : undefined,
      ttfb: ttfbValues.length > 0 ? calculateStats(ttfbValues, THRESHOLDS.ttfb) : undefined,
      fid: fidValues.length > 0 ? calculateStats(fidValues, THRESHOLDS.fid) : undefined,
      inp: inpValues.length > 0 ? calculateStats(inpValues, THRESHOLDS.inp) : undefined,
    })
  }

  // Sort by count (most visited routes first)
  routeStats.sort((a, b) => b.count - a.count)

  for (const route of routeStats.slice(0, 10)) {
    console.log(`📄 ${route.route}`)
    console.log(`   Samples: ${route.count}`)

    if (route.lcp) {
      const grade = getPerformanceGrade(route.lcp, THRESHOLDS.lcp)
      console.log(`   LCP: ${grade} (avg: ${route.lcp.avg}ms, p95: ${route.lcp.p95}ms)`)
    }
    if (route.cls) {
      const grade = getPerformanceGrade(route.cls, THRESHOLDS.cls)
      console.log(`   CLS: ${grade} (avg: ${route.cls.avg.toFixed(3)}, p95: ${route.cls.p95.toFixed(3)})`)
    }
    if (route.fcp) {
      const grade = getPerformanceGrade(route.fcp, THRESHOLDS.fcp)
      console.log(`   FCP: ${grade} (avg: ${route.fcp.avg}ms, p95: ${route.fcp.p95}ms)`)
    }
    console.log()
  }

  // Device breakdown
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('PERFORMANCE BY DEVICE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const deviceGroups = new Map<string, typeof metrics>()
  for (const metric of metrics) {
    const device = metric.deviceType || 'unknown'
    if (!deviceGroups.has(device)) {
      deviceGroups.set(device, [])
    }
    deviceGroups.get(device)!.push(metric)
  }

  for (const [device, deviceMetrics] of deviceGroups.entries()) {
    const lcpValues = deviceMetrics.map((m: MetricType) => m.lcp).filter((v: number | null): v is number => v !== null)
    if (lcpValues.length === 0) continue

    const lcpStats = calculateStats(lcpValues, THRESHOLDS.lcp)
    const grade = getPerformanceGrade(lcpStats, THRESHOLDS.lcp)

    console.log(`📱 ${device.toUpperCase()} (${deviceMetrics.length} samples)`)
    console.log(`   LCP: ${grade} (avg: ${lcpStats.avg}ms, p95: ${lcpStats.p95}ms)`)
    console.log()
  }

  // Recommendations
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('RECOMMENDATIONS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const recommendations: string[] = []

  // Analyze overall LCP
  const overallLcp = metrics.map((m: MetricType) => m.lcp).filter((v: number | null): v is number => v !== null)
  if (overallLcp.length > 0) {
    const lcpStats = calculateStats(overallLcp, THRESHOLDS.lcp)
    if (lcpStats.p95 > THRESHOLDS.lcp.poor) {
      recommendations.push(
        `🔴 LCP is poor (p95: ${lcpStats.p95}ms). Consider:\n   - Optimizing images (use Next.js Image, WebP format)\n   - Reducing render-blocking resources\n   - Implementing lazy loading for below-fold content\n   - Using CDN for static assets`
      )
    } else if (lcpStats.p95 > THRESHOLDS.lcp.good) {
      recommendations.push(
        `🟡 LCP needs improvement (p95: ${lcpStats.p95}ms). Consider:\n   - Optimizing largest content element\n   - Preloading critical resources\n   - Server-side rendering optimization`
      )
    }
  }

  // Analyze CLS
  const overallCls = metrics.map((m: MetricType) => m.cls).filter((v: number | null): v is number => v !== null)
  if (overallCls.length > 0) {
    const clsStats = calculateStats(overallCls, THRESHOLDS.cls)
    if (clsStats.p95 > THRESHOLDS.cls.poor) {
      recommendations.push(
        `🔴 CLS is poor (p95: ${clsStats.p95.toFixed(3)}). Consider:\n   - Setting explicit width/height on images\n   - Avoiding inserting content above existing content\n   - Using transform animations instead of layout properties\n   - Preferring CSS aspect-ratio for responsive media`
      )
    } else if (clsStats.p95 > THRESHOLDS.cls.good) {
      recommendations.push(
        `🟡 CLS needs improvement (p95: ${clsStats.p95.toFixed(3)}). Review:\n   - Dynamic content insertion\n   - Font loading strategy\n   - Ad/embed sizing`
      )
    }
  }

  // Analyze TTFB
  const overallTtfb = metrics.map((m: MetricType) => m.ttfb).filter((v: number | null): v is number => v !== null)
  if (overallTtfb.length > 0) {
    const ttfbStats = calculateStats(overallTtfb, THRESHOLDS.ttfb)
    if (ttfbStats.p95 > THRESHOLDS.ttfb.poor) {
      recommendations.push(
        `🔴 TTFB is poor (p95: ${ttfbStats.p95}ms). Consider:\n   - Optimizing database queries\n   - Adding caching (Redis, Vercel KV)\n   - Using edge functions for static content\n   - Reviewing API route performance`
      )
    } else if (ttfbStats.p95 > THRESHOLDS.ttfb.good) {
      recommendations.push(
        `🟡 TTFB needs improvement (p95: ${ttfbStats.p95}ms). Consider:\n   - Database query optimization\n   - Response caching strategies`
      )
    }
  }

  // Analyze device-specific issues
  const mobileMetrics = metrics.filter((m: MetricType) => m.deviceType === 'mobile')
  if (mobileMetrics.length > 0) {
    const mobileLcp = mobileMetrics.map((m: MetricType) => m.lcp).filter((v: number | null): v is number => v !== null)
    if (mobileLcp.length > 0) {
      const mobileLcpStats = calculateStats(mobileLcp, THRESHOLDS.lcp)
      if (mobileLcpStats.p95 > THRESHOLDS.lcp.poor) {
        recommendations.push(
          `📱 Mobile performance is poor. Consider:\n   - Reducing JavaScript bundle size\n   - Using responsive images with srcset\n   - Implementing code splitting\n   - Reviewing mobile-specific optimizations`
        )
      }
    }
  }

  if (recommendations.length === 0) {
    console.log('✅ All performance metrics are in the "good" range! Keep up the great work! 🎉\n')
  } else {
    for (const rec of recommendations) {
      console.log(rec)
      console.log()
    }
  }

  await prisma.$disconnect()
}

analyzePerformance().catch((error) => {
  console.error('Error analyzing performance:', error)
  process.exit(1)
})
