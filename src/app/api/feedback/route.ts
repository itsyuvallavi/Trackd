import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FeedbackType, FeedbackSource } from '@prisma/client'
import { sendFeedbackEmail } from '@/lib/feedback-email'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    
    const body = await request.json()
    const { type, title, description, url } = body

    // Validate required fields
    if (!type || !title || !description) {
      return Response.json(
        { error: 'Type, title, and description are required' },
        { status: 400 }
      )
    }

    // Validate type enum - accept string values that match enum
    const validTypes = Object.values(FeedbackType) as string[]
    if (!validTypes.includes(type)) {
      return Response.json(
        { error: `Invalid feedback type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Get user agent and referer from headers
    const userAgent = request.headers.get('user-agent') || null
    const referer = request.headers.get('referer') || url || null

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId: user.id,
        userEmail: user.email || null,
        type: type as FeedbackType,
        source: FeedbackSource.WEB,
        title: title.trim(),
        description: description.trim(),
        url: referer,
        userAgent,
      },
    })

    // Send email notification (non-blocking)
    try {
      const profile = await prisma.profile.findUnique({
        where: { id: user.id },
      })

      console.log('📨 Sending feedback email notification...')
      await sendFeedbackEmail({
        type: feedback.type,
        title: feedback.title,
        description: feedback.description,
        userEmail: feedback.userEmail,
        userName: profile?.name || null,
        url: feedback.url,
        userAgent: feedback.userAgent,
        source: feedback.source,
      })
    } catch (emailError) {
      console.error('❌ Failed to send feedback email in API route:', emailError)
      // Continue even if email fails - feedback is already saved
    }

    return Response.json({
      success: true,
      feedback: {
        id: feedback.id,
        type: feedback.type,
        title: feedback.title,
      },
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error details:', { errorMessage, errorStack })
    return Response.json(
      { 
        error: 'Failed to submit feedback',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}

