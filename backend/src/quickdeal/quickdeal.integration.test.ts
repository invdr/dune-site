import { afterAll, beforeEach, describe, expect, test } from 'bun:test'

import { createPrisma } from '../db'
import { QuickDealImporter } from './service'
import type { QuickDealFeedObject } from './mapper'

const databaseUrl = process.env.TEST_DATABASE_URL
const maybeDescribe = databaseUrl ? describe : describe.skip

maybeDescribe('QuickDeal importer sync', () => {
  const prisma = createPrisma(databaseUrl!)

  const config = { feedUrl: 'https://feed.example/quickDeal', token: 'secret' }
  const importerWith = (objects: QuickDealFeedObject[]) =>
    new QuickDealImporter(prisma, config, async () => objects)

  const dubai: QuickDealFeedObject = {
    feedId: 'QD_RS_100',
    isSendToCompanySite: true,
    countryIsoCode: 'AE',
    objectType: 'Apartment',
    title: 'Marina view',
    standardizedPrice: 450000,
    photos: ['https://cdn/1.jpg'],
    status: 'active',
  }

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
    const before = (await prisma.property.findFirstOrThrow({ where: { externalId: 'QD_RS_100' } }))

    // Editorial site-layer edits an admin would make.
    await prisma.property.update({
      where: { id: before.id },
      data: { slug: 'custom-marina', premium: true, badges: ['У моря'], placeholderTone: 'sand' },
    })

    const result = await importerWith([{ ...dubai, title: 'Marina view — renovated', standardizedPrice: 480000 }]).sync()
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
    const other: QuickDealFeedObject = { ...dubai, feedId: 'QD_RS_200', title: 'Palm villa' }

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
    const result = await importerWith([{ ...dubai, isSendToCompanySite: false, export: undefined }]).sync()
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
