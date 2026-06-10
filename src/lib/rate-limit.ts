/**
 * Rate limiting helpers.
 *
 * `checkRateLimit` is intentionally in-memory for edge/proxy use only.
 * API routes should use `checkRateLimitAsync`, which persists counters in Postgres
 * so limits cannot be bypassed by landing on a different serverless instance.
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
 * Durable fixed-window rate limit for server-side API routes.
 * Falls back to the proxy in-memory limiter only if the database is unavailable,
 * so user flows fail soft while still retaining a local throttle.
 */
export async function checkRateLimitAsync(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date()
  const nowMs = now.getTime()
  const resetAt = new Date(nowMs + windowSeconds * 1000)
  const key = `${identifier}:${limit}:${windowSeconds}`

  try {
    const { prisma } = await import('@/lib/prisma')

    const counter = await prisma.$transaction(async (tx) => {
      const existing = await tx.rateLimitCounter.findUnique({
        where: { key },
        select: { count: true, resetAt: true },
      })

      if (!existing || existing.resetAt.getTime() <= nowMs) {
        return tx.rateLimitCounter.upsert({
          where: { key },
          create: { key, count: 1, resetAt },
          update: { count: 1, resetAt },
          select: { count: true, resetAt: true },
        })
      }

      return tx.rateLimitCounter.update({
        where: { key },
        data: { count: { increment: 1 } },
        select: { count: true, resetAt: true },
      })
    })

    const remaining = Math.max(0, limit - counter.count)
    return {
      allowed: counter.count <= limit,
      remaining,
      resetAt: counter.resetAt.getTime(),
    }
  } catch (error) {
    console.warn('[rate-limit] durable limiter unavailable:', error instanceof Error ? error.message : error)
    return checkRateLimit(identifier, limit, windowSeconds)
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
