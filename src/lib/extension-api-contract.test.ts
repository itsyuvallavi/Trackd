import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

const validateKeyRoute = readRepoFile('src/app/api/extension/validate-key/route.ts')
const saveJobRoute = readRepoFile('src/app/api/extension/save-job/route.ts')
const extensionJobs = readRepoFile('src/lib/extension-jobs.ts')
const nextConfig = readRepoFile('next.config.ts')

describe('extension API route contract', () => {
  it('validates extension keys by format, SHA-256 hash lookup, and profile ownership', () => {
    expect(validateKeyRoute).toContain('const { key } = await request.json()')
    expect(validateKeyRoute).toContain('isValidExtensionKeyFormat(key)')
    expect(validateKeyRoute).toContain('hashExtensionKey(key)')
    expect(extensionJobs).toContain("/^tk_[A-Za-z0-9_-]{32}$/")
    expect(extensionJobs).toContain("createHash('sha256').update(key).digest('hex')")
    expect(validateKeyRoute).toContain("`extension:key:${keyHash.slice(0, 16)}`")
    expect(validateKeyRoute).toContain('prisma.extensionKey.findUnique')
    expect(validateKeyRoute).toContain('where: { keyHash }')
    expect(validateKeyRoute).toContain('where: { id: extensionKey.userId }')
    expect(validateKeyRoute).toContain('valid: true')
    expect(validateKeyRoute).toContain('email: profile.email')
  })

  it('authenticates save requests with X-Extension-Key before reading job payloads', () => {
    const keyReadIndex = saveJobRoute.indexOf("request.headers.get('X-Extension-Key')")
    const jsonReadIndex = saveJobRoute.indexOf('await request.json()')

    expect(keyReadIndex).toBeGreaterThanOrEqual(0)
    expect(jsonReadIndex).toBeGreaterThan(keyReadIndex)
    expect(saveJobRoute).toContain('hashExtensionKey(key)')
    expect(saveJobRoute).toContain('isValidExtensionKeyFormat(key)')
    expect(saveJobRoute).toContain("`extension:key:${keyHash.slice(0, 16)}`")
    expect(saveJobRoute).toContain('prisma.extensionKey.findUnique')
    expect(saveJobRoute).toContain('where: { keyHash }')
  })

  it('sanitizes extension save payload fields and rejects unsafe URL protocols', () => {
    expect(saveJobRoute).toContain('sanitizeExtensionJobPayload(jobData)')
    expect(saveJobRoute).toContain('sanitized.error')
    expect(saveJobRoute).toContain('sanitized.status')
    expect(extensionJobs).toContain('Company is required')
    expect(extensionJobs).toContain('Title is required')
    expect(extensionJobs).toContain('jobData.company.trim().slice(0, 200)')
    expect(extensionJobs).toContain('jobData.title.trim().slice(0, 300)')
    expect(extensionJobs).toContain('String(jobData.url).trim().slice(0, 2048)')
    expect(extensionJobs).toContain("!['http:', 'https:'].includes(urlObj.protocol)")
    expect(extensionJobs).toContain('Company and title cannot be empty')
  })

  it('returns a duplicate conflict contract the popup can consume', () => {
    expect(saveJobRoute).toContain('prisma.job.findFirst')
    expect(saveJobRoute).toContain('company: { equals: company, mode: \'insensitive\' }')
    expect(saveJobRoute).toContain('title: { equals: title, mode: \'insensitive\' }')
    expect(saveJobRoute).toContain("error: 'DUPLICATE_JOB'")
    expect(saveJobRoute).toContain('existingJob')
    expect(saveJobRoute).toContain('{ status: 409 }')
  })

  it('creates saved extension jobs with source mapping and last-used key updates', () => {
    expect(saveJobRoute).toContain('const { company, title, location, url, salary, source, sourceLabel }')
    expect(extensionJobs).toContain('const sourceMap: Record<string, JobSource>')
    expect(extensionJobs).toContain('LinkedIn: JobSource.LINKEDIN')
    expect(extensionJobs).toContain("'Landing.jobs': JobSource.LANDING_JOBS")
    expect(extensionJobs).toContain('ZipRecruiter: JobSource.ZIPRECRUITER')
    expect(extensionJobs).toContain('sourceMap[source] ?? JobSource.OTHER')
    expect(saveJobRoute).toContain('prisma.job.create')
    expect(saveJobRoute).toContain('prisma.activity.create')
    expect(saveJobRoute).toContain('prisma.extensionKey.update')
    expect(saveJobRoute).toContain('data: { lastUsedAt: new Date() }')
  })

  it('declares CORS headers expected by extension API requests', () => {
    expect(nextConfig).toContain("source: '/api/extension/:path*'")
    expect(nextConfig).toContain("'Access-Control-Allow-Origin'")
    expect(nextConfig).toContain("'Access-Control-Allow-Methods'")
    expect(nextConfig).toContain("'GET, POST, OPTIONS'")
    expect(nextConfig).toContain("'Access-Control-Allow-Headers'")
    expect(nextConfig).toContain("'Content-Type, X-Extension-Key'")
  })
})
