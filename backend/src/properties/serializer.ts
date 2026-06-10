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
    createdAt: property.createdAt.toISOString(),
    updatedAt: property.updatedAt.toISOString(),
    publishedAt: property.publishedAt ? property.publishedAt.toISOString() : null,
  }
}
