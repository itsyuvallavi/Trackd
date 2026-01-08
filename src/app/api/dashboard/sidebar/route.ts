import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getRecentActivities, getRecentNotifications } from '@/lib/cached-queries'

/**
 * API endpoint for dashboard sidebar data
 * Returns recent activities and notifications for the sidebar
 */
export async function GET() {
  try {
    const user = await requireAuth()

    // Fetch data in parallel using cached queries
    const [activities, notificationsRaw] = await Promise.all([
      getRecentActivities(user.id, 50),
      getRecentNotifications(user.id, 50),
    ])

    // Convert notifications createdAt from Date to string for client-side
    const notifications = notificationsRaw.map(n => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    }))

    return NextResponse.json({
      activities,
      notifications,
    })
  } catch (error) {
    console.error('Error fetching dashboard sidebar data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

