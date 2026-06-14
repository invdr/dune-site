import { createComplexSchema, type CreateComplexRequest } from '@dune/contracts'

import type { DbClient } from '../db'
import { parseListing, parseSitemap, type ParsedComplex } from './parse'

// One-time migration of sellox.ru's public ЖК pages into Complex rows.
//
// sellox has no feed, so we crawl property-sitemap.xml and scrape each page.
// Imported complexes land as DRAFT and existing slugs are skipped, so the job
// is idempotent and never overwrites work an admin has already reviewed.

export const SELLOX_SITEMAP_URL = 'https://sellox.ru/property-sitemap.xml'

// Injectable so tests run offline; the CLI supplies a real, throttled fetcher.
export type SelloxFetcher = (url: string) => Promise<string>

export type ImportOptions = {
  fetcher: SelloxFetcher
  dryRun?: boolean
  limit?: number
  // When true, refresh existing DRAFT complexes instead of skipping them. Never
  // touches a complex that has been published/edited past DRAFT.
  update?: boolean
  log?: (message: string) => void
}

export type ImportItem = {
  url: string
  slug: string
  name: string
  action: 'created' | 'updated' | 'skipped' | 'failed'
  reason?: string
}

export type ImportSummary = {
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  items: ImportItem[]
}

export async function importSellox(db: DbClient, options: ImportOptions): Promise<ImportSummary> {
  const log = options.log ?? (() => {})
  const summary: ImportSummary = { total: 0, created: 0, updated: 0, skipped: 0, failed: 0, items: [] }

  const sitemap = await options.fetcher(SELLOX_SITEMAP_URL)
  let urls = parseSitemap(sitemap)
  if (options.limit && options.limit > 0) urls = urls.slice(0, options.limit)
  summary.total = urls.length
  log(`Found ${urls.length} sellox property page(s).`)

  for (const url of urls) {
    const item = await importOne(db, url, options)
    summary.items.push(item)
    summary[item.action] += 1
    log(`  [${item.action}] ${item.slug}${item.reason ? ` — ${item.reason}` : ''}`)
  }

  return summary
}

async function importOne(db: DbClient, url: string, options: ImportOptions): Promise<ImportItem> {
  let parsed: ParsedComplex
  try {
    const html = await options.fetcher(url)
    parsed = parseListing(html, url)
  } catch (error) {
    return { url, slug: slugFromUrl(url), name: '', action: 'failed', reason: message(error) }
  }

  let payload
  try {
    payload = createComplexSchema.parse(toCreateRequest(parsed))
  } catch (error) {
    return { url, slug: parsed.slug, name: parsed.name, action: 'failed', reason: message(error) }
  }

  const base = { url, slug: payload.slug, name: payload.name }

  const existing = await db.complex.findUnique({
    where: { slug: payload.slug },
    select: { id: true, status: true },
  })

  if (existing) {
    // Only refresh untouched DRAFT rows, and only when asked — published or
    // hand-edited complexes are the admin's, not the importer's.
    if (!options.update || existing.status !== 'DRAFT') {
      return { ...base, action: 'skipped', reason: existing.status === 'DRAFT' ? 'exists (DRAFT)' : `exists (${existing.status})` }
    }
    if (!options.dryRun) {
      const { slug: _slug, status: _status, ...refreshable } = payload
      await db.complex.update({ where: { id: existing.id }, data: refreshable })
    }
    return { ...base, action: 'updated' }
  }

  if (!options.dryRun) {
    await db.complex.create({ data: { ...payload, publishedAt: null } })
  }
  return { ...base, action: 'created' }
}

// Maps the scraped shape onto the contract request. Imports are always DRAFT so
// nothing reaches the public site until an admin reviews it.
function toCreateRequest(parsed: ParsedComplex): CreateComplexRequest {
  return {
    slug: parsed.slug,
    name: parsed.name,
    status: 'DRAFT',
    direction: parsed.direction,
    country: parsed.country,
    city: parsed.city,
    currency: parsed.currency,
    description: parsed.description,
    delivery: parsed.delivery,
    photos: parsed.photos,
    features: parsed.features,
    badges: parsed.badges,
    priceFrom: parsed.priceFrom,
    areaFrom: parsed.areaFrom,
  }
}

function slugFromUrl(url: string): string {
  const path = url.replace(/[?#].*$/, '').replace(/\/+$/, '')
  return path.slice(path.lastIndexOf('/') + 1).toLowerCase()
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
