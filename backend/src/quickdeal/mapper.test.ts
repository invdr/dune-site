import { describe, expect, test } from 'bun:test'

import { fetchFeed } from './feed'
import { SAMPLE_FEED_XML } from './feed.fixture'
import { isImportable, mapDirection, mapListing, mapType, slugFromListing, type MappedListing } from './mapper'
import { parseXml } from './xml'

const objectsFromXml = (xml: string) => fetchFeed('https://feed.example', async () => xml)

async function mapSample(): Promise<Record<string, MappedListing>> {
  const objects = await objectsFromXml(SAMPLE_FEED_XML)
  const mapped = objects.filter(isImportable).map(mapListing).filter((l): l is MappedListing => l != null)
  return Object.fromEntries(mapped.map((listing) => [listing.externalId, listing]))
}

describe('QuickDeal direction & type mapping', () => {
  test('RU resale vs new build keys off realtyType / projectStatus', () => {
    expect(mapDirection('RU', 'flat', 'readySecondary')).toBe('RESALE')
    expect(mapDirection('RU', 'flat', 'building')).toBe('NEW')
    expect(mapDirection('RU', 'newBuildingFlat', undefined)).toBe('NEW')
    expect(mapDirection('RU', 'land', undefined)).toBe('RESALE')
  })

  test('country ISO drives foreign directions', () => {
    expect(mapDirection('AE', 'flat', undefined)).toBe('DUBAI')
    expect(mapDirection('SA', 'flat', undefined)).toBe('SAUDI')
    expect(mapDirection('FR', 'flat', undefined)).toBeNull()
  })

  test('types resolve from realtyType', () => {
    expect(mapType('land')).toBe('LAND')
    expect(mapType('flat')).toBe('APARTMENT')
    expect(mapType('house')).toBe('HOUSE')
    expect(mapType('townhouse')).toBe('TOWNHOUSE')
    expect(mapType('office')).toBe('COMMERCIAL')
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
  test('requires the company-site flag and a non-hidden object', () => {
    const yes = parseXml('<estate-object><feedSettings><isSendToCompanySite>true</isSendToCompanySite></feedSettings></estate-object>')
      .children[0]!
    const hidden = parseXml('<estate-object><isHidden>true</isHidden><feedSettings><isSendToCompanySite>true</isSendToCompanySite></feedSettings></estate-object>')
      .children[0]!
    const off = parseXml('<estate-object><feedSettings><isSendToCompanySite>false</isSendToCompanySite></feedSettings></estate-object>')
      .children[0]!
    expect(isImportable(yes)).toBe(true)
    expect(isImportable(hidden)).toBe(false)
    expect(isImportable(off)).toBe(false)
  })
})

describe('mapListing against the real QuickDeal XML shape', () => {
  test('parses all three estate-objects from the feed document', async () => {
    const objects = await objectsFromXml(SAMPLE_FEED_XML)
    expect(objects).toHaveLength(3)
  })

  test('RU land: RESALE/LAND, sotka area converted to m², ИЖС land use, water utility', async () => {
    const land = (await mapSample())['QD_RS_1000001']!
    expect(land.direction).toBe('RESALE')
    expect(land.type).toBe('LAND')
    expect(land.status).toBe('PUBLISHED')
    expect(land.currency).toBe('RUB')
    expect(land.price).toBe(1500000)
    expect(land.area).toBe(800) // 8 sotka × 100
    expect(land.landUse).toBe('IZHS')
    expect(land.utilities).toEqual(['WATER'])
    expect(land.title).toBe('Земельный участок, 800 м²') // no <title> → fallback
    expect(land.city).toBe('Тестовка') // settlement, no city
    expect(land.district).toBe('Тестовский')
    expect(land.lat).toBeCloseTo(43.135, 3)
    expect(land.managerName).toBe('Иван Тестов')
    expect(land.managerPhone).toBe('+70000000001')
    expect(land.photos).toEqual(['https://cdn.example/land/1.jpeg'])
  })

  test('AE flat: DUBAI/APARTMENT, USD standardized price, installments, complex, delivery', async () => {
    const flat = (await mapSample())['QD_RS_1000002']!
    expect(flat.direction).toBe('DUBAI')
    expect(flat.type).toBe('APARTMENT')
    expect(flat.currency).toBe('USD')
    expect(flat.price).toBe(304932) // standardizedPrice, not the ₽ price
    expect(flat.rooms).toBe(2)
    expect(flat.area).toBe(155)
    expect(flat.floor).toBe(3)
    expect(flat.totalFloors).toBe(30)
    expect(flat.complex).toBe('W Residences Dubai Downtown')
    expect(flat.installment).toBe(true)
    expect(flat.delivery).toBe('2025')
    expect(flat.isNewBuilding).toBe(false) // readySecondary
    expect(flat.title).toBe('Квартира в Дубай Марина 150 кв')
    expect(flat.city).toBe('Дубай Марина')
  })

  test('RU house: RESALE/HOUSE, totalArea in m² (not the plot), fallback title', async () => {
    const house = (await mapSample())['QD_RS_1000003']!
    expect(house.direction).toBe('RESALE')
    expect(house.type).toBe('HOUSE')
    expect(house.area).toBe(135) // totalArea, not the 6-sotka plot
    expect(house.rooms).toBe(5)
    expect(house.totalFloors).toBe(1)
    expect(house.title).toBe('Дом, 135 м²')
    expect(house.city).toBe('Гудермес')
    expect(house.district).toBe('Гудермесский')
    expect(house.photos[0]).toBe('https://cdn.example/house/2.jpeg') // default photo first
    expect(house.managerName).toBe('Пётр Домов')
  })
})
