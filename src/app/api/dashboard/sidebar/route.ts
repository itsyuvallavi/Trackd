import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getRecentActivities, getRecentNotifications } from '@/lib/cached-queries'
import { serializeForClient } from '@/lib/serialize-for-client'

/**
 * API endpoint for dashboard sidebar data
 * Returns recent activities and notifications for the sidebar
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [activities, notificationsRaw] = await Promise.all([
      getRecentActivities(user.id, 50),
      getRecentNotifications(user.id, 50),
    ])

    const notifications = notificationsRaw.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }))

    return NextResponse.json({
      activities: serializeForClient(activities),
      notifications: serializeForClient(notifications),
    })
  } catch (error) {
    console.error('Error fetching dashboard sidebar data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

