import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/email-sync-logs
 * Retrieve email sync log history for the authenticated user
 */
export async function GET() {
  try {
    const user = await requireAuth()
    
    const logs = await prisma.emailSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100, // Last 100 syncs
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