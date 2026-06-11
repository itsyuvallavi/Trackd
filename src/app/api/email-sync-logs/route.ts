import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email-sync-logs
 * Retrieve email sync log history for the authenticated user
 */
const DEFAULT_SYNC_LOG_LIMIT = 10
const MAX_SYNC_LOG_LIMIT = 50

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_SYNC_LOG_LIMIT
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_SYNC_LOG_LIMIT
  return Math.min(Math.max(1, parsed), MAX_SYNC_LOG_LIMIT)
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const url = new URL(request.url)
    const limit = parseLimit(url.searchParams.get('limit'))
    
    const logs = await prisma.emailSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Error fetching sync logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    )
  }
}
