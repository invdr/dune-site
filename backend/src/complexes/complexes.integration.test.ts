import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('complex API integration', () => {
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

  async function createComplex(token: string, overrides: Record<string, unknown> = {}) {
    const res = await app.request('/api/admin/complexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slug: 'zhk-an-nur', name: 'ЖК Ан Нур', city: 'Грозный', status: 'PUBLISHED', ...overrides }),
    })
    return res
  }

  beforeEach(async () => {
    await prisma.property.deleteMany()
    await prisma.complex.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('creating requires authentication', async () => {
    const res = await app.request('/api/admin/complexes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'zhk-x', name: 'ЖК X', city: 'Грозный' }),
    })
    expect(res.status).toBe(401)
  })

  test('public list shows only published complexes', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-pub', name: 'ЖК Pub', status: 'PUBLISHED' })
    await createComplex(token, { slug: 'zhk-draft', name: 'ЖК Draft', status: 'DRAFT' })

    const list = await app.request('/api/complexes')
    expect(list.status).toBe(200)
    const body = await list.json()
    expect(body.total).toBe(1)
    expect(body.items[0].slug).toBe('zhk-pub')
  })

  test('publishing stamps publishedAt and rejects duplicate slugs', async () => {
    const token = await authToken()
    const created = await createComplex(token)
    expect(created.status).toBe(201)
    expect((await created.json()).complex.publishedAt).toBeTruthy()

    const dup = await createComplex(token, { name: 'Другой' })
    expect(dup.status).toBe(409)
  })

  test('detail joins published new-build units and computes "от X ₽/м²"', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-an-nur', name: 'ЖК Ан Нур' })

    // Two published apartments in the complex: 90 000 ₽/м² and 100 000 ₽/м².
    await prisma.property.create({
      data: {
        slug: 'an-nur-1', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED',
        title: 'Студия', area: 40, price: 3_600_000, city: 'Грозный', complex: 'ЖК Ан Нур',
      },
    })
    await prisma.property.create({
      data: {
        slug: 'an-nur-2', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED',
        title: '2к', area: 50, price: 5_000_000, city: 'Грозный', complex: 'ЖК Ан Нур',
      },
    })
    // A draft unit must be excluded from the public aggregate.
    await prisma.property.create({
      data: {
        slug: 'an-nur-draft', direction: 'NEW', type: 'APARTMENT', status: 'DRAFT',
        title: 'Скрытая', area: 10, price: 100_000, city: 'Грозный', complex: 'ЖК Ан Нур',
      },
    })

    const res = await app.request('/api/complexes/zhk-an-nur')
    expect(res.status).toBe(200)
    const { complex } = await res.json()
    expect(complex.unitCount).toBe(2)
    expect(complex.units).toHaveLength(2)
    expect(complex.pricePerMeterFrom).toBe(90_000) // min(3.6M/40, 5M/50)
    expect(complex.areaFrom).toBe(40)
    // Cheapest unit first.
    expect(complex.units[0].slug).toBe('an-nur-1')
  })

  test('catalog card aggregate matches units case/whitespace-insensitively', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-an-nur', name: 'ЖК Ан Нур' })
    // Feed unit carries a different case and a trailing space — the bulk
    // importer copies free-text QuickDeal names, so this is the common case.
    await prisma.property.create({
      data: {
        slug: 'an-nur-1', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED',
        title: 'Студия', area: 40, price: 3_600_000, city: 'Грозный', complex: 'ЖК ан нур ',
      },
    })

    const list = await app.request('/api/complexes')
    const body = await list.json()
    const card = body.items.find((c: { slug: string }) => c.slug === 'zhk-an-nur')
    // The card aggregate must agree with the detail page, not show 0 / "по запросу".
    expect(card.unitCount).toBe(1)
    expect(card.pricePerMeterFrom).toBe(90_000)

    const detail = await (await app.request('/api/complexes/zhk-an-nur')).json()
    expect(detail.complex.unitCount).toBe(1)
    expect(detail.complex.pricePerMeterFrom).toBe(90_000)
  })

  test('manual complex without units shows a per-m² headline but no bogus total', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-manual', name: 'ЖК Ручной', priceFrom: 120_000, areaFrom: 38 })

    const detail = await (await app.request('/api/complexes/zhk-manual')).json()
    expect(detail.complex.unitCount).toBe(0)
    expect(detail.complex.pricePerMeterFrom).toBe(120_000) // manual ₽/м² headline
    expect(detail.complex.areaFrom).toBe(38)
    expect(detail.complex.priceFrom).toBeNull() // no units → no derived total
  })

  test('bulk creates draft stubs from new-build complex names, skipping existing', async () => {
    const token = await authToken()
    await prisma.property.createMany({
      data: [
        { slug: 'p1', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED', title: 'A', area: 40, price: 4_000_000, city: 'Грозный', complex: 'ЖК Fajr' },
        { slug: 'p2', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED', title: 'B', area: 50, price: 5_000_000, city: 'Грозный', complex: 'ЖК Fajr' },
        { slug: 'p3', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED', title: 'C', area: 60, price: 6_000_000, city: 'Грозный', complex: 'ЖК Rebel Town' },
      ],
    })
    // One complex already exists → should be skipped, not duplicated.
    await createComplex(token, { slug: 'zhk-fajr', name: 'ЖК Fajr' })

    const res = await app.request('/api/admin/complexes/bulk', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.created).toBe(1) // only "ЖК Rebel Town"
    expect(body.skipped).toBe(1) // "ЖК Fajr" already present
    expect(body.items[0].name).toBe('ЖК Rebel Town')

    const total = await prisma.complex.count()
    expect(total).toBe(2)
  })

  test('facets expose distinct published cities, features, deliveries and developers', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-a', name: 'ЖК A', city: 'Грозный', delivery: '2026', developer: 'СК Альфа', features: ['Бассейн', 'Паркинг'] })
    await createComplex(token, { slug: 'zhk-b', name: 'ЖК B', city: 'Гудермес', delivery: '2026', features: ['Паркинг'] })
    // A DRAFT complex must not leak its values into the public facets.
    await createComplex(token, { slug: 'zhk-d', name: 'ЖК D', city: 'Аргун', status: 'DRAFT', features: ['Охрана'] })

    const res = await app.request('/api/complexes/facets')
    expect(res.status).toBe(200)
    const facets = (await res.json()) as Record<'cities' | 'features' | 'deliveries' | 'developers', { value: string; count: number }[]>

    expect(facets.cities.map((c) => c.value).sort()).toEqual(['Грозный', 'Гудермес'])
    expect(facets.features.find((f) => f.value === 'Паркинг')?.count).toBe(2)
    expect(facets.features.find((f) => f.value === 'Охрана')).toBeUndefined() // DRAFT excluded
    expect(facets.deliveries.find((d) => d.value === '2026')?.count).toBe(2)
    expect(facets.developers.map((d) => d.value)).toEqual(['СК Альфа'])
  })

  test('list filters by features (all), delivery (any), ₽/м² range and developer', async () => {
    const token = await authToken()
    await createComplex(token, { slug: 'zhk-pool', name: 'ЖК Pool', delivery: '2026', priceFrom: 80_000, developer: 'СК Альфа', features: ['Бассейн', 'Паркинг'] })
    await createComplex(token, { slug: 'zhk-park', name: 'ЖК Park', delivery: '2027', priceFrom: 120_000, developer: 'СК Бета', features: ['Паркинг'] })
    // Unit-linked complex with NO stored priceFrom: its displayed ₽/м² is the
    // min over units (4.5M / 50 = 90 000), which is what the price filter must use.
    await createComplex(token, { slug: 'zhk-units', name: 'ЖК Units' })
    await prisma.property.create({
      data: {
        slug: 'units-1', direction: 'NEW', type: 'APARTMENT', status: 'PUBLISHED',
        title: 'Студия', area: 50, price: 4_500_000, city: 'Грозный', complex: 'ЖК Units',
      },
    })

    const slugs = async (qs: string) =>
      ((await (await app.request(`/api/complexes${qs}`)).json()).items as { slug: string }[]).map((c) => c.slug).sort()

    // hasEvery: only the complex carrying BOTH features.
    expect(await slugs(`?features=${encodeURIComponent('Бассейн,Паркинг')}`)).toEqual(['zhk-pool'])
    // delivery IN [2027].
    expect(await slugs('?delivery=2027')).toEqual(['zhk-park'])
    // ₽/м² ≤ 100 000 keeps the 80k stored and the 90k unit-derived, drops 120k.
    expect(await slugs('?priceMax=100000')).toEqual(['zhk-pool', 'zhk-units'])
    // ≥ 110 000 keeps only the 120k; the 90k unit-linked complex is excluded on
    // its *computed* value, proving the filter doesn't read the (null) column.
    expect(await slugs('?priceMin=110000')).toEqual(['zhk-park'])
    // developer exact.
    expect(await slugs(`?developer=${encodeURIComponent('СК Бета')}`)).toEqual(['zhk-park'])
  })
})
