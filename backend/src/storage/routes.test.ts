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
  SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
  SPACES_UPLOAD_URL_TTL_SECONDS: 900,
  SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
  SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
}

// The auth guard runs before any storage/DB access, so a stub DbClient suffices.
describe('admin upload routes guard', () => {
  test('presign requires authentication before reading the body', async () => {
    const app = createApp({ env, prisma: {} as DbClient })

    const response = await app.request('/api/admin/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'a.jpg', contentType: 'image/jpeg', byteSize: 100 }),
    })
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
