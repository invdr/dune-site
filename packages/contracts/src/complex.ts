import { z } from 'zod'

import {
  countrySchema,
  currencySchema,
  propertyAttributeSchema,
  propertyDirectionSchema,
  propertySchema,
  propertySlugSchema,
  propertyStatusSchema,
} from './property'

// A residential complex (ЖК) is an admin-authored marketing entity. Apartment
// units (Property rows whose `complex` matches the ЖК name) are joined at read
// time to surface the available lots and the "от X ₽/м²" headline.

const nameSchema = z.string().trim().min(2).max(200)
const citySchema = z.string().trim().min(2).max(120)
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))
const photoUrlSchema = z.string().trim().url().max(2048)
const photosSchema = z.array(photoUrlSchema).max(60)
const labelListSchema = z.array(z.string().trim().min(1).max(120)).max(20)
const attributesSchema = z.array(propertyAttributeSchema).max(60)
const optionalPriceSchema = z.number().int().min(0).max(2_000_000_000).nullish().transform((v) => v ?? null)
const optionalAreaSchema = z.number().int().min(0).max(1_000_000).nullish().transform((v) => v ?? null)
const optionalLatSchema = z.number().min(-90).max(90).nullish().transform((v) => v ?? null)
const optionalLngSchema = z.number().min(-180).max(180).nullish().transform((v) => v ?? null)

export const complexSchema = z.object({
  id: z.string(),
  slug: propertySlugSchema,
  name: nameSchema,
  status: propertyStatusSchema,
  direction: propertyDirectionSchema,
  country: countrySchema,
  city: z.string(),
  district: z.string().nullable(),
  developer: z.string().nullable(),
  delivery: z.string().nullable(),
  description: z.string().nullable(),
  photos: z.array(z.string()),
  placeholderTone: z.string().nullable(),
  badges: z.array(z.string()),
  features: z.array(z.string()),
  attributes: z.array(propertyAttributeSchema),
  premium: z.boolean(),
  currency: currencySchema,
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  // `priceFrom`/`areaFrom` are computed from linked units when any exist, and
  // fall back to the stored manual values otherwise. `pricePerMeterFrom` and
  // `unitCount` are always read-only, derived server-side.
  priceFrom: z.number().int().nullable(),
  areaFrom: z.number().int().nullable(),
  pricePerMeterFrom: z.number().int().nullable(),
  unitCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
})

export type ComplexDto = z.infer<typeof complexSchema>

// Detail view additionally carries the linked, published apartment units.
export const complexDetailSchema = complexSchema.extend({
  units: z.array(propertySchema),
})

export type ComplexDetailDto = z.infer<typeof complexDetailSchema>

// Writable fields without defaults — source of truth for partial updates.
const writableShape = {
  slug: propertySlugSchema,
  name: nameSchema,
  status: propertyStatusSchema,
  direction: propertyDirectionSchema,
  country: countrySchema,
  city: citySchema,
  district: optionalText(160),
  developer: optionalText(160),
  delivery: optionalText(120),
  description: optionalText(8000),
  photos: photosSchema,
  placeholderTone: optionalText(20),
  badges: labelListSchema,
  features: labelListSchema,
  attributes: attributesSchema,
  premium: z.boolean(),
  currency: currencySchema,
  address: optionalText(240),
  lat: optionalLatSchema,
  lng: optionalLngSchema,
  priceFrom: optionalPriceSchema,
  areaFrom: optionalAreaSchema,
} as const

export const createComplexSchema = z.object({
  ...writableShape,
  status: propertyStatusSchema.default('DRAFT'),
  direction: propertyDirectionSchema.default('NEW'),
  country: countrySchema.default('RU'),
  currency: currencySchema.default('RUB'),
  premium: z.boolean().default(false),
  photos: photosSchema.default([]),
  badges: labelListSchema.default([]),
  features: labelListSchema.default([]),
  attributes: attributesSchema.default([]),
})

export type CreateComplexRequest = z.input<typeof createComplexSchema>
export type CreateComplexPayload = z.output<typeof createComplexSchema>

export const updateComplexSchema = z
  .object(writableShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateComplexRequest = z.input<typeof updateComplexSchema>
export type UpdateComplexPayload = z.output<typeof updateComplexSchema>

export const complexSortSchema = z
  .enum(['newest', 'price_asc', 'price_desc', 'name_asc'])
  .default('newest')

export type ComplexSort = z.infer<typeof complexSortSchema>

const baseListQueryShape = {
  direction: propertyDirectionSchema.optional(),
  country: countrySchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  premium: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  q: z.string().trim().min(1).max(120).optional(),
  sort: complexSortSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
}

export const complexListQuerySchema = z.object(baseListQueryShape)
export type ComplexListQuery = z.infer<typeof complexListQuerySchema>

export const adminComplexListQuerySchema = z.object({
  ...baseListQueryShape,
  status: propertyStatusSchema.optional(),
})
export type AdminComplexListQuery = z.infer<typeof adminComplexListQuerySchema>

export const complexListResponseSchema = z.object({
  items: z.array(complexSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pageCount: z.number().int(),
})
export type ComplexListResponse = z.infer<typeof complexListResponseSchema>

export const complexResponseSchema = z.object({ complex: complexSchema })
export type ComplexResponse = z.infer<typeof complexResponseSchema>

export const complexDetailResponseSchema = z.object({ complex: complexDetailSchema })
export type ComplexDetailResponse = z.infer<typeof complexDetailResponseSchema>

// Bulk bootstrap: create DRAFT ЖК stubs from the distinct `complex` names found
// on new-build property rows that don't yet have a complex of their own.
export const bulkCreateComplexesResultSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  items: z.array(complexSchema),
})
export type BulkCreateComplexesResult = z.infer<typeof bulkCreateComplexesResultSchema>
