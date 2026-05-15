import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  extensionKey: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const fetchPublicHttpTextMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: {
    extension: { limit: 100, window: 60_000 },
  },
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 99,
    resetAt: Date.now() + 60_000,
  })),
}))

vi.mock('@/lib/url-security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/url-security')>()
  return {
    ...actual,
    fetchPublicHttpText: fetchPublicHttpTextMock,
  }
})

import { POST } from './route'

const validKey = `tk_${'a'.repeat(32)}`

function scrapeRequest(input: { key?: string; url: string }) {
  return new NextRequest('https://trackd.test/api/scrape-job', {
    method: 'POST',
    headers: {
      ...(input.key ? { 'X-Extension-Key': input.key } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: input.url }),
  })
}

describe('POST /api/scrape-job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.extensionKey.findUnique.mockResolvedValue({
      id: 'extension-key-1',
      userId: 'user-1',
    })
    prismaMock.extensionKey.update.mockResolvedValue({})
  })

  it('rejects malformed extension keys before database lookup', async () => {
    const response = await POST(scrapeRequest({
      key: 'tk_short',
      url: 'https://jobs.example.com/posting',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'Invalid extension key format' })
    expect(prismaMock.extensionKey.findUnique).not.toHaveBeenCalled()
    expect(fetchPublicHttpTextMock).not.toHaveBeenCalled()
  })

  it('returns redirect validation failures from the public HTTP fetcher', async () => {
    fetchPublicHttpTextMock.mockResolvedValue({
      ok: false,
      error: 'Redirected URL is not allowed',
      status: 400,
    })

    const response = await POST(scrapeRequest({
      key: validKey,
      url: 'https://jobs.example.com/posting',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'Redirected URL is not allowed' })
    expect(prismaMock.extensionKey.findUnique).toHaveBeenCalledOnce()
    expect(fetchPublicHttpTextMock).toHaveBeenCalledWith(
      'https://jobs.example.com/posting',
      expect.objectContaining({
        maxRedirects: 5,
        maxBytes: 5 * 1024 * 1024,
      }),
    )
  })

  it('extracts from the final validated URL returned by the public HTTP fetcher', async () => {
    fetchPublicHttpTextMock.mockResolvedValue({
      ok: true,
      url: new URL('https://boards.example.com/final'),
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      text: '<html><head><meta property="og:site_name" content="Acme"></head><body><h1>Senior Engineer</h1></body></html>',
    })

    const response = await POST(scrapeRequest({
      key: validKey,
      url: 'https://jobs.example.com/posting',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      data: {
        title: 'Senior Engineer',
        company: 'Acme',
      },
    })
    expect(prismaMock.extensionKey.update).toHaveBeenCalledWith({
      where: { id: 'extension-key-1' },
      data: { lastUsedAt: expect.any(Date) },
    })
  })
})
