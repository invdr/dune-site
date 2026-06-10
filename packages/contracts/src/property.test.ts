import { describe, expect, test } from 'bun:test'

import {
  adminPropertyListQuerySchema,
  createPropertySchema,
  propertyListQuerySchema,
  propertySlugSchema,
  propertyTypeSchema,
  updatePropertySchema,
} from './property'

const baseCreateInput = {
  slug: 'gz-01',
  direction: 'NEW',
  type: 'APARTMENT',
  title: '2-комн. квартира, 64 м²',
  area: 64,
  city: 'Грозный',
  price: 7_680_000,
} as const

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

  test('property type is the finalized set (rejects removed STUDIO/VILLA)', () => {
    expect(propertyTypeSchema.safeParse('TOWNHOUSE').success).toBe(true)
    expect(propertyTypeSchema.safeParse('COMMERCIAL').success).toBe(true)
    expect(propertyTypeSchema.safeParse('LAND').success).toBe(true)
    expect(propertyTypeSchema.safeParse('STUDIO').success).toBe(false)
    expect(propertyTypeSchema.safeParse('VILLA').success).toBe(false)
  })

  test('a studio is an APARTMENT with rooms = 0', () => {
    const result = createPropertySchema.parse({ ...baseCreateInput, type: 'APARTMENT', rooms: 0 })
    expect(result.type).toBe('APARTMENT')
    expect(result.rooms).toBe(0)
  })

  test('defaults source to SITE and utilities to empty', () => {
    const result = createPropertySchema.parse(baseCreateInput)
    expect(result.source).toBe('SITE')
    expect(result.utilities).toEqual([])
    expect(result.lat).toBeNull()
    expect(result.lng).toBeNull()
    expect(result.landUse).toBeNull()
    expect(result.commercialKind).toBeNull()
  })

  test('accepts category attributes and rejects unknown utility values', () => {
    const land = createPropertySchema.parse({
      ...baseCreateInput,
      type: 'LAND',
      landUse: 'IZHS',
      utilities: ['ELECTRICITY', 'GAS', 'WATER'],
    })
    expect(land.landUse).toBe('IZHS')
    expect(land.utilities).toEqual(['ELECTRICITY', 'GAS', 'WATER'])

    expect(
      createPropertySchema.safeParse({ ...baseCreateInput, utilities: ['INTERNET'] }).success,
    ).toBe(false)
  })

  test('admin query accepts category and source filters', () => {
    const result = adminPropertyListQuerySchema.parse({
      type: 'COMMERCIAL',
      commercialKind: 'OFFICE',
      landUse: 'IZHS',
      source: 'QUICKDEAL',
    })
    expect(result.commercialKind).toBe('OFFICE')
    expect(result.landUse).toBe('IZHS')
    expect(result.source).toBe('QUICKDEAL')
  })
})
