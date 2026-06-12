import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getUnreadNotificationCount } from '@/lib/cached-queries'

/**
 * GET /api/notifications/count
 * Get unread notification count for the notification bell
 * Lightweight endpoint for frequent polling
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const count = await getUnreadNotificationCount(user.id)

    return NextResponse.json({ count })
  } catch (error) {
    console.error('Error fetching notification count:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notification count' },
      { status: 500 }
    )
  }
}
