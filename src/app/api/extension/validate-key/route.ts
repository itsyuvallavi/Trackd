import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const { key } = await request.json()

    if (!key?.startsWith('tk_')) {
      return Response.json({ error: 'Invalid key format' }, { status: 400 })
    }

    // Check extension rate limit (defense in depth - middleware also checks)
    const rateLimitResult = checkRateLimit(
      `extension:key:${key}`,
      RATE_LIMITS.extension.limit,
      RATE_LIMITS.extension.window
    )
    
    if (!rateLimitResult.allowed) {
      return Response.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many validation requests. Please try again later.',
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.extension.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    const keyHash = createHash('sha256').update(key).digest('hex')

    const extensionKey = await prisma.extensionKey.findUnique({
      where: { keyHash }
    })

    if (!extensionKey) {
      return Response.json({ error: 'Invalid key' }, { status: 401 })
    }

    // Get user email from Profile table
    const profile = await prisma.profile.findUnique({
      where: { id: extensionKey.userId },
      select: { email: true }
    })

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 401 })
    }

    // Update last used
    await prisma.extensionKey.update({
      where: { id: extensionKey.id },
      data: { lastUsedAt: new Date() }
    })

    return Response.json({
      valid: true,
      email: profile.email
    })
  } catch (error) {
    console.error('Error validating extension key:', error)
    return Response.json(
      { error: 'Failed to validate key' },
      { status: 500 }
    )
  }
}

