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

  test('redeliverPending retries a dual-channel lead whose Bitrix push is still missing', async () => {
    // The core regression case: BOTH channels configured, Telegram already
    // succeeded (telegramSentAt set), Bitrix failed (bitrixSentAt null). The old
    // query keyed on telegramSentAt:null only and would strand this lead — the
    // manager's CRM would never receive it. Telegram must not be re-sent.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
      update: {
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
    })
    const bitrixCalls: unknown[] = []
    const telegramCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
      bitrixSender: async (_url, body) => (bitrixCalls.push(body), true),
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 902 000-00-00', consentAt: new Date(), telegramSentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    expect(bitrixCalls).toHaveLength(1)
    expect(telegramCalls).toHaveLength(0)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.bitrixSentAt).not.toBeNull()
  })

  test('redeliverPending skips a lead already delivered on both configured channels', async () => {
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
      update: {
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
    })
    const calls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (calls.push(body), true),
      bitrixSender: async (_url, body) => (calls.push(body), true),
    })
    await prisma.lead.create({
      data: {
        name: 'Лид',
        phone: '+7 904 000-00-00',
        consentAt: new Date(),
        telegramSentAt: new Date(),
        bitrixSentAt: new Date(),
      },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('redeliverPending retries a pending lead when only Telegram is configured', async () => {
    // Most common production setup. Verifies the positive Telegram-only path:
    // a not-yet-delivered lead is picked up and its flag stamped.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', telegramBotToken: 'T', telegramChatId: 'C' },
      update: { telegramBotToken: 'T', telegramChatId: 'C', bitrixEnabled: false, bitrixWebhookUrl: null },
    })
    const telegramCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 906 000-00-00', consentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    expect(telegramCalls).toHaveLength(1)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.telegramSentAt).not.toBeNull()
  })

  test('redeliverPending retries a pending lead when only Bitrix is configured', async () => {
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', bitrixEnabled: true, bitrixWebhookUrl: 'https://b24.example/hook' },
      update: { bitrixEnabled: true, bitrixWebhookUrl: 'https://b24.example/hook', telegramBotToken: null, telegramChatId: null },
    })
    const bitrixCalls: unknown[] = []
    const service = new LeadService(prisma, {
      bitrixSender: async (_url, body) => (bitrixCalls.push(body), true),
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 907 000-00-00', consentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    expect(bitrixCalls).toHaveLength(1)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.bitrixSentAt).not.toBeNull()
  })

  test('redeliverPending retries a dual-channel lead whose Telegram push is still missing', async () => {
    // Mirror of the Bitrix-pending case: Bitrix already delivered, Telegram
    // failed. Telegram must catch up while Bitrix is not re-sent.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
      update: {
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
    })
    const telegramCalls: unknown[] = []
    const bitrixCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
      bitrixSender: async (_url, body) => (bitrixCalls.push(body), true),
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 908 000-00-00', consentAt: new Date(), bitrixSentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    expect(telegramCalls).toHaveLength(1)
    expect(bitrixCalls).toHaveLength(0)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.telegramSentAt).not.toBeNull()
  })

  test('redeliverPending delivers both channels for a lead that never got either', async () => {
    // Dominant retry scenario: deliver() never ran or crashed at create time, so
    // both flags are null. One scan must deliver to both configured channels.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
      update: {
        telegramBotToken: 'T',
        telegramChatId: 'C',
        bitrixEnabled: true,
        bitrixWebhookUrl: 'https://b24.example/hook',
      },
    })
    const telegramCalls: unknown[] = []
    const bitrixCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
      bitrixSender: async (_url, body) => (bitrixCalls.push(body), true),
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 912 000-00-00', consentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    expect(telegramCalls).toHaveLength(1)
    expect(bitrixCalls).toHaveLength(1)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.telegramSentAt).not.toBeNull()
    expect(stored?.bitrixSentAt).not.toBeNull()
  })

  test('redeliverPending counts attempts but leaves the flag null when the sender fails', async () => {
    // `retried` reports leads selected for a retry, not successful deliveries.
    // A sender that keeps failing leaves the flag null so the next tick retries.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', bitrixEnabled: true, bitrixWebhookUrl: 'https://b24.example/hook' },
      update: { bitrixEnabled: true, bitrixWebhookUrl: 'https://b24.example/hook' },
    })
    const service = new LeadService(prisma, {
      bitrixSender: async () => false,
    })
    const lead = await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 909 000-00-00', consentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(1)
    const stored = await prisma.lead.findUnique({ where: { id: lead.id } })
    expect(stored?.bitrixSentAt).toBeNull()
  })

  test('redeliverPending ignores leads outside the retry window and SPAM leads', async () => {
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', telegramBotToken: 'T', telegramChatId: 'C' },
      update: { telegramBotToken: 'T', telegramChatId: 'C' },
    })
    const telegramCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
    })
    // Older than the 48h window.
    await prisma.lead.create({
      data: {
        name: 'Старый',
        phone: '+7 910 000-00-00',
        consentAt: new Date(),
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    })
    // Recent but marked SPAM.
    await prisma.lead.create({
      data: { name: 'Спам', phone: '+7 911 000-00-00', consentAt: new Date(), status: 'SPAM' },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(0)
    expect(telegramCalls).toHaveLength(0)
  })

  test('redeliverPending is a no-op when no channel is configured', async () => {
    // No siteSettings row at all (first boot / reset): nothing is deliverable,
    // so the scan must short-circuit instead of re-processing the whole window.
    const calls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (calls.push(body), true),
      bitrixSender: async (_url, body) => (calls.push(body), true),
    })
    await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 905 000-00-00', consentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(0)
    expect(calls).toHaveLength(0)
  })

  test('redeliverPending ignores already-delivered leads when only Telegram is configured', async () => {
    // Common deployment: Telegram set up, Bitrix off. A lead delivered to
    // Telegram must NOT be re-scanned every tick just because bitrixSentAt is
    // null on a disabled channel.
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', telegramBotToken: 'T', telegramChatId: 'C' },
      update: { telegramBotToken: 'T', telegramChatId: 'C', bitrixEnabled: false, bitrixWebhookUrl: null },
    })
    const bitrixCalls: unknown[] = []
    const telegramCalls: unknown[] = []
    const service = new LeadService(prisma, {
      telegramSender: async (_url, body) => (telegramCalls.push(body), true),
      bitrixSender: async (_url, body) => (bitrixCalls.push(body), true),
    })
    await prisma.lead.create({
      data: { name: 'Лид', phone: '+7 903 000-00-00', consentAt: new Date(), telegramSentAt: new Date() },
    })

    const { retried } = await service.redeliverPending()
    expect(retried).toBe(0)
    expect(telegramCalls).toHaveLength(0)
    expect(bitrixCalls).toHaveLength(0)
  })
})
