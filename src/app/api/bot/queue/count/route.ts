import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getBotQueueCount } from '@/lib/cached-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ count: 0, error: 'Unauthorized' }, { status: 401 })
  }

  const count = await getBotQueueCount(user.id)

  return NextResponse.json({
    count,
  })
}
