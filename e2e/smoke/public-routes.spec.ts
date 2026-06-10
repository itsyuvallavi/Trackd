import { test, expect } from '@playwright/test'

const VALID_UNKNOWN_KEY = `tk_${'a'.repeat(32)}`

test.describe('public routes', () => {
  test('homepage shows login', async ({ request }) => {
    const response = await request.get('/')
    expect(response.ok()).toBeTruthy()
    const html = await response.text()
    expect(html).toContain('Welcome back')
    expect(html).toContain('placeholder="Email"')
    expect(html).toContain('Trackd')
  })

  test('signup page loads', async ({ request }) => {
    const response = await request.get('/signup')
    expect(response.ok()).toBeTruthy()
    const html = await response.text()
    expect(html).toContain('Create your account')
  })

  test('login route redirects to homepage with next param', async ({ request }) => {
    const response = await request.get('/login', { maxRedirects: 0 })
    expect(response.status()).toBeGreaterThanOrEqual(300)
    expect(response.status()).toBeLessThan(400)
    expect(response.headers().location).toContain('next=%2Fjobs')
  })

  test('protected API routes reject unauthenticated requests', async ({ request }) => {
    const queue = await request.get('/api/bot/queue/count')
    expect(queue.status()).toBe(401)

    const notifications = await request.get('/api/notifications/count')
    expect(notifications.status()).toBe(401)
  })

  test('extension validate-key rejects invalid format', async ({ request }) => {
    const response = await request.post('/api/extension/validate-key', {
      data: { key: 'not-a-valid-key' },
    })
    expect(response.status()).toBe(400)
  })

  test('extension validate-key rejects unknown key', async ({ request }) => {
    const response = await request.post('/api/extension/validate-key', {
      data: { key: VALID_UNKNOWN_KEY },
    })
    expect([401, 500]).toContain(response.status())
  })
})
