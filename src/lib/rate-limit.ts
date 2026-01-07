/**
 * In-memory rate limiting implementation
 * Uses sliding window algorithm with automatic cleanup
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// Store rate limit data in memory
// In serverless environments, this resets per function invocation
// For production, consider upgrading to Upstash Redis
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval to remove expired entries
let cleanupInterval: NodeJS.Timeout | null = null

/**
 * Initialize cleanup interval (runs every 5 minutes)
 */
function initCleanup() {
  if (cleanupInterval) return
  
  cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000) // 5 minutes
}

/**
 * Check if a request is allowed based on rate limit
 * @param identifier - Unique identifier (userId, IP, extension key, etc.)
 * @param limit - Maximum number of requests
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with allowed status and metadata
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  initCleanup()
  
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const key = `${identifier}:${limit}:${windowSeconds}`
  
  const entry = rateLimitStore.get(key)
  
  // If no entry or window expired, create new entry
  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs
    rateLimitStore.set(key, {
      count: 1,
      resetAt,
    })
    
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
    }
  }
  
  // Increment count
  entry.count++
  
  // Check if limit exceeded
  if (entry.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }
  
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/**
 * Get rate limit info without incrementing count
 * Useful for checking remaining requests
 */
export function getRateLimitInfo(
  identifier: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now()
  const key = `${identifier}:${limit}:${windowSeconds}`
  
  const entry = rateLimitStore.get(key)
  
  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      remaining: limit,
      resetAt: now + (windowSeconds * 1000),
    }
  }
  
  return {
    allowed: entry.count < limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

/**
 * Rate limit configuration constants
 */
export const RATE_LIMITS = {
  api: { limit: 100, window: 60 }, // 100 req/min
  upload: { limit: 10, window: 3600 }, // 10 req/hour
  extension: { limit: 50, window: 60 }, // 50 req/min
  auth: { limit: 5, window: 60 }, // 5 req/min
} as const

