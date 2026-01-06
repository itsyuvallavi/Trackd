import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

/**
 * GET /api/jobs
 * Get user's jobs with activities for client-side caching
 * Used by SWR for instant navigation
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    const jobs = await prisma.job.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        status: true,
        priority: true,
        source: true,
        url: true,
        savedAt: true,
        appliedAt: true,
        interviewAt: true,
        nextAction: true,
        tags: true,
        notes: true,
        salary: true,
        contactName: true,
        contactEmail: true,
        createdAt: true,
        updatedAt: true,
        activities: {
          orderBy: { createdAt: 'asc' },
          take: 5,
          select: {
            id: true,
            type: true,
            fromStatus: true,
            toStatus: true,
            createdAt: true,
            description: true,
          },
        },
      },
      orderBy: { savedAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error fetching jobs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}

