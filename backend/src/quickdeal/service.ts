import type { DbClient } from '../db'
import { fetchFeed, type FeedFetcher } from './feed'
import { isImportable, mapListing, slugFromListing, type MappedListing } from './mapper'

// Minimal client surface for slug lookups — satisfied by both the base client
// and an interactive-transaction client.
type SlugClient = Pick<DbClient, 'property'>

export type QuickDealConfig = {
  feedUrl: string | null
  token: string | null
}

export type SyncResult = {
  status: 'ok' | 'skipped'
  reason?: 'not-configured' | 'feed-unavailable' | 'empty-feed'
  created: number
  updated: number
  archived: number
  error?: string
}

// Mirrors the QuickDeal feed into Property rows. Read-only on the site: only
// feed-owned fields are written; the editable site layer (slug, badges, premium,
// placeholderTone, curated home selections) is never touched on update.
export class QuickDealImporter {
  constructor(
    private readonly db: DbClient,
    private readonly config: QuickDealConfig,
    private readonly fetcher?: FeedFetcher,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.feedUrl)
  }

  private feedUrl(): string {
    const base = this.config.feedUrl!
    if (!this.config.token) return base
    // Append the secret as a query param without clobbering existing ones.
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}token=${encodeURIComponent(this.config.token)}`
  }

  async sync(): Promise<SyncResult> {
    if (!this.config.feedUrl) {
      return { status: 'skipped', reason: 'not-configured', created: 0, updated: 0, archived: 0 }
    }

    let objects
    try {
      objects = await fetchFeed(this.feedUrl(), this.fetcher)
    } catch (error) {
      // Feed unreachable → keep the last known state, archive nothing.
      return {
        status: 'skipped',
        reason: 'feed-unavailable',
        created: 0,
        updated: 0,
        archived: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    // An empty payload (no objects at all) is treated as suspicious — a feed
    // glitch or auth failure shouldn't mass-archive the live catalog, so we keep
    // the last known state. A feed that returns objects but none flagged for the
    // site is legitimate (everything delisted) and proceeds to archiving below.
    if (objects.length === 0) {
      return { status: 'skipped', reason: 'empty-feed', created: 0, updated: 0, archived: 0 }
    }

    const mapped = objects
      .filter(isImportable)
      .map(mapListing)
      .filter((listing): listing is MappedListing => listing != null)

    const now = new Date()
    const seen = mapped.map((listing) => listing.externalId)

    // One transaction for the whole sync: either the catalog reflects this feed
    // snapshot atomically, or it stays at the previous state. Avoids a torn mix
    // of half-synced and stale rows if a write fails mid-run.
    const { created, updated, archived } = await this.db.$transaction(async (tx) => {
      let created = 0
      let updated = 0

      for (const listing of mapped) {
        const existing = await tx.property.findUnique({
          where: { source_externalId: { source: 'QUICKDEAL', externalId: listing.externalId } },
          select: { id: true },
        })

        const feedData = this.feedData(listing, now)

        if (existing) {
          // Update writes feed-owned fields only; slug + site layer stay frozen.
          await tx.property.update({ where: { id: existing.id }, data: feedData })
          updated += 1
        } else {
          await tx.property.create({
            data: {
              ...feedData,
              slug: await this.uniqueSlug(tx, listing),
              publishedAt: listing.status === 'PUBLISHED' ? now : null,
            },
          })
          created += 1
        }
      }

      // Listings that fell out of the feed are archived (page stays for SEO).
      const archivedResult = await tx.property.updateMany({
        where: { source: 'QUICKDEAL', externalId: { notIn: seen }, status: { not: 'ARCHIVED' } },
        data: { status: 'ARCHIVED', syncedAt: now },
      })

      return { created, updated, archived: archivedResult.count }
    })

    return { status: 'ok', created, updated, archived }
  }

  // Feed-owned columns only — deliberately omits slug and every site-layer field.
  private feedData(listing: MappedListing, now: Date) {
    return {
      externalId: listing.externalId,
      source: listing.source,
      externalSource: listing.externalSource,
      direction: listing.direction,
      type: listing.type,
      status: listing.status,
      title: listing.title,
      rooms: listing.rooms,
      area: listing.area,
      floor: listing.floor,
      totalFloors: listing.totalFloors,
      complex: listing.complex,
      city: listing.city,
      district: listing.district,
      price: listing.price,
      currency: listing.currency,
      installment: listing.installment,
      isNewBuilding: listing.isNewBuilding,
      delivery: listing.delivery,
      photos: listing.photos,
      lat: listing.lat,
      lng: listing.lng,
      landUse: listing.landUse,
      utilities: listing.utilities,
      commercialKind: listing.commercialKind,
      managerName: listing.managerName,
      managerPhone: listing.managerPhone,
      managerPhotoUrl: listing.managerPhotoUrl,
      syncedAt: now,
    }
  }

  // Generates a slug once for a new listing. The externalId suffix makes most
  // slugs unique on its own; this loop only disambiguates the rare residual
  // collision (e.g. two ids sharing the same trailing chars).
  private async uniqueSlug(tx: SlugClient, listing: MappedListing): Promise<string> {
    const base = slugFromListing(listing.title, listing.externalId)
    let candidate = base
    for (let n = 2; n < 50; n += 1) {
      const clash = await tx.property.findUnique({ where: { slug: candidate }, select: { id: true } })
      if (!clash) return candidate
      candidate = `${base}-${n}`
    }
    return `${base}-${Date.now().toString(36)}`
  }
}
