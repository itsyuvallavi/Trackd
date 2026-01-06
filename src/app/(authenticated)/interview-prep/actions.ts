'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { InterviewType } from '@prisma/client'
import { revalidatePath } from 'next/cache'

/**
 * Create a new interview session
 */
export async function createInterviewSession(
  jobId?: string,
  type?: InterviewType
) {
  try {
    const user = await requireAuth()

    // Validate jobId if provided
    if (jobId) {
      const job = await prisma.job.findFirst({
        where: {
          id: jobId,
          userId: user.id,
        },
      })

      if (!job) {
        throw new Error('Job not found')
      }
    }

    const session = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        jobId: jobId || null,
        type: type || 'MIXED',
        status: 'IN_PROGRESS',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            notes: true,
            url: true,
            interviewAt: true,
          },
        },
      },
    })

    revalidatePath('/interview-prep')
    return { sessionId: session.id, session }
  } catch (error) {
    console.error('Error creating interview session:', error)
    throw new Error('Failed to create interview session')
  }
}

/**
 * Save interview message
 */
export async function saveInterviewMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  options?: {
    audioUrl?: string
    duration?: number
    questionType?: string
    feedback?: any
  }
) {
  try {
    const user = await requireAuth()

    // Verify session belongs to user
    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    const message = await prisma.interviewMessage.create({
      data: {
        sessionId,
        role,
        content,
        audioUrl: options?.audioUrl || null,
        duration: options?.duration || null,
        questionType: options?.questionType || null,
        feedback: options?.feedback ? (options.feedback as any) : null,
      },
    })

    revalidatePath(`/interview-prep/${sessionId}`)
    return { message }
  } catch (error) {
    console.error('Error saving interview message:', error)
    throw new Error('Failed to save interview message')
  }
}

/**
 * Complete interview session and generate summary
 */
export async function completeInterviewSession(sessionId: string) {
  try {
    const user = await requireAuth()

    const session = await prisma.interviewSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Summary should already be generated via API endpoint
    // This just marks it as completed if not already
    if (session.status !== 'COMPLETED') {
      const startTime = session.startedAt.getTime()
      const endTime = new Date().getTime()
      const duration = Math.floor((endTime - startTime) / 1000)

      await prisma.interviewSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          duration,
        },
      })
    }

    revalidatePath('/interview-prep')
    revalidatePath(`/interview-prep/${sessionId}`)

    return {
      summary: session.summary || '',
      strengths: session.strengths,
      improvements: session.improvements,
      tips: session.tips,
    }
  } catch (error) {
    console.error('Error completing interview session:', error)
    throw new Error('Failed to complete interview session')
  }
}

