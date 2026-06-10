import { describe, expect, test } from 'bun:test'

import { isImportable, mapDirection, mapListing, mapType, slugFromListing, type QuickDealFeedObject } from './mapper'

describe('QuickDeal direction & type mapping', () => {
  test('RU new build → NEW, RU other → RESALE', () => {
    expect(mapDirection('RU', 'Квартира в новостройке')).toBe('NEW')
    expect(mapDirection('RU', 'Квартира')).toBe('RESALE')
  })

  test('AE → DUBAI, SA → SAUDI', () => {
    expect(mapDirection('AE', 'Apartment')).toBe('DUBAI')
    expect(mapDirection('SA', 'Apartment')).toBe('SAUDI')
  })

  test('types resolve from kind text; studio is not a type', () => {
    expect(mapType('Участок ИЖС')).toBe('LAND')
    expect(mapType('Офисное помещение')).toBe('COMMERCIAL')
    expect(mapType('Таунхаус')).toBe('TOWNHOUSE')
    expect(mapType('Коттедж')).toBe('HOUSE')
    expect(mapType('Квартира-студия')).toBe('APARTMENT')
  })
})

describe('slugFromListing', () => {
  test('transliterates and appends a stable suffix', () => {
    expect(slugFromListing('2-комн. квартира, 64 м²', 'QD_RS_123456')).toBe('2-komn-kvartira-64-m-123456')
  })

  test('falls back when the title has no latinizable content', () => {
    expect(slugFromListing('!!!', 'QD_RS_42')).toBe('obj-qdrs42')
  })
})

describe('isImportable', () => {
  test('honours the company-site flags only', () => {
    expect(isImportable({ isSendToCompanySite: true })).toBe(true)
    expect(isImportable({ export: 'companySite' })).toBe(true)
    expect(isImportable({})).toBe(false)
  })
})

describe('mapListing', () => {
  const dubai: QuickDealFeedObject = {
    feedId: 'QD_RS_900',
    isSendToCompanySite: true,
    countryIsoCode: 'AE',
    objectType: 'Apartment',
    title: 'Marina view 2BR',
    rooms: 2,
    area: 96,
    standardizedPrice: 450000,
    price: 41000000,
    photos: ['https://cdn.quickdeal/1.jpg'],
    assigned: { name: 'Ислам', phone: '+7 900 000-00-00', photo: 'https://cdn/m.jpg' },
    status: 'active',
  }

  test('foreign listing prices in USD from standardizedPrice and mirrors the manager', () => {
    const mapped = mapListing(dubai)!
    expect(mapped.direction).toBe('DUBAI')
    expect(mapped.currency).toBe('USD')
    expect(mapped.price).toBe(450000)
    expect(mapped.managerName).toBe('Ислам')
    expect(mapped.photos).toEqual(['https://cdn.quickdeal/1.jpg'])
    expect(mapped.status).toBe('PUBLISHED')
  })

  test('sold status maps through', () => {
    expect(mapListing({ ...dubai, status: 'sold' })!.status).toBe('SOLD')
  })

  test('missing price stays 0 (rendered as "on request")', () => {
    const mapped = mapListing({ ...dubai, standardizedPrice: undefined, price: undefined })!
    expect(mapped.price).toBe(0)
  })

  test('domestic listing prices in ₽ and degrades gracefully on missing fields', () => {
    const mapped = mapListing({
      feedId: 'QD_RS_5',
      isSendToCompanySite: true,
      countryIsoCode: 'RU',
      objectType: 'Квартира в новостройке',
      title: 'ЖК Грозный Сити',
      price: 7680000,
    })!
    expect(mapped.direction).toBe('NEW')
    expect(mapped.currency).toBe('RUB')
    expect(mapped.isNewBuilding).toBe(true)
    expect(mapped.lat).toBeNull()
    expect(mapped.city).toBe('—')
  })

  test('skips objects without id, title, or resolvable direction', () => {
    expect(mapListing({ isSendToCompanySite: true, title: 'x' })).toBeNull()
    expect(mapListing({ feedId: 'QD_1', countryIsoCode: 'RU' })).toBeNull()
    expect(mapListing({ feedId: 'QD_1', title: 'x', countryIsoCode: 'XX' })).toBeNull()
  })
})
