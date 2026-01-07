# Performance Monitoring Setup

This document explains how to set up and use performance monitoring with Vercel Speed Insights.

## Overview

We're using Vercel Speed Insights Drains to capture performance metrics and store them in our database. This allows us to analyze real user performance data and get actionable recommendations.

## Setup Instructions

### 1. Run Database Migration

First, add the new `PerformanceMetric` model to your database:

```bash
cd my-app
bunx prisma migrate dev --name add_performance_metrics
```

### 2. Configure Vercel Drains

Update `vercel.json` with your actual deployment URL:

```json
{
  "drains": [
    {
      "source": "speed-insights",
      "destination": {
        "url": "https://YOUR_ACTUAL_DOMAIN.vercel.app/api/analytics/performance",
        "method": "POST",
        "headers": {
          "Content-Type": "application/json"
        }
      }
    }
  ]
}
```

**Important:** Replace `YOUR_ACTUAL_DOMAIN` with your actual Vercel deployment URL (e.g., `my-app-abc123.vercel.app` or your custom domain).

### 3. Deploy to Vercel

After updating `vercel.json`, deploy your changes:

```bash
git add .
git commit -m "Add performance monitoring"
git push
```

Vercel will automatically configure the drain and start sending Speed Insights data to your endpoint.

### 4. Verify Data Collection

Check that data is being collected by making a request to your endpoint:

```bash
curl https://YOUR_DOMAIN.vercel.app/api/analytics/performance
```

You should see: `{"status":"ok","service":"performance-metrics"}`

## Analyzing Performance Data

### Run the Analysis Script

```bash
bun run analyze:performance
```

### Filter by Route

Analyze a specific route:

```bash
bun run analyze:performance --route=/jobs
```

### Filter by Device Type

Analyze mobile performance:

```bash
bun run analyze:performance --device=mobile
```

### Custom Time Range

Analyze last 30 days:

```bash
bun run analyze:performance --days=30
```

### Combined Filters

```bash
bun run analyze:performance --route=/board --device=mobile --days=14
```

## Understanding the Output

The analysis script provides:

1. **Overall Performance** - Summary of all Core Web Vitals
   - LCP (Largest Contentful Paint)
   - FCP (First Contentful Paint)
   - CLS (Cumulative Layout Shift)
   - TTFB (Time to First Byte)
   - FID (First Input Delay)
   - INP (Interaction to Next Paint)

2. **Performance by Route** - Breakdown showing which pages need optimization

3. **Performance by Device** - Mobile vs desktop performance comparison

4. **Recommendations** - Actionable suggestions based on Google's Web Vitals thresholds

## Web Vitals Thresholds

The script uses Google's recommended thresholds:

- **LCP (Largest Contentful Paint)**: Good ≤ 2.5s, Poor > 4s
- **FCP (First Contentful Paint)**: Good ≤ 1.8s, Poor > 3s
- **CLS (Cumulative Layout Shift)**: Good ≤ 0.1, Poor > 0.25
- **TTFB (Time to First Byte)**: Good ≤ 800ms, Poor > 1.8s
- **FID (First Input Delay)**: Good ≤ 100ms, Poor > 300ms
- **INP (Interaction to Next Paint)**: Good ≤ 200ms, Poor > 500ms

## API Endpoint

The endpoint at `/api/analytics/performance`:

- **POST**: Receives performance data from Vercel Drains
- **GET**: Health check (returns status)

## Data Storage

Performance metrics are stored in the `PerformanceMetric` table with the following fields:

- Core Web Vitals (lcp, fcp, fid, cls, ttfb, inp)
- Route information (route, pathname, search)
- Geographic data (country, region, city)
- Device/browser info (deviceType, browser, os)
- Network info (connectionType, effectiveType)
- Full metadata payload for detailed analysis

## Troubleshooting

### No Data Collected

1. Check that Speed Insights is enabled in your Vercel project dashboard
2. Verify the drain URL in `vercel.json` matches your deployment URL
3. Check Vercel logs for any errors sending data to the endpoint
4. Ensure the endpoint is publicly accessible (not behind auth)

### Data Format Issues

The endpoint is designed to handle various payload formats from Vercel. If you see parsing errors:

1. Check the endpoint logs in Vercel
2. Inspect the actual payload structure in the metadata field
3. Update the extraction functions in `route.ts` to match your payload format

## Next Steps

Once you have data collected:

1. Run `bun run analyze:performance` regularly to track improvements
2. Focus on routes marked as "Poor" or "Needs Improvement"
3. Implement recommendations from the analysis script
4. Track improvements over time by comparing results week-over-week

## Example Workflow

```bash
# Deploy changes
git push

# Wait a few days for data collection
# ...

# Analyze performance
bun run analyze:performance

# Focus on a problematic route
bun run analyze:performance --route=/jobs

# Check mobile performance
bun run analyze:performance --device=mobile

# Implement fixes based on recommendations
# ...

# Re-analyze after fixes
bun run analyze:performance --days=7
```
