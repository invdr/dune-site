import type {
  AdminPropertyListQuery,
  CreatePropertyPayload,
  PropertyListQuery,
  UpdatePropertyPayload,
} from '@dune/contracts'

import type { CurrencyService } from '../currency/service'
import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { Prisma, type Property } from '../generated/prisma/client'
import { toPropertyDto } from './serializer'

type ListOptions = {
  // When true, only PUBLISHED listings are visible (public site).
  publicOnly: boolean
}

export class PropertyService {
  constructor(
    private readonly db: DbClient,
    private readonly currency: CurrencyService,
  ) {}

  async list(query: PropertyListQuery | AdminPropertyListQuery, options: ListOptions) {
    const where = this.buildWhere(query, options)
    const skip = (query.page - 1) * query.limit

    const [items, total] = await this.db.$transaction([
      this.db.property.findMany({
        where,
        orderBy: this.buildOrderBy(query.sort),
        skip,
        take: query.limit,
      }),
      this.db.property.count({ where }),
    ])

    // One FX read for the whole page, reused across every listing.
    const context = await this.currency.getPricingContext()

    return {
      items: items.map((item) => this.serialize(item, context)),
      total,
      page: query.page,
      limit: query.limit,
      pageCount: Math.max(1, Math.ceil(total / query.limit)),
    }
  }

  async getBySlug(slug: string, options: ListOptions) {
    const property = await this.db.property.findUnique({ where: { slug } })

    if (!property || (options.publicOnly && property.status !== 'PUBLISHED')) {
      throw new AppError(404, 'NOT_FOUND', 'Property not found')
    }

    return this.serialize(property, await this.currency.getPricingContext())
  }

  async getById(id: string) {
    const property = await this.db.property.findUnique({ where: { id } })

    if (!property) {
      throw new AppError(404, 'NOT_FOUND', 'Property not found')
    }

    return this.serialize(property, await this.currency.getPricingContext())
  }

  private serialize(property: Property, context: { usdToRub: number | null }) {
    const pricing = this.currency.price(property.price, property.currency, property.direction, context)
    return toPropertyDto(property, pricing)
  }

  async create(payload: CreatePropertyPayload) {
    const property = await this.db.property
      .create({
        data: {
          ...payload,
          publishedAt: payload.status === 'PUBLISHED' ? new Date() : null,
        },
      })
      .catch((error: unknown) => {
        throw this.translateWriteError(error)
      })

    return toPropertyDto(property)
  }

  async update(id: string, payload: UpdatePropertyPayload) {
    const existing = await this.db.property.findUnique({
      where: { id },
      select: { status: true, publishedAt: true },
    })

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Property not found')
    }

    const property = await this.db.property
      .update({
        where: { id },
        data: {
          ...payload,
          publishedAt: resolvePublishedAt(existing, payload),
        },
      })
      .catch((error: unknown) => {
        throw this.translateWriteError(error)
      })

    return toPropertyDto(property)
  }

  async delete(id: string) {
    await this.db.property.delete({ where: { id } }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError(404, 'NOT_FOUND', 'Property not found')
      }
      throw error
    })
  }

  private buildWhere(
    query: PropertyListQuery | AdminPropertyListQuery,
    options: ListOptions,
  ): Prisma.PropertyWhereInput {
    const where: Prisma.PropertyWhereInput = {}

    if (options.publicOnly) {
      where.status = 'PUBLISHED'
    } else if ('status' in query && query.status) {
      where.status = query.status
    }

    if (query.direction) where.direction = query.direction
    if (query.type) where.type = query.type
    if (query.currency) where.currency = query.currency
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' }
    if (query.rooms !== undefined) where.rooms = query.rooms

    if (query.premium !== undefined) where.premium = query.premium
    if (query.installment !== undefined) where.installment = query.installment
    if (query.isNewBuilding !== undefined) where.isNewBuilding = query.isNewBuilding

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      }
    }

    if (query.minArea !== undefined || query.maxArea !== undefined) {
      where.area = {
        ...(query.minArea !== undefined ? { gte: query.minArea } : {}),
        ...(query.maxArea !== undefined ? { lte: query.maxArea } : {}),
      }
    }

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { complex: { contains: query.q, mode: 'insensitive' } },
        { city: { contains: query.q, mode: 'insensitive' } },
        { district: { contains: query.q, mode: 'insensitive' } },
      ]
    }

    return where
  }

  private buildOrderBy(
    sort: PropertyListQuery['sort'],
  ): Prisma.PropertyOrderByWithRelationInput[] {
    switch (sort) {
      case 'price_asc':
        return [{ price: 'asc' }, { id: 'desc' }]
      case 'price_desc':
        return [{ price: 'desc' }, { id: 'desc' }]
      case 'area_asc':
        return [{ area: 'asc' }, { id: 'desc' }]
      case 'area_desc':
        return [{ area: 'desc' }, { id: 'desc' }]
      case 'newest':
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }]
    }
  }

  private translateWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppError(409, 'CONFLICT', 'A property with this slug already exists')
    }
    return error
  }
}

// Stamp publishedAt the first time a listing becomes PUBLISHED and preserve it
// afterwards: the timestamp records when a listing first went live, so it stays
// put even if the listing is later archived or sold. Returning `undefined`
// leaves the column untouched when the update omits `status`.
function resolvePublishedAt(
  existing: { status: string; publishedAt: Date | null },
  payload: UpdatePropertyPayload,
): Date | null | undefined {
  if (payload.status === undefined) {
    // Status not part of this update; leave publishedAt untouched.
    return undefined
  }

  if (payload.status === 'PUBLISHED' && existing.publishedAt === null) {
    return new Date()
  }

  return existing.publishedAt
}
