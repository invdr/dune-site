import { z } from 'zod'

import { priceSetSchema } from './pricing'

export const propertyDirectionSchema = z.enum(['NEW', 'RESALE', 'DUBAI', 'SAUDI'])
// Catalog hierarchy (Country → City → Category → Type).
export const countrySchema = z.enum(['RU', 'AE', 'SA'])
export const propertyCategorySchema = z.enum(['RESIDENTIAL', 'COMMERCIAL'])
export const propertyTypeSchema = z.enum(['APARTMENT', 'HOUSE', 'TOWNHOUSE', 'COMMERCIAL', 'LAND'])
export const propertyStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SOLD'])
export const currencySchema = z.enum(['RUB', 'USD'])
// Provenance of a listing: mirrored from QuickDeal, or authored on the site.
export const propertySourceSchema = z.enum(['QUICKDEAL', 'SITE'])
// LAND-only: permitted land-use category (ИЖС/СНТ/ЛПХ/коммерческая).
export const landUseSchema = z.enum(['IZHS', 'SNT', 'LPH', 'COMMERCIAL'])
// COMMERCIAL-only: kind of unit.
export const commercialKindSchema = z.enum(['OFFICE', 'RETAIL', 'WAREHOUSE', 'FOOD_SERVICE', 'FREE_PURPOSE'])
// LAND-only: available utilities (closed set guarded here, stored as String[]).
export const utilitySchema = z.enum(['ELECTRICITY', 'GAS', 'WATER', 'SEWERAGE'])

// One characteristic row on the property page, e.g. { label: 'Этаж', value: '3 / 30' }.
export const propertyAttributeSchema = z.object({ label: z.string(), value: z.string() })

export type PropertyDirection = z.infer<typeof propertyDirectionSchema>
export type Country = z.infer<typeof countrySchema>
export type PropertyCategory = z.infer<typeof propertyCategorySchema>
export type PropertyAttribute = z.infer<typeof propertyAttributeSchema>
export type PropertyType = z.infer<typeof propertyTypeSchema>
export type PropertyStatus = z.infer<typeof propertyStatusSchema>
export type Currency = z.infer<typeof currencySchema>
export type PropertySource = z.infer<typeof propertySourceSchema>
export type LandUse = z.infer<typeof landUseSchema>
export type CommercialKind = z.infer<typeof commercialKindSchema>
export type Utility = z.infer<typeof utilitySchema>

// URL-safe slug: lowercase alphanumeric segments separated by single hyphens.
export const propertySlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with single hyphens')

export const propertySchema = z.object({
  id: z.string(),
  slug: propertySlugSchema,
  direction: propertyDirectionSchema,
  country: countrySchema,
  category: propertyCategorySchema,
  type: propertyTypeSchema,
  status: propertyStatusSchema,
  title: z.string(),
  rooms: z.number().int(),
  area: z.number().int(),
  floor: z.number().int().nullable(),
  totalFloors: z.number().int().nullable(),
  complex: z.string().nullable(),
  city: z.string(),
  district: z.string().nullable(),
  price: z.number().int(),
  currency: currencySchema,
  premium: z.boolean(),
  installment: z.boolean(),
  isNewBuilding: z.boolean(),
  delivery: z.string().nullable(),
  photos: z.array(z.string()),
  placeholderTone: z.string().nullable(),
  badges: z.array(z.string()),
  features: z.array(z.string()),
  description: z.string().nullable(),
  attributes: z.array(propertyAttributeSchema),
  source: propertySourceSchema,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  landUse: landUseSchema.nullable(),
  commercialKind: commercialKindSchema.nullable(),
  utilities: z.array(utilitySchema),
  // Personal manager mirrored from QuickDeal `assigned`; first tier of the
  // card's manager chain (personal → direction → company).
  managerName: z.string().nullable(),
  managerPhone: z.string().nullable(),
  managerPhotoUrl: z.string().nullable(),
  // Multi-currency display set computed per direction (null on admin/raw reads).
  pricing: priceSetSchema.nullable(),
  externalId: z.string().nullable(),
  externalSource: z.string().nullable(),
  syncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
})

export type PropertyDto = z.infer<typeof propertySchema>

const titleSchema = z.string().trim().min(2).max(200)
const citySchema = z.string().trim().min(2).max(120)
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))
const photoUrlSchema = z.string().trim().url().max(2048)
const photosSchema = z.array(photoUrlSchema).max(40)
const labelListSchema = z.array(z.string().trim().min(1).max(120)).max(20)
const roomsSchema = z.number().int().min(0).max(50)
const areaSchema = z.number().int().min(1).max(100_000)
const floorSchema = z.number().int().min(-5).max(300)
const optionalFloorSchema = floorSchema.nullish().transform((value) => value ?? null)
const priceSchema = z.number().int().min(0).max(2_000_000_000)
const optionalLatSchema = z.number().min(-90).max(90).nullish().transform((value) => value ?? null)
const optionalLngSchema = z.number().min(-180).max(180).nullish().transform((value) => value ?? null)
const optionalLandUseSchema = landUseSchema.nullish().transform((value) => value ?? null)
const optionalCommercialKindSchema = commercialKindSchema.nullish().transform((value) => value ?? null)
const utilitiesSchema = z.array(utilitySchema).max(8)
const optionalManagerPhotoSchema = z
  .union([z.string().trim().url().max(2048), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value === undefined || value === null ? null : value))

// Writable fields without defaults — the source of truth for partial updates.
// Create layers defaults on top so admins can omit optional fields once.
// `source` (provenance) is intentionally NOT here: it is set once at create
// time and is immutable afterwards, so an admin edit can never flip a
// QuickDeal-mirrored listing to SITE (which would detach it from sync).
const attributesSchema = z.array(propertyAttributeSchema).max(60)

const writableShape = {
  slug: propertySlugSchema,
  direction: propertyDirectionSchema,
  country: countrySchema,
  category: propertyCategorySchema,
  type: propertyTypeSchema,
  status: propertyStatusSchema,
  title: titleSchema,
  rooms: roomsSchema,
  area: areaSchema,
  floor: optionalFloorSchema,
  totalFloors: optionalFloorSchema,
  complex: optionalText(200),
  city: citySchema,
  district: optionalText(160),
  price: priceSchema,
  currency: currencySchema,
  premium: z.boolean(),
  installment: z.boolean(),
  isNewBuilding: z.boolean(),
  delivery: optionalText(120),
  photos: photosSchema,
  placeholderTone: optionalText(20),
  badges: labelListSchema,
  features: labelListSchema,
  description: optionalText(8000),
  attributes: attributesSchema,
  lat: optionalLatSchema,
  lng: optionalLngSchema,
  landUse: optionalLandUseSchema,
  commercialKind: optionalCommercialKindSchema,
  utilities: utilitiesSchema,
  managerName: optionalText(120),
  managerPhone: optionalText(60),
  managerPhotoUrl: optionalManagerPhotoSchema,
} as const

export const createPropertySchema = z.object({
  ...writableShape,
  status: propertyStatusSchema.default('DRAFT'),
  country: countrySchema.default('RU'),
  category: propertyCategorySchema.default('RESIDENTIAL'),
  attributes: attributesSchema.default([]),
  rooms: roomsSchema.default(0),
  currency: currencySchema.default('RUB'),
  premium: z.boolean().default(false),
  installment: z.boolean().default(false),
  isNewBuilding: z.boolean().default(false),
  photos: photosSchema.default([]),
  badges: labelListSchema.default([]),
  features: labelListSchema.default([]),
  // Provenance is fixed at creation; admin-authored listings are always SITE.
  source: propertySourceSchema.default('SITE'),
  utilities: utilitiesSchema.default([]),
})

export type CreatePropertyRequest = z.input<typeof createPropertySchema>
export type CreatePropertyPayload = z.output<typeof createPropertySchema>

// Every field optional for partial admin updates; at least one must be provided.
// Built from the default-free shape so an empty body cannot silently reset
// columns to their create-time defaults.
export const updatePropertySchema = z
  .object(writableShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdatePropertyRequest = z.input<typeof updatePropertySchema>
export type UpdatePropertyPayload = z.output<typeof updatePropertySchema>

// Query-string booleans arrive as strings; accept the literal forms.
const booleanQuerySchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()

export const propertySortSchema = z
  .enum(['newest', 'price_asc', 'price_desc', 'area_asc', 'area_desc'])
  .default('newest')

export type PropertySort = z.infer<typeof propertySortSchema>

const baseListQueryShape = {
  direction: propertyDirectionSchema.optional(),
  country: countrySchema.optional(),
  category: propertyCategorySchema.optional(),
  type: propertyTypeSchema.optional(),
  landUse: landUseSchema.optional(),
  commercialKind: commercialKindSchema.optional(),
  source: propertySourceSchema.optional(),
  currency: currencySchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  rooms: z.coerce.number().int().min(0).max(50).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  minArea: z.coerce.number().int().min(0).optional(),
  maxArea: z.coerce.number().int().min(0).optional(),
  premium: booleanQuerySchema,
  installment: booleanQuerySchema,
  isNewBuilding: booleanQuerySchema,
  q: z.string().trim().min(1).max(120).optional(),
  sort: propertySortSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
}

export const propertyListQuerySchema = z.object(baseListQueryShape)

export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>

// Admin listing additionally filters by publication status across all states.
export const adminPropertyListQuerySchema = z.object({
  ...baseListQueryShape,
  status: propertyStatusSchema.optional(),
})

export type AdminPropertyListQuery = z.infer<typeof adminPropertyListQuerySchema>

export const propertyListResponseSchema = z.object({
  items: z.array(propertySchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pageCount: z.number().int(),
})

export type PropertyListResponse = z.infer<typeof propertyListResponseSchema>

export const propertyResponseSchema = z.object({
  property: propertySchema,
})

export type PropertyResponse = z.infer<typeof propertyResponseSchema>

// City facet for the catalog hierarchy: distinct published cities per country,
// ordered by listing count so the catalog can offer real, populated options.
export const propertyCityFacetSchema = z.object({
  country: countrySchema,
  city: z.string(),
  count: z.number().int(),
})

export const propertyCitiesResponseSchema = z.object({
  cities: z.array(propertyCityFacetSchema),
})

export type PropertyCityFacet = z.infer<typeof propertyCityFacetSchema>
export type PropertyCitiesResponse = z.infer<typeof propertyCitiesResponseSchema>
