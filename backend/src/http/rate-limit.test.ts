import { describe, expect, test } from 'bun:test'
import { Hono } from 'hono'

import { createRateLimit } from './rate-limit'
import { handleError } from './errors'

function appWith(limit: number, windowMs: number) {
  const app = new Hono()
  app.onError(handleError)
  app.use('*', createRateLimit({ limit, windowMs }))
  app.get('/', (c) => c.json({ ok: true }))
  return app
}

const ip = (value: string) => ({ headers: { 'x-forwarded-for': value } })

describe('createRateLimit', () => {
  test('allows up to the limit then returns 429', async () => {
    const app = appWith(3, 60_000)
    for (let i = 0; i < 3; i += 1) {
      expect((await app.request('/', ip('1.1.1.1'))).status).toBe(200)
    }
    const blocked = await app.request('/', ip('1.1.1.1'))
    expect(blocked.status).toBe(429)
    expect((await blocked.json()).error.code).toBe('RATE_LIMITED')
  })

  test('tracks each IP independently', async () => {
    const app = appWith(1, 60_000)
    expect((await app.request('/', ip('1.1.1.1'))).status).toBe(200)
    expect((await app.request('/', ip('1.1.1.1'))).status).toBe(429)
    // A different IP still has its own budget.
    expect((await app.request('/', ip('2.2.2.2'))).status).toBe(200)
  })

  test('frees the budget once the window elapses', async () => {
    const app = appWith(1, 20)
    expect((await app.request('/', ip('3.3.3.3'))).status).toBe(200)
    expect((await app.request('/', ip('3.3.3.3'))).status).toBe(429)
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect((await app.request('/', ip('3.3.3.3'))).status).toBe(200)
  })
})
