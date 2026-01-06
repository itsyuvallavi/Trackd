import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { ResumeChatManager } from '@/lib/resume/resume-chat-manager'

/**
 * GET /api/resume/chat/sessions/[id]/messages
 * Get messages for a resume session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    // Verify session belongs to user
    const session = await prisma.resumeSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    const messages = await prisma.resumeMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    return NextResponse.json({ 
      messages,
      hasImprovedResume: !!session.improvedResumeText,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/resume/chat/sessions/[id]/messages
 * Send a message and get AI response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sessionId } = await params

    const body = await request.json()
    const { content } = body as {
      content: string
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Verify session belongs to user
    const session = await prisma.resumeSession.findFirst({
      where: {
        id: sessionId,
        userId: user.id,
      },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Save user message
    const userMessage = await prisma.resumeMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: content.trim(),
      },
    })

    // Get conversation history
    const messages = await prisma.resumeMessage.findMany({
      where: {
        sessionId,
      },
      orderBy: {
        timestamp: 'asc',
      },
    })

    // Generate AI response
    if (!session.resumeFileUrl && !session.openaiFileId) {
      return NextResponse.json(
        { error: 'Session does not have a resume file' },
        { status: 400 }
      )
    }

    // Use OpenAI file ID if available, otherwise use fileUrl
    const fileReference = session.openaiFileId 
      ? `openai://${session.openaiFileId}` 
      : session.resumeFileUrl
    
    const manager = new ResumeChatManager(
      session.id,
      fileReference!,
      session.resumeFileName
    )

    // If OpenAI IDs exist, use them (session already initialized)
    if (session.openaiFileId && session.openaiAssistantId && session.openaiThreadId) {
      await manager.initializeWithIds(
        session.openaiFileId,
        session.openaiAssistantId,
        session.openaiThreadId
      )
    }

    // Check if user is asking for PDF/resume generation
    const userMessageLower = content.toLowerCase().trim()
    
    // Detect various ways user might request resume generation
    const isAffirmativeResponse = /^(yes|yeah|yep|sure|ok|okay|please|definitely|absolutely|go ahead|do it|let's do it|sounds good|that would be great|i'd like that|generate|create)/.test(userMessageLower)
    const isExplicitRequest = /pdf|download|generate.*resume|create.*resume|make.*resume|improved.*resume|new.*resume|formatted|polished/i.test(userMessageLower)
    const isGenerationRequest = isAffirmativeResponse || isExplicitRequest

    let additionalContext: string | undefined
    let resumeGenerated = false

    // If user is asking for PDF/generation, generate it
    if (isGenerationRequest) {
      try {
        console.log('[Messages API] Generation request detected, creating improved resume...')
        
        // Generate improved resume text
        const conversationHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
        
        const improvedResume = await manager.generateImprovedResume(conversationHistory)
        console.log('[Messages API] Improved resume generated, length:', improvedResume.length)
        console.log('[Messages API] First 300 chars:', improvedResume.substring(0, 300))
        
        // Save improved resume and clear cached parsed data so it re-parses the new version
        await prisma.resumeSession.update({
          where: { id: sessionId },
          data: { 
            improvedResumeText: improvedResume,
            parsedResumeData: Prisma.JsonNull, // Clear cache to force re-parsing of new version
          },
        })
        
        console.log('[Messages API] Improved resume saved to database and cache cleared')
        resumeGenerated = true
        additionalContext = `The user requested a generated resume. The improved resume has been created and saved to the database successfully. Tell them it's ready and they can use the "View Resume" and "Download PDF" buttons that will appear below to preview and download their polished resume. IMPORTANT: DO NOT output the resume text in your response - the system handles displaying it through the preview buttons. Just acknowledge that it's ready.`
      } catch (error) {
        console.error('Error generating resume:', error)
        additionalContext = `There was an issue generating the resume. Apologize briefly and ask them to try again.`
      }
    }

    const aiResponse = await manager.generateResponse(
      messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      additionalContext
    )

    // Save AI message
    const assistantMessage = await prisma.resumeMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: aiResponse,
      },
    })

    return NextResponse.json({
      userMessage,
      assistantMessage,
      resumeGenerated, // Let UI know if resume is ready
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

