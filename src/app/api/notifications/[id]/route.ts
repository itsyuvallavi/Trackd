import { NextRequest, NextResponse, after } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { cacheTagsFor } from '@/lib/cache-tags'

/**
 * PATCH /api/notifications/[id]
 * Mark notification as read
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    await prisma.notification.updateMany({
      where: {
        id,
        userId: user.id, // Ensure user owns this notification
      },
      data: {
        isRead: true,
      },
    })

    const notificationTag = cacheTagsFor(user.id).notifications
    after(() => revalidateTag(notificationTag, { expire: 0 }))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete/dismiss notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    await prisma.notification.deleteMany({
      where: {
        id,
        userId: user.id, // Ensure user owns this notification
      },
    })

    const notificationTag = cacheTagsFor(user.id).notifications
    after(() => revalidateTag(notificationTag, { expire: 0 }))
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting notification:', error)
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    )
  }
}
