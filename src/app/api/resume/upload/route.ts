import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth'
import { getAIClient } from '@/lib/ai/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

/**
 * POST /api/resume/upload
 * Upload resume file directly to OpenAI and create a session
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    // Check upload rate limit (defense in depth - middleware also checks)
    const rateLimitResult = checkRateLimit(
      `upload:${user.id}`,
      RATE_LIMITS.upload.limit,
      RATE_LIMITS.upload.window
    )
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many file uploads. Please try again later.',
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.upload.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          },
        }
      )
    }
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF and TXT files are supported' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Upload directly to OpenAI
    const aiClient = getAIClient()
    let openaiFileId: string
    
    try {
      openaiFileId = await aiClient.uploadFile(fileBuffer, file.name)
      console.log('File uploaded to OpenAI:', openaiFileId)
    } catch (error) {
      console.error('OpenAI upload error:', error)
      return NextResponse.json(
        { error: 'Failed to upload file to AI service. Please try again.' },
        { status: 500 }
      )
    }

    // Create session with file reference
    // Store OpenAI file ID instead of Supabase URL
    const session = await prisma.resumeSession.create({
      data: {
        userId: user.id,
        resumeFileUrl: `openai://${openaiFileId}`, // Store as reference, not actual URL
        resumeFileName: file.name,
        resumeFileType: file.type,
        openaiFileId: openaiFileId, // Store OpenAI file ID directly
        resumeText: null, // Optional field - AI will read from file
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error uploading resume:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to upload resume: ${errorMessage}` },
      { status: 500 }
    )
  }
}

