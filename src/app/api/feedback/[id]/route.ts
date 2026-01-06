import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FeedbackStatus } from '@prisma/client'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@yuvallavi.com'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    // Validate status
    if (!status || !Object.values(FeedbackStatus).includes(status)) {
      return Response.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Update feedback
    const feedback = await prisma.feedback.update({
      where: { id },
      data: { status: status as FeedbackStatus },
    })

    return Response.json({
      success: true,
      feedback: {
        id: feedback.id,
        status: feedback.status,
      },
    })
  } catch (error) {
    console.error('Error updating feedback:', error)
    return Response.json(
      { error: 'Failed to update feedback' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    // Check if user is admin
    if (user.email !== ADMIN_EMAIL) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    // Delete feedback
    await prisma.feedback.delete({
      where: { id },
    })

    return Response.json({
      success: true,
      message: 'Feedback deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return Response.json(
      { error: 'Failed to delete feedback' },
      { status: 500 }
    )
  }
}

