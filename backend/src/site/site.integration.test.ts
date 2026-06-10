import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('site, managers, fx integration', () => {
  const env: AppEnv = {
    PORT: 3000,
    DATABASE_URL: databaseUrl!,
    JWT_SECRET: '12345678901234567890123456789012',
    CORS_ORIGINS: ['http://localhost:5173'],
    ACCESS_TOKEN_TTL_SECONDS: 60,
    REFRESH_TOKEN_TTL_DAYS: 30,
    COOKIE_SECURE: false,
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
  const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })

  beforeEach(async () => {
    await prisma.lead.deleteMany()
    await prisma.property.deleteMany()
    await prisma.manager.deleteMany()
    await prisma.fxRate.deleteMany()
    await prisma.siteSettings.deleteMany()
    await prisma.homeContent.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  async function publishProperty(overrides: Record<string, unknown> = {}) {
    return prisma.property.create({
      data: {
        slug: `p-${Math.random().toString(36).slice(2, 8)}`,
        direction: 'DUBAI',
        type: 'APARTMENT',
        status: 'PUBLISHED',
        title: 'Marina view',
        area: 96,
        city: 'Dubai',
        price: 450000,
        currency: 'USD',
        ...overrides,
      },
    })
  }

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('manager CRUD: create, public lookup, inactive hidden, duplicate rejected', async () => {
    const token = await authToken()
    const created = await app.request('/api/admin/managers', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ direction: 'DUBAI', name: 'Ислам', phone: '+7 900 000-00-00' }),
    })
    expect(created.status).toBe(201)

    const publicLookup = await app.request('/api/managers/DUBAI')
    expect(publicLookup.status).toBe(200)
    expect((await publicLookup.json()).manager.name).toBe('Ислам')

    const duplicate = await app.request('/api/admin/managers', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ direction: 'DUBAI', name: 'Другой' }),
    })
    expect(duplicate.status).toBe(409)

    const id = (await created.json()).manager.id
    await app.request(`/api/admin/managers/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ active: false }),
    })
    const hidden = await app.request('/api/managers/DUBAI')
    expect(hidden.status).toBe(404)
  })

  test('public settings expose company contact but never integration secrets', async () => {
    const token = await authToken()
    await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ companyPhone: '+7 800 000-00-00', telegramBotToken: 'secret-token' }),
    })

    const publicRes = await app.request('/api/site')
    const publicBody = await publicRes.json()
    expect(publicBody.settings.companyPhone).toBe('+7 800 000-00-00')
    expect(publicBody.settings).not.toHaveProperty('telegramBotToken')

    const adminRes = await app.request('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
    expect((await adminRes.json()).settings.telegramBotToken).toBe('secret-token')
  })

  test('home content round-trips through admin and public reads', async () => {
    const token = await authToken()
    await app.request('/api/admin/home', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ heroTitle: 'DUNE', chosenSlugs: ['gz-01'] }),
    })
    const publicRes = await app.request('/api/home')
    const body = await publicRes.json()
    expect(body.content.heroTitle).toBe('DUNE')
    expect(body.content.chosenSlugs).toEqual(['gz-01'])
  })

  test('fx context is null on cold start and surcharge-inclusive once cached', async () => {
    const cold = await app.request('/api/fx')
    const coldBody = await cold.json()
    expect(coldBody.fx.usdToRub).toBeNull()
    expect(coldBody.fx.usdToAed).toBeCloseTo(3.6725, 4)

    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', usdRubSurcharge: 2 },
      update: { usdRubSurcharge: 2 },
    })
    await prisma.fxRate.create({
      data: { base: 'USD', quote: 'RUB', value: '90.5', source: 'CBR', fetchedAt: new Date() },
    })

    const warm = await app.request('/api/fx')
    expect((await warm.json()).fx.usdToRub).toBeCloseTo(92.5, 4)
  })

  test('contact resolution follows personal → direction → company', async () => {
    // 1) Personal manager on the object wins.
    const personal = await publishProperty({ managerName: 'Личный', managerPhone: '+7 900 111-11-11' })
    let res = await app.request(`/api/contacts/property/${personal.slug}`)
    expect((await res.json()).contact).toMatchObject({ source: 'personal', name: 'Личный' })

    // 2) No personal → active direction manager.
    const noPersonal = await publishProperty()
    const token = await authToken()
    await app.request('/api/admin/managers', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ direction: 'DUBAI', name: 'Менеджер направления' }),
    })
    res = await app.request(`/api/contacts/property/${noPersonal.slug}`)
    expect((await res.json()).contact).toMatchObject({ source: 'direction', name: 'Менеджер направления' })

    // 3) No personal, no direction manager → company contact from settings.
    const saudi = await publishProperty({ direction: 'SAUDI', city: 'Riyadh' })
    await app.request('/api/admin/settings', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ companyName: 'DUNE', companyPhone: '+7 800 000-00-00' }),
    })
    res = await app.request(`/api/contacts/property/${saudi.slug}`)
    expect((await res.json()).contact).toMatchObject({ source: 'company', name: 'DUNE' })
  })

  test('home content distinguishes clearing tileLinks from omitting it', async () => {
    const token = await authToken()
    await app.request('/api/admin/home', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ tileLinks: { a: 1 } }),
    })
    let body = await (await app.request('/api/home')).json()
    expect(body.content.tileLinks).toEqual({ a: 1 })

    // Omitting tileLinks leaves it untouched.
    await app.request('/api/admin/home', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ heroTitle: 'DUNE' }),
    })
    body = await (await app.request('/api/home')).json()
    expect(body.content.tileLinks).toEqual({ a: 1 })

    // Explicit null clears it.
    await app.request('/api/admin/home', {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ tileLinks: null }),
    })
    body = await (await app.request('/api/home')).json()
    expect(body.content.tileLinks).toBeNull()
  })
})
