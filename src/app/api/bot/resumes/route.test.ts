import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => void) => callback()),
  revalidateTag: vi.fn(),
  requireAuth: vi.fn(),
  createClient: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  remove: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  parseResumePdf: vi.fn(),
  ResumeParseError: class ResumeParseError extends Error {
    constructor(
      message: string,
      readonly rawText: string | null = null,
    ) {
      super(message)
      this.name = 'ResumeParseError'
    }
  },
}))

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    after: mocks.after,
  }
})

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}))

vi.mock('@/lib/auth', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    botResume: {
      findMany: mocks.findMany,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/bot/resume/parser', () => ({
  parseResumePdf: mocks.parseResumePdf,
  ResumeParseError: mocks.ResumeParseError,
}))

import { GET, POST } from './route'

function requestWithResume(input: {
  fileName?: string
  label?: string
  matchKeywords?: string
  isDefault?: boolean
} = {}) {
  const formData = new FormData()
  formData.set(
    'file',
    new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], input.fileName ?? 'My Resume.pdf', {
      type: 'application/pdf',
    }),
  )
  formData.set('label', input.label ?? 'Software Engineer')
  formData.set('matchKeywords', input.matchKeywords ?? 'engineer, frontend')
  formData.set('isDefault', String(input.isDefault ?? true))

  return new NextRequest('https://trackd.test/api/bot/resumes', {
    method: 'POST',
    body: formData,
  })
}

function setupStorage() {
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    getPublicUrl: mocks.getPublicUrl,
    remove: mocks.remove,
  })
  mocks.createClient.mockReturnValue({
    storage: {
      from: mocks.storageFrom,
    },
  })
}

describe('POST /api/bot/resumes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://trackd.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('OPENAI_API_KEY', '')

    mocks.requireAuth.mockResolvedValue({ id: 'user_1' })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://trackd.supabase.co/storage/v1/object/public/resume/bot-resumes/user_1/file.pdf' },
    })
    mocks.remove.mockResolvedValue({ error: null })
    mocks.findMany.mockResolvedValue([])
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.create.mockResolvedValue({
      id: 'resume_1',
      label: 'Software Engineer',
      matchKeywords: ['engineer', 'frontend'],
      isDefault: true,
      fileUrl: 'https://trackd.supabase.co/storage/v1/object/public/resume/bot-resumes/user_1/file.pdf',
      fileName: 'My Resume.pdf',
      structuredData: null,
      createdAt: new Date('2026-05-16T00:00:00.000Z'),
    })
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        botResume: {
          updateMany: mocks.updateMany,
          create: mocks.create,
        },
      }),
    )
    setupStorage()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a configured error instead of throwing when storage credentials are missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    const response = await POST(requestWithResume())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Resume upload is not configured. Missing storage credentials.',
    })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('returns a safe error when Supabase Storage rejects the upload', async () => {
    mocks.upload.mockResolvedValue({ error: { message: 'Bucket not found' } })

    const response = await POST(requestWithResume())

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: 'Resume file upload failed. Please try again.',
    })
    expect(mocks.storageFrom).toHaveBeenCalledWith('resume')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('uploads the PDF and stores the bot resume record', async () => {
    const response = await POST(requestWithResume({ fileName: 'My Resume (Final).pdf' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: 'resume_1',
      label: 'Software Engineer',
      matchKeywords: ['engineer', 'frontend'],
    })
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^bot-resumes\/user_1\/\d+-My_Resume_Final_.pdf$/),
      expect.any(Buffer),
      { contentType: 'application/pdf', upsert: false },
    )
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      data: { isDefault: false },
    })
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        label: 'Software Engineer',
        fileName: 'My Resume (Final).pdf',
        isDefault: true,
      }),
      select: expect.not.objectContaining({ rawText: true }),
    })
  })

  it('persists parsed structured data and raw text for the authenticated user without returning raw text', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    mocks.requireAuth.mockResolvedValue({ id: 'user_2' })
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://trackd.supabase.co/storage/v1/object/public/resume/bot-resumes/user_2/file.pdf' },
    })

    const structuredData = {
      name: 'Ada Candidate',
      email: 'ada@example.test',
      skills: ['React', 'TypeScript'],
      experience: [],
      education: [],
      summary: 'Frontend engineer',
    }
    const rawText = 'Sensitive raw resume text with phone and address'

    mocks.parseResumePdf.mockResolvedValue({ structured: structuredData, rawText })
    mocks.create.mockImplementation(async ({ data }) => ({
      id: 'resume_2',
      label: data.label,
      matchKeywords: data.matchKeywords,
      isDefault: data.isDefault,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      structuredData: data.structuredData,
      createdAt: new Date('2026-05-17T00:00:00.000Z'),
      rawText: data.rawText,
    }))

    const response = await POST(requestWithResume({
      fileName: 'Ada Resume.pdf',
      label: 'Frontend',
      matchKeywords: 'React, TypeScript',
      isDefault: false,
    }))
    const body = await response.json()
    const createArgs = mocks.create.mock.calls[0]?.[0]

    expect(response.status).toBe(200)
    expect(mocks.parseResumePdf).toHaveBeenCalledWith(expect.any(Buffer), 'Ada Resume.pdf')
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^bot-resumes\/user_2\/\d+-Ada_Resume.pdf$/),
      expect.any(Buffer),
      { contentType: 'application/pdf', upsert: false },
    )
    expect(createArgs.data).toEqual(expect.objectContaining({
      userId: 'user_2',
      label: 'Frontend',
      matchKeywords: ['React', 'TypeScript'],
      isDefault: false,
      rawText,
      structuredData,
    }))
    expect(createArgs.select).not.toHaveProperty('rawText')
    expect(body).toMatchObject({
      id: 'resume_2',
      label: 'Frontend',
      structuredData,
    })
    expect(body).not.toHaveProperty('rawText')
    expect(JSON.stringify(body)).not.toContain(rawText)
    expect(mocks.updateMany).not.toHaveBeenCalled()
  })

  it('persists raw fallback text when structured parsing fails after text extraction', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key')
    const fallbackText = 'Extracted resume text mentions React, TypeScript, and customer workflows.'

    mocks.parseResumePdf.mockRejectedValue(
      new mocks.ResumeParseError('Could not parse resume JSON', fallbackText),
    )
    mocks.create.mockImplementation(async ({ data }) => ({
      id: 'resume_raw_fallback',
      label: data.label,
      matchKeywords: data.matchKeywords,
      isDefault: data.isDefault,
      fileUrl: data.fileUrl,
      fileName: data.fileName,
      structuredData: data.structuredData ?? null,
      createdAt: new Date('2026-05-17T00:00:00.000Z'),
      rawText: data.rawText,
    }))

    const response = await POST(requestWithResume({ label: 'Raw fallback' }))
    const body = await response.json()
    const createArgs = mocks.create.mock.calls[0]?.[0]

    expect(response.status).toBe(200)
    expect(createArgs.data).toEqual(expect.objectContaining({
      userId: 'user_1',
      label: 'Raw fallback',
      rawText: fallbackText,
      structuredData: undefined,
    }))
    expect(body).toMatchObject({
      id: 'resume_raw_fallback',
      label: 'Raw fallback',
      structuredData: null,
    })
    expect(body).not.toHaveProperty('rawText')
    expect(JSON.stringify(body)).not.toContain(fallbackText)
  })

  it('removes the uploaded file when the database write fails', async () => {
    mocks.create.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(requestWithResume())

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: 'Resume upload failed. Please try again.',
    })
    expect(mocks.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^bot-resumes\/user_1\/\d+-My_Resume.pdf$/),
    ])
  })
})

describe('GET /api/bot/resumes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user_get' })
  })

  it('queries only the authenticated user and returns resumes without raw text', async () => {
    const rawText = 'Sensitive GET raw resume text'
    mocks.findMany.mockResolvedValue([
      {
        id: 'resume_get_1',
        label: 'Frontend',
        matchKeywords: ['React'],
        isDefault: true,
        fileName: 'frontend.pdf',
        fileUrl: 'https://trackd.test/resume.pdf',
        structuredData: { name: 'Ada Candidate' },
        createdAt: new Date('2026-05-18T00:00:00.000Z'),
        rawText,
      },
    ])

    const response = await GET()
    const body = await response.json()
    const findManyArgs = mocks.findMany.mock.calls[0]?.[0]

    expect(response.status).toBe(200)
    expect(findManyArgs).toEqual({
      where: { userId: 'user_get' },
      select: expect.not.objectContaining({ rawText: true }),
      orderBy: { createdAt: 'asc' },
    })
    expect(findManyArgs.select).not.toHaveProperty('rawText')
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      id: 'resume_get_1',
      label: 'Frontend',
      structuredData: { name: 'Ada Candidate' },
    })
    expect(body[0]).not.toHaveProperty('rawText')
    expect(JSON.stringify(body)).not.toContain(rawText)
  })
})
