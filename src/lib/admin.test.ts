import { describe, expect, it } from 'vitest'
import { getAdminEmail } from './admin'

describe('admin helpers', () => {
  it('fails closed in production when ADMIN_EMAIL is missing', () => {
    expect(getAdminEmail({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull()
  })

  it('uses the configured admin email when present', () => {
    expect(
      getAdminEmail({
        NODE_ENV: 'production',
        ADMIN_EMAIL: 'admin@trackd.test',
      } as NodeJS.ProcessEnv),
    ).toBe('admin@trackd.test')
  })
})
