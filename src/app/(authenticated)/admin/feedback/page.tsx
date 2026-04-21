import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FeedbackList } from '@/components/admin/feedback-list'
import { serializeForClient } from '@/lib/serialize-for-client'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@yuvallavi.com'

export default async function AdminFeedbackPage() {
  const user = await requireAuth()

  // Check if user is admin
  if (user.email !== ADMIN_EMAIL) {
    redirect('/jobs')
  }

  // Fetch all feedback
  const feedback = await prisma.feedback.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get user profiles for feedback with userId
  const userIds = [...new Set(feedback.filter(f => f.userId).map(f => f.userId!))]
  const profiles = await prisma.profile.findMany({
    where: {
      id: {
        in: userIds,
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  // Enrich feedback with user info
  const enrichedFeedback = feedback.map(f => ({
    ...f,
    userName: f.userId ? profileMap.get(f.userId)?.name : null,
    userEmail: f.userEmail || (f.userId ? profileMap.get(f.userId)?.email : null),
  }))

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Feedback Management</h1>
        <p className="text-sm text-muted-foreground">
          Review and manage user feedback submissions
        </p>
      </div>
      <FeedbackList feedback={serializeForClient(enrichedFeedback)} />
    </div>
  )
}

