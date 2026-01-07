import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
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
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@tabler/icons-react'], // Tree-shake unused icons
  },
  async headers() {
    return [
      {
        source: '/api/extension/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' }, // Allow Chrome extensions
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, X-Extension-Key' },
        ],
      },
      // Add caching headers for static assets
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
