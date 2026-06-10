import { describe, expect, test } from 'bun:test'

import {
  adminPropertyListQuerySchema,
  createPropertySchema,
  propertyListQuerySchema,
  propertySlugSchema,
  updatePropertySchema,
} from './property'

describe('property contracts', () => {
  test('applies defaults and normalizes optional text on create', () => {
    const result = createPropertySchema.parse({
      slug: 'gz-01',
      direction: 'NEW',
      type: 'APARTMENT',
      title: '2-комн. квартира, 64 м²',
      area: 64,
      city: 'Грозный',
      price: 7_680_000,
      complex: '   ',
      district: '',
    })

    expect(result.status).toBe('DRAFT')
    expect(result.currency).toBe('RUB')
    expect(result.rooms).toBe(0)
    expect(result.premium).toBe(false)
    expect(result.photos).toEqual([])
    expect(result.badges).toEqual([])
    // Blank/whitespace optional text collapses to null, not empty string.
    expect(result.complex).toBeNull()
    expect(result.district).toBeNull()
    expect(result.floor).toBeNull()
  })

  test('rejects invalid slugs', () => {
    expect(propertySlugSchema.safeParse('GZ_01').success).toBe(false)
    expect(propertySlugSchema.safeParse('gz 01').success).toBe(false)
    expect(propertySlugSchema.safeParse('gz-01').success).toBe(true)
  })

  test('rejects empty update payloads', () => {
    expect(updatePropertySchema.safeParse({}).success).toBe(false)
    expect(updatePropertySchema.safeParse({ premium: true }).success).toBe(true)
  })

  test('coerces query-string filters from strings', () => {
    const result = propertyListQuerySchema.parse({
      direction: 'DUBAI',
      premium: 'true',
      installment: 'false',
      minPrice: '200000',
      maxPrice: '900000',
      rooms: '2',
      page: '2',
      limit: '12',
    })

    expect(result.premium).toBe(true)
    expect(result.installment).toBe(false)
    expect(result.minPrice).toBe(200_000)
    expect(result.maxPrice).toBe(900_000)
    expect(result.rooms).toBe(2)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(12)
    expect(result.sort).toBe('newest')
  })

  test('public query has no status filter; admin query accepts it', () => {
    expect('status' in propertyListQuerySchema.parse({})).toBe(false)
    expect(adminPropertyListQuerySchema.parse({ status: 'DRAFT' }).status).toBe('DRAFT')
  })

  test('caps limit and rejects unknown sort', () => {
    expect(propertyListQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
    expect(propertyListQuerySchema.safeParse({ sort: 'cheapest' }).success).toBe(false)
  })
})
