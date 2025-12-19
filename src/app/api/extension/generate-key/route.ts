import { nanoid } from 'nanoid'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'

// GET: Fetch current extension key info (without the full key)
export async function GET() {
  try {
    const user = await requireAuth()
    const userId = user.id

    const extensionKey = await prisma.extensionKey.findUnique({
      where: { userId },
      select: {
        keyPrefix: true,
        lastUsedAt: true,
      }
    })

    if (!extensionKey) {
      return Response.json({ keyPrefix: null, lastUsedAt: null })
    }

    return Response.json({
      keyPrefix: extensionKey.keyPrefix,
      lastUsedAt: extensionKey.lastUsedAt?.toISOString() || null
    })
  } catch (error) {
    console.error('Error fetching extension key:', error)
    return Response.json(
      { error: 'Failed to fetch extension key' },
      { status: 500 }
    )
  }
}

// POST: Generate new extension key
export async function POST() {
  try {
    const user = await requireAuth() // Get authenticated user from Supabase
    const userId = user.id

    // Generate new key: tk_ + 32 random chars
    const key = `tk_${nanoid(32)}`
    const keyHash = createHash('sha256').update(key).digest('hex')
    const keyPrefix = key.slice(0, 10) // "tk_a1b2c3"

    // Delete existing key (if any) and create new one
    await prisma.$transaction([
      prisma.extensionKey.deleteMany({ where: { userId } }),
      prisma.extensionKey.create({
        data: { userId, keyHash, keyPrefix }
      })
    ])

    // Return plain key (only time it's ever shown)
    return Response.json({ key, keyPrefix })
  } catch (error) {
    console.error('Error generating extension key:', error)
    return Response.json(
      { error: 'Failed to generate extension key' },
      { status: 500 }
    )
  }
}

