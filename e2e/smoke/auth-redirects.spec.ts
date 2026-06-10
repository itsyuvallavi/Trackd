import { test, expect } from '@playwright/test'
import { isSupabaseConfigured } from '../helpers/env'

test.describe('auth redirects', () => {
  test.beforeEach(() => {
    test.skip(
      !isSupabaseConfigured(),
      'Requires NEXT_PUBLIC_SUPABASE_URL — skipped when Supabase is not configured',
    )
  })

  test('unauthenticated /jobs redirects to login', async ({ request }) => {
    const response = await request.get('/jobs', { maxRedirects: 0 })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers().location).toMatch(/\/login/)
    expect(response.headers().location).toContain('next=%2Fjobs')
  })

  test('unauthenticated /settings/integrations redirects to login', async ({ request }) => {
    const response = await request.get('/settings/integrations', { maxRedirects: 0 })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers().location).toMatch(/\/login/)
  })

  test('unauthenticated /board redirects to login', async ({ request }) => {
    const response = await request.get('/board', { maxRedirects: 0 })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers().location).toMatch(/\/login/)
  })
})
