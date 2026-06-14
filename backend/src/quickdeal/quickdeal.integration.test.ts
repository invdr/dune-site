import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createPrisma } from '../db'
import { QuickDealImporter } from './service'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

// Minimal AE-flat estate-object in the real `format=quickDeal` XML shape. Only
// the fields the importer reads are emitted; everything is overridable.
type ObjectSpec = {
  feedId: string
  title?: string
  standardizedPrice?: number
  status?: string
  sendToSite?: boolean
}

function objectXml(spec: ObjectSpec): string {
  const { feedId, title = 'Marina view', standardizedPrice = 450000, status = 'active', sendToSite = true } = spec
  return `<estate-object>
    <feedId>${feedId}</feedId>
    <realtyType>flat</realtyType>
    <status>${status}</status>
    <address><city>Dubai Marina</city><countryIsoCode>AE</countryIsoCode></address>
    <title>${title}</title>
    <geoLat>25.08</geoLat><geoLon>55.14</geoLon>
    <bargainTerms><price>22000000</price><standardizedPrice>${standardizedPrice}</standardizedPrice></bargainTerms>
    <feedSettings><isSendToCompanySite>${sendToSite}</isSendToCompanySite></feedSettings>
    <images><src><name>https://cdn/${feedId}.jpg</name><default>true</default></src></images>
    <realty><roomsCount>2</roomsCount><totalArea><value>150</value><unit>squareMeter</unit></totalArea></realty>
  </estate-object>`
}

function feedXml(objects: ObjectSpec[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><estate-objects>${objects.map(objectXml).join('')}</estate-objects>`
}

maybeDescribe('QuickDeal importer sync', () => {
  const prisma = createPrisma(databaseUrl!)

  const config = { feedUrl: 'https://feed.example/quickDeal', token: 'secret' }
  const importerWith = (objects: ObjectSpec[]) =>
    new QuickDealImporter(prisma, config, async () => feedXml(objects))

  const dubai: ObjectSpec = { feedId: 'QD_RS_100', title: 'Marina view', standardizedPrice: 450000 }

  beforeEach(async () => {
    await prisma.lead.deleteMany()
    await prisma.property.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('creates feed listings and assigns a frozen slug', async () => {
    const result = await importerWith([dubai]).sync()
    expect(result).toMatchObject({ status: 'ok', created: 1, updated: 0, archived: 0 })

    const row = await prisma.property.findUnique({
      where: { source_externalId: { source: 'QUICKDEAL', externalId: 'QD_RS_100' } },
    })
    expect(row?.direction).toBe('DUBAI')
    expect(row?.currency).toBe('USD')
    expect(row?.price).toBe(450000)
    expect(row?.status).toBe('PUBLISHED')
    expect(row?.slug).toBeTruthy()
  })

  test('re-sync updates feed fields but never the slug or site layer', async () => {
    await importerWith([dubai]).sync()
    const before = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })

    // Editorial site-layer edits an admin would make.
    await prisma.property.update({
      where: { id: before.id },
      data: { slug: 'custom-marina', premium: true, badges: ['У моря'], placeholderTone: 'sand' },
    })

    const result = await importerWith([
      { ...dubai, title: 'Marina view — renovated', standardizedPrice: 480000 },
    ]).sync()
    expect(result).toMatchObject({ status: 'ok', created: 0, updated: 1 })

    const after = await prisma.property.findUniqueOrThrow({ where: { id: before.id } })
    expect(after.title).toBe('Marina view — renovated') // feed-owned: updated
    expect(after.price).toBe(480000)
    expect(after.slug).toBe('custom-marina') // site layer: frozen
    expect(after.premium).toBe(true)
    expect(after.badges).toEqual(['У моря'])
    expect(after.placeholderTone).toBe('sand')
  })

  test('listings that disappear from the feed are archived (page survives)', async () => {
    await importerWith([dubai]).sync()
    const other: ObjectSpec = { feedId: 'QD_RS_200', title: 'Palm villa' }

    const result = await importerWith([other]).sync()
    expect(result.archived).toBe(1)

    const gone = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })
    expect(gone.status).toBe('ARCHIVED')
    const kept = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_200' } })
    expect(kept.status).toBe('PUBLISHED')
  })

  test('sold status maps to SOLD without archiving', async () => {
    await importerWith([dubai]).sync()
    await importerWith([{ ...dubai, status: 'sold' }]).sync()
    const row = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })
    expect(row.status).toBe('SOLD')
  })

  test('an empty payload is treated as a glitch and archives nothing', async () => {
    await importerWith([dubai]).sync()
    const result = await importerWith([]).sync()
    expect(result).toMatchObject({ status: 'skipped', reason: 'empty-feed', archived: 0 })

    const row = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })
    expect(row.status).toBe('PUBLISHED') // not archived
  })

  test('a feed with objects but none flagged for the site archives the catalog', async () => {
    await importerWith([dubai]).sync()
    const result = await importerWith([{ ...dubai, sendToSite: false }]).sync()
    expect(result.status).toBe('ok')
    const row = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })
    expect(row.status).toBe('ARCHIVED')
  })

  test('an unreachable feed keeps the last known state', async () => {
    await importerWith([dubai]).sync()
    const importer = new QuickDealImporter(prisma, config, async () => {
      throw new Error('network down')
    })
    const result = await importer.sync()
    expect(result).toMatchObject({ status: 'skipped', reason: 'feed-unavailable' })

    const row = await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } })
    expect(row.status).toBe('PUBLISHED')
  })
})
