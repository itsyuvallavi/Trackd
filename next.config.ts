import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
    formats: ['image/avif', 'image/webp'], // Modern image formats for better performance
    minimumCacheTTL: 60, // Cache images for 60 seconds
    qualities: [75, 85], // Allow both quality levels
  },
  // Packages with native binaries or heavy server-only footprints that must
  // not be bundled by webpack / Turbopack. These are all reachable only from
  // API routes, server actions, and server modules.
  serverExternalPackages: [
    'playwright-core',
    'playwright',
    'puppeteer',
    'mailparser',
    'imap',
    'cheerio',
    'xlsx',
  ],

  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react'], // Tree-shake unused icons
  },
  async headers() {
    // Security headers applied to all routes
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ]

    // Add HSTS header in production (HTTPS only)
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload',
      })
    }

    const routes = [
      // Security headers for all routes
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/api/extension/:path*',
        headers: [
          ...securityHeaders,
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Allow Chrome extensions
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Extension-Key' },
        ],
      },
    ]

    // Next.js already hashes and caches static assets correctly in production. Overriding
    // Cache-Control on /_next/static in dev makes the browser pin stale HMR chunks, which
    // triggers "module factory is not available" errors. Only set it in production.
    if (process.env.NODE_ENV === 'production') {
      routes.push({
        source: '/_next/static/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      })
    }

    return routes
  },
};

export default nextConfig;
