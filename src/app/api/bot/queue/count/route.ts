import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ count: 0, error: 'Unauthorized' }, { status: 401 })
  }

  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count
    FROM (
      SELECT lower(trim(company)) AS company_key, lower(trim(title)) AS title_key
      FROM "Job"
      WHERE "userId" = ${user.id}
        AND status = 'SAVED'::"JobStatus"
        AND tags @> ARRAY['bot-approved']::text[]
      GROUP BY lower(trim(company)), lower(trim(title))
    ) deduped_queue
  `

  return NextResponse.json({
    count: Number(row?.count ?? 0),
  })
}
