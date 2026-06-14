import type {
  AdminComplexListQuery,
  ComplexListQuery,
  CreateComplexPayload,
  UpdateComplexPayload,
} from '@dune/contracts'

import type { CurrencyService } from '../currency/service'
import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { Prisma, type Complex } from '../generated/prisma/client'
import { toPropertyDto } from '../properties/serializer'
import { toComplexDto, type ComplexAggregate } from './serializer'

type ListOptions = {
  // When true, only PUBLISHED complexes are visible (public site).
  publicOnly: boolean
}

// Lightweight unit projection used to compute "от X ₽/м²" / "от Y м²".
type UnitFacts = { price: number; area: number }

export class ComplexService {
  constructor(
    private readonly db: DbClient,
    private readonly currency: CurrencyService,
  ) {}

  async list(query: ComplexListQuery | AdminComplexListQuery, options: ListOptions) {
    const where = this.buildWhere(query, options)
    const skip = (query.page - 1) * query.limit

    const [items, total] = await this.db.$transaction([
      this.db.complex.findMany({ where, orderBy: this.buildOrderBy(query.sort), skip, take: query.limit }),
      this.db.complex.count({ where }),
    ])

    // One query for every linked published unit across the whole page, grouped
    // in memory — price-per-m² is min(price/area), not a SQL aggregate.
    const unitsByName = await this.unitFactsByName(items.map((c) => c.name))

    return {
      items: items.map((c) => toComplexDto(c, this.aggregate(c, unitsByName.get(normalizeComplexKey(c.name)) ?? []))),
      total,
      page: query.page,
      limit: query.limit,
      pageCount: Math.max(1, Math.ceil(total / query.limit)),
    }
  }

  async getBySlug(slug: string, options: ListOptions) {
    const complex = await this.db.complex.findUnique({ where: { slug } })
    if (!complex || (options.publicOnly && complex.status !== 'PUBLISHED')) {
      throw new AppError(404, 'NOT_FOUND', 'Complex not found')
    }

    // Full published units for this complex, cheapest first. Matching is done on
    // a normalized key (see unitFactsByName) so it is identical to the catalog
    // card and tolerant of the free-text casing/whitespace in feed names.
    const key = normalizeComplexKey(complex.name)
    const allRows = await this.db.property.findMany({
      where: { status: 'PUBLISHED', complex: { not: null } },
      orderBy: [{ price: 'asc' }, { id: 'desc' }],
    })
    const unitRows = allRows.filter((p) => p.complex && normalizeComplexKey(p.complex) === key)

    const context = await this.currency.getPricingContext()
    const units = unitRows.map((p) =>
      toPropertyDto(p, this.currency.price(p.price, p.currency, p.direction, context)),
    )
    const aggregate = this.aggregate(
      complex,
      unitRows.map((u) => ({ price: u.price, area: u.area })),
    )

    return { ...toComplexDto(complex, aggregate), units }
  }

  async getById(id: string) {
    const complex = await this.db.complex.findUnique({ where: { id } })
    if (!complex) throw new AppError(404, 'NOT_FOUND', 'Complex not found')
    const units = await this.unitFactsByName([complex.name])
    return toComplexDto(complex, this.aggregate(complex, units.get(normalizeComplexKey(complex.name)) ?? []))
  }

  async create(payload: CreateComplexPayload) {
    const complex = await this.db.complex
      .create({ data: { ...payload, publishedAt: payload.status === 'PUBLISHED' ? new Date() : null } })
      .catch((error: unknown) => {
        throw this.translateWriteError(error)
      })
    return toComplexDto(complex, emptyAggregate(complex))
  }

  async update(id: string, payload: UpdateComplexPayload) {
    const existing = await this.db.complex.findUnique({ where: { id }, select: { status: true, publishedAt: true } })
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'Complex not found')

    const complex = await this.db.complex
      .update({ where: { id }, data: { ...payload, publishedAt: resolvePublishedAt(existing, payload) } })
      .catch((error: unknown) => {
        throw this.translateWriteError(error)
      })
    const units = await this.unitFactsByName([complex.name])
    return toComplexDto(complex, this.aggregate(complex, units.get(normalizeComplexKey(complex.name)) ?? []))
  }

  async delete(id: string) {
    await this.db.complex.delete({ where: { id } }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError(404, 'NOT_FOUND', 'Complex not found')
      }
      throw error
    })
  }

  // Bulk bootstrap: turn the distinct `complex` names found on new-build property
  // rows into DRAFT ЖК stubs, skipping any name that already has a complex. Lets
  // an admin populate the section from the feed, then enrich each entry by hand.
  async bulkCreateFromProperties() {
    const groups = await this.db.property.groupBy({
      by: ['complex', 'city', 'country'],
      where: { direction: 'NEW', complex: { not: null } },
      _count: { _all: true },
    })

    // Collapse to one row per complex name (first city/country wins).
    const byName = new Map<string, { city: string; country: Complex['country'] }>()
    for (const g of groups) {
      const name = (g.complex ?? '').trim()
      if (name && !byName.has(name)) byName.set(name, { city: g.city, country: g.country })
    }

    const existing = await this.db.complex.findMany({ select: { name: true } })
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))

    const created: Complex[] = []
    let skipped = 0
    for (const [name, info] of byName) {
      if (existingNames.has(name.toLowerCase())) {
        skipped += 1
        continue
      }
      const complex = await this.db.complex
        .create({
          data: { slug: await this.uniqueSlug(name), name, city: info.city, country: info.country, status: 'DRAFT' },
        })
        .catch(() => null)
      if (complex) created.push(complex)
      else skipped += 1
    }

    return {
      created: created.length,
      skipped,
      items: created.map((c) => toComplexDto(c, emptyAggregate(c))),
    }
  }

  // ---- helpers -------------------------------------------------------------

  // Buckets published units by a normalized complex name (trimmed,
  // whitespace-collapsed, lower-cased) so the join is case- and
  // whitespace-insensitive — Postgres can't normalize-match a free-text column,
  // so we filter in memory. Fine at the current catalog scale; a normalized
  // stored column + index would be the move if the feed grows large.
  private async unitFactsByName(names: string[]): Promise<Map<string, UnitFacts[]>> {
    const wanted = new Set(names.map(normalizeComplexKey).filter((k) => k))
    const map = new Map<string, UnitFacts[]>()
    if (wanted.size === 0) return map

    const rows = await this.db.property.findMany({
      where: { status: 'PUBLISHED', complex: { not: null } },
      select: { complex: true, price: true, area: true },
    })
    for (const r of rows) {
      if (!r.complex) continue
      const key = normalizeComplexKey(r.complex)
      if (!wanted.has(key)) continue
      const list = map.get(key) ?? []
      list.push({ price: r.price, area: r.area })
      map.set(key, list)
    }
    return map
  }

  private aggregate(complex: Complex, units: UnitFacts[]): ComplexAggregate {
    if (units.length === 0) return emptyAggregate(complex)

    const priceFrom = Math.min(...units.map((u) => u.price))
    const areaFrom = Math.min(...units.map((u) => u.area))
    const perMeter = units.filter((u) => u.area > 0).map((u) => Math.round(u.price / u.area))
    return {
      priceFrom,
      areaFrom,
      pricePerMeterFrom: perMeter.length ? Math.min(...perMeter) : null,
      unitCount: units.length,
    }
  }

  private buildWhere(
    query: ComplexListQuery | AdminComplexListQuery,
    options: ListOptions,
  ): Prisma.ComplexWhereInput {
    const where: Prisma.ComplexWhereInput = {}

    if (options.publicOnly) where.status = 'PUBLISHED'
    else if ('status' in query && query.status) where.status = query.status

    if (query.direction) where.direction = query.direction
    if (query.country) where.country = query.country
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' }
    if (query.premium !== undefined) where.premium = query.premium
    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { district: { contains: query.q, mode: 'insensitive' } },
        { developer: { contains: query.q, mode: 'insensitive' } },
      ]
    }
    return where
  }

  private buildOrderBy(sort: ComplexListQuery['sort']): Prisma.ComplexOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ priceFrom: 'asc' }, { id: 'desc' }]
      case 'price_desc':
        return [{ priceFrom: 'desc' }, { id: 'desc' }]
      case 'name_asc':
        return [{ name: 'asc' }, { id: 'desc' }]
      case 'newest':
      default:
        // Featured first, then newest — mirrors the prototype's catalog ordering.
        return [{ premium: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      slugify(name) || `zhk-${Math.random().toString(36).slice(2, 8)}`
    let candidate = base
    for (let n = 2; n < 60; n += 1) {
      const clash = await this.db.complex.findUnique({ where: { slug: candidate }, select: { id: true } })
      if (!clash) return candidate
      candidate = `${base}-${n}`
    }
    return `${base}-${Date.now().toString(36)}`
  }

  private translateWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppError(409, 'CONFLICT', 'A complex with this slug already exists')
    }
    return error
  }
}

// Normalized join key for matching a complex name to a unit's free-text
// `complex` field: trimmed, whitespace-collapsed, lower-cased.
function normalizeComplexKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

// Fallbacks for a complex with no linked units. The stored `priceFrom` column
// holds the manual price-per-m² headline (the admin field is labelled "₽/м²"),
// so it maps to `pricePerMeterFrom`. The DTO's `priceFrom` (a *total*) stays
// null here — there are no units to derive a total from — so the field never
// changes meaning between the manual and computed cases.
function emptyAggregate(complex: Complex): ComplexAggregate {
  return {
    priceFrom: null,
    areaFrom: complex.areaFrom,
    pricePerMeterFrom: complex.priceFrom,
    unitCount: 0,
  }
}

function resolvePublishedAt(
  existing: { status: string; publishedAt: Date | null },
  payload: UpdateComplexPayload,
): Date | null | undefined {
  if (payload.status === undefined) return undefined
  if (payload.status === 'PUBLISHED' && existing.publishedAt === null) return new Date()
  return existing.publishedAt
}

// Transliterate Cyrillic + lowercase to an ASCII slug; mirrors the storefront's
// expectations (lowercase alphanumeric segments joined by single hyphens).
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
