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
  transaction: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  parseResumePdf: vi.fn(),
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
    $transaction: mocks.transaction,
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/bot/resume/parser', () => ({
  parseResumePdf: mocks.parseResumePdf,
}))

import { POST } from './route'

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
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.create.mockResolvedValue({
      id: 'resume_1',
      userId: 'user_1',
      label: 'Software Engineer',
      matchKeywords: ['engineer', 'frontend'],
      isDefault: true,
      fileUrl: 'https://trackd.supabase.co/storage/v1/object/public/resume/bot-resumes/user_1/file.pdf',
      fileName: 'My Resume.pdf',
      rawText: null,
      structuredData: null,
      createdAt: new Date('2026-05-16T00:00:00.000Z'),
      updatedAt: new Date('2026-05-16T00:00:00.000Z'),
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
    })
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
