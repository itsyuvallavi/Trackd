import { JobStatus } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  getUserJobsListRows,
  getUserJobsListTotal,
  type JobsListStatusFilter,
} from '@/lib/cached-queries'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID_STATUS_FILTERS = new Set<string>([
  'all',
  ...Object.values(JobStatus),
])

function intParam(value: string | null, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const rawStatus = searchParams.get('status') ?? 'all'
  const status: JobsListStatusFilter = VALID_STATUS_FILTERS.has(rawStatus)
    ? (rawStatus as JobsListStatusFilter)
    : 'all'
  const limit = Math.min(intParam(searchParams.get('limit'), 50), 100)
  const offset = intParam(searchParams.get('offset'), 0)
  const query = searchParams.get('q') ?? ''
  const includeTotal = searchParams.get('includeTotal') !== 'false'
  const options = { status, limit, offset, query }

  const [jobs, total] = await Promise.all([
    getUserJobsListRows(user.id, options),
    includeTotal ? getUserJobsListTotal(user.id, options) : Promise.resolve(null),
  ])
  const resolvedTotal = total ?? null

  return NextResponse.json({
    jobs,
    total: resolvedTotal,
    limit,
    offset,
    hasMore: includeTotal && resolvedTotal !== null
      ? offset + jobs.length < resolvedTotal
      : jobs.length === limit,
  })
}
