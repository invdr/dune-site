import { describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import type { DbClient } from '../db'
import type { AppEnv } from '../env'

const env: AppEnv = {
  PORT: 3000,
  DATABASE_URL: 'postgresql://superuser:superpassword@localhost:54329/web_app_demo',
  JWT_SECRET: 'test-route-secret-at-least-thirty-two-chars-123',
  CORS_ORIGINS: ['https://web.example.com'],
  ACCESS_TOKEN_TTL_SECONDS: 60,
  REFRESH_TOKEN_TTL_DAYS: 30,
  COOKIE_SECURE: true,
  REGISTRATION_ENABLED: false,
  SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
  SPACES_UPLOAD_URL_TTL_SECONDS: 900,
  SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
  SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
}

// These cases short-circuit before any database access (auth guard / request
// validation), so a stub DbClient is enough to exercise them.
describe('property routes guards', () => {
  test('admin list requires authentication', async () => {
    const app = createApp({ env, prisma: {} as DbClient })

    const response = await app.request('/api/admin/properties')
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  test('admin create requires authentication before reading the body', async () => {
    const app = createApp({ env, prisma: {} as DbClient })

    const response = await app.request('/api/admin/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'gz-99' }),
    })

    expect(response.status).toBe(401)
  })

  test('public list rejects invalid query parameters', async () => {
    const app = createApp({ env, prisma: {} as DbClient })

    const response = await app.request('/api/properties?sort=cheapest')
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  test('public detail rejects malformed slugs', async () => {
    const app = createApp({ env, prisma: {} as DbClient })

    const response = await app.request('/api/properties/Invalid_Slug')

    expect(response.status).toBe(400)
  })
})
