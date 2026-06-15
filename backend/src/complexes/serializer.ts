import type { ComplexDto, PropertyAttribute } from '@dune/contracts'

import type { Complex } from '../generated/prisma/client'

// Read-time aggregates derived from the complex's linked apartment units (or the
// stored manual fallbacks when no units are linked). Computed by the service.
export type ComplexAggregate = {
  // Minimum total unit price (null when unknown).
  priceFrom: number | null
  // Minimum unit area in m² (null when unknown).
  areaFrom: number | null
  // Minimum price per m² — the catalog headline ("от X ₽/м²").
  pricePerMeterFrom: number | null
  // Number of linked published units.
  unitCount: number
}

export function toComplexDto(complex: Complex, aggregate: ComplexAggregate): ComplexDto {
  return {
    id: complex.id,
    slug: complex.slug,
    name: complex.name,
    status: complex.status,
    direction: complex.direction,
    country: complex.country,
    city: complex.city,
    district: complex.district,
    developer: complex.developer,
    delivery: complex.delivery,
    description: complex.description,
    photos: complex.photos,
    floorPlans: complex.floorPlans,
    placeholderTone: complex.placeholderTone,
    badges: complex.badges,
    features: complex.features,
    // DB column is Json; the contract guarantees the {label,value} shape.
    attributes: (complex.attributes ?? []) as PropertyAttribute[],
    premium: complex.premium,
    currency: complex.currency,
    address: complex.address,
    lat: complex.lat,
    lng: complex.lng,
    priceFrom: aggregate.priceFrom,
    areaFrom: aggregate.areaFrom,
    pricePerMeterFrom: aggregate.pricePerMeterFrom,
    unitCount: aggregate.unitCount,
    createdAt: complex.createdAt.toISOString(),
    updatedAt: complex.updatedAt.toISOString(),
    publishedAt: complex.publishedAt ? complex.publishedAt.toISOString() : null,
  }
}
