import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'
import { LeadService } from './service'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('lead API integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
    REGISTRATION_ENABLED: true,
    SPACES_UPLOAD_MAX_BYTES: 10 * 1024 * 1024,
    SPACES_UPLOAD_URL_TTL_SECONDS: 900,
    SPACES_DOWNLOAD_URL_TTL_SECONDS: 300,
    SPACES_PUBLIC_CACHE_CONTROL: 'public, max-age=31536000, immutable',
  }
  const prisma = createPrisma(databaseUrl!)
  const app = createApp({ env, prisma })

  async function authToken() {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    })
    return (await res.json()).accessToken as string
  }

  const validLead = { name: 'Анна', phone: '+7 900 000-00-00', consent: true, source: 'Главная' }

  beforeEach(async () => {
    await prisma.lead.deleteMany()
    await prisma.siteSettings.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('accepts a consented lead and stores it with consentAt', async () => {
    const res = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLead),
    })
    expect(res.status).toBe(201)
    const { lead } = await res.json()
    expect(lead.name).toBe('Анна')
    expect(lead.consentAt).toBeTruthy()
    expect(lead.status).toBe('NEW')
    expect(await prisma.lead.count()).toBe(1)
  })

  test('rejects a lead without consent', async () => {
    const res = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Анна', phone: '+7 900 000-00-00' }),
    })
    expect(res.status).toBe(400)
    expect(await prisma.lead.count()).toBe(0)
  })

  test('rejects a lead when the honeypot is filled', async () => {
    const res = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validLead, honeypot: 'I am a bot' }),
    })
    expect(res.status).toBe(400)
    expect(await prisma.lead.count()).toBe(0)
  })

  test('collapses a quick re-submit onto the first lead', async () => {
    const first = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLead),
    })
    const second = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLead),
    })
    const firstId = (await first.json()).lead.id
    const secondId = (await second.json()).lead.id
    expect(secondId).toBe(firstId)
    expect(await prisma.lead.count()).toBe(1)
  })

  test('admin listing requires auth and supports status filtering', async () => {
    await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLead),
    })

    const unauth = await app.request('/api/admin/leads')
    expect(unauth.status).toBe(401)

    const token = await authToken()
    const list = await app.request('/api/admin/leads?status=NEW', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body.total).toBe(1)

    const empty = await app.request('/api/admin/leads?status=DONE', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect((await empty.json()).total).toBe(0)
  })

  test('admin can change a lead status', async () => {
    const created = await app.request('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLead),
    })
    const id = (await created.json()).lead.id
    const token = await authToken()
    const patched = await app.request(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'SPAM' }),
    })
    expect(patched.status).toBe(200)
    expect((await patched.json()).lead.status).toBe('SPAM')
  })

  test('delivery marks the Telegram flag when configured', async () => {
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', telegramBotToken: 'T', telegramChatId: 'C' },
      update: { telegramBotToken: 'T', telegramChatId: 'C' },
    })
    const sent: unknown[] = []
    const service = new LeadService(prisma, { telegramSender: async (_url, body) => (sent.push(body), true) })
    // Insert the row directly to isolate deliver() from create()'s background send.
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 901 000-00-00', consentAt: new Date() },
    })
    await service.deliver(lead.id)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.telegramSentAt).not.toBeNull()
    expect(sent).toHaveLength(1)

    // Re-delivering is idempotent: the flag is already set, so no second send.
    await service.deliver(lead.id)
    expect(sent).toHaveLength(1)
  })
})
