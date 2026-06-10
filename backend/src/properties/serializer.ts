import type { PropertyDto } from '@dune/contracts'

import type { Property } from '../generated/prisma/client'

export function toPropertyDto(property: Property): PropertyDto {
  return {
    id: property.id,
    slug: property.slug,
    direction: property.direction,
    type: property.type,
    status: property.status,
    title: property.title,
    rooms: property.rooms,
    area: property.area,
    floor: property.floor,
    totalFloors: property.totalFloors,
    complex: property.complex,
    city: property.city,
    district: property.district,
    price: property.price,
    currency: property.currency,
    premium: property.premium,
    installment: property.installment,
    isNewBuilding: property.isNewBuilding,
    delivery: property.delivery,
    photos: property.photos,
    placeholderTone: property.placeholderTone,
    badges: property.badges,
    features: property.features,
    source: property.source,
    lat: property.lat,
    lng: property.lng,
    landUse: property.landUse,
    commercialKind: property.commercialKind,
    // DB column is an unconstrained String[]; the write-side contract guarantees
    // the values, so narrow to the DTO's enum array here.
    utilities: property.utilities as PropertyDto['utilities'],
    externalId: property.externalId,
    externalSource: property.externalSource,
    syncedAt: property.syncedAt ? property.syncedAt.toISOString() : null,
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    publishedAt: property.publishedAt ? property.publishedAt.toISOString() : null,
  }
}
