import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createApp } from '../app'
import { createPrisma } from '../db'
import type { AppEnv } from '../env'

const databaseUrl = process.env.TEST_DATABASE_URL

const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('property API integration', () => {
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
    const register = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Platform': 'mobile' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'password123' }),
    })
    const body = await register.json()
    return body.accessToken as string
  }

  function authHeaders(token: string) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }

  const baseProperty = {
    direction: 'NEW',
    type: 'APARTMENT',
    title: '2-комн. квартира, 64 м²',
    rooms: 2,
    area: 64,
    floor: 7,
    totalFloors: 16,
    complex: 'ЖК «Грозный Сити»',
    city: 'Грозный',
    district: 'Ленинский р-н',
    price: 7_680_000,
    currency: 'RUB',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    badges: ['Новостройка'],
    features: ['Панорамные окна'],
  }

  beforeEach(async () => {
    await prisma.property.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('admin can create, read, update, and delete a property', async () => {
    const token = await authToken()

    const created = await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ...baseProperty, slug: 'gz-01', status: 'PUBLISHED' }),
    })
    const createdBody = await created.json()
    expect(created.status).toBe(201)
    expect(createdBody.property.slug).toBe('gz-01')
    expect(createdBody.property.publishedAt).not.toBeNull()
    const id = createdBody.property.id as string

    const read = await app.request(`/api/admin/properties/${id}`, { headers: authHeaders(token) })
    expect(read.status).toBe(200)

    const updated = await app.request(`/api/admin/properties/${id}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ price: 8_000_000, premium: false }),
    })
    const updatedBody = await updated.json()
    expect(updated.status).toBe(200)
    expect(updatedBody.property.price).toBe(8_000_000)
    expect(updatedBody.property.premium).toBe(false)

    const removed = await app.request(`/api/admin/properties/${id}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    })
    expect(removed.status).toBe(204)

    const missing = await app.request(`/api/admin/properties/${id}`, { headers: authHeaders(token) })
    expect(missing.status).toBe(404)
  })

  test('duplicate slug is rejected with a conflict', async () => {
    const token = await authToken()
    const payload = JSON.stringify({ ...baseProperty, slug: 'gz-dup' })

    const first = await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: payload,
    })
    expect(first.status).toBe(201)

    const second = await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: payload,
    })
    const secondBody = await second.json()
    expect(second.status).toBe(409)
    expect(secondBody.error.code).toBe('CONFLICT')
  })

  test('public catalog only exposes published listings and applies filters', async () => {
    const token = await authToken()

    await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ...baseProperty, slug: 'pub-1', status: 'PUBLISHED', price: 5_000_000 }),
    })
    await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        ...baseProperty,
        slug: 'pub-2',
        status: 'PUBLISHED',
        direction: 'RESALE',
        premium: false,
        price: 9_000_000,
      }),
    })
    await app.request('/api/admin/properties', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ ...baseProperty, slug: 'draft-1', status: 'DRAFT' }),
    })

    const all = await app.request('/api/properties')
    const allBody = await all.json()
    expect(all.status).toBe(200)
    expect(allBody.total).toBe(2)
    expect(allBody.items.map((p: { slug: string }) => p.slug).sort()).toEqual(['pub-1', 'pub-2'])

    const filtered = await app.request('/api/properties?direction=NEW&premium=true')
    const filteredBody = await filtered.json()
    expect(filteredBody.total).toBe(1)
    expect(filteredBody.items[0].slug).toBe('pub-1')

    const priced = await app.request('/api/properties?minPrice=8000000&sort=price_desc')
    const pricedBody = await priced.json()
    expect(pricedBody.items.map((p: { slug: string }) => p.slug)).toEqual(['pub-2'])

    const draftHidden = await app.request('/api/properties/draft-1')
    expect(draftHidden.status).toBe(404)

    const published = await app.request('/api/properties/pub-1')
    expect(published.status).toBe(200)
  })

  test('catalog hierarchy: country/category filters and city facets', async () => {
    const token = await authToken()
    const make = (over: Record<string, unknown>) =>
      app.request('/api/admin/properties', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ ...baseProperty, status: 'PUBLISHED', ...over }),
      })

    await make({ slug: 'ru-gz', country: 'RU', category: 'RESIDENTIAL', city: 'Грозный' })
    await make({ slug: 'ru-gd', country: 'RU', category: 'RESIDENTIAL', city: 'Гудермес' })
    await make({ slug: 'ru-com', country: 'RU', category: 'COMMERCIAL', type: 'COMMERCIAL', city: 'Грозный' })
    await make({ slug: 'ae-db', country: 'AE', category: 'RESIDENTIAL', city: 'Дубай', currency: 'USD' })

    const ru = await (await app.request('/api/properties?country=RU')).json()
    expect(ru.total).toBe(3)

    const ae = await (await app.request('/api/properties?country=AE')).json()
    expect(ae.items.map((p: { slug: string }) => p.slug)).toEqual(['ae-db'])

    const commercial = await (await app.request('/api/properties?category=COMMERCIAL')).json()
    expect(commercial.items.map((p: { slug: string }) => p.slug)).toEqual(['ru-com'])

    const citiesRes = await app.request('/api/properties/cities')
    expect(citiesRes.status).toBe(200)
    const { cities } = await citiesRes.json()
    const grozny = cities.find((c: { country: string; city: string }) => c.country === 'RU' && c.city === 'Грозный')
    expect(grozny.count).toBe(2)
    expect(cities.some((c: { country: string; city: string }) => c.country === 'AE' && c.city === 'Дубай')).toBe(true)
  })
})
