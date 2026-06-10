import { z } from 'zod'

export const propertyDirectionSchema = z.enum(['NEW', 'RESALE', 'DUBAI', 'SAUDI'])
export const propertyTypeSchema = z.enum(['APARTMENT', 'STUDIO', 'HOUSE', 'VILLA'])
export const propertyStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SOLD'])
export const currencySchema = z.enum(['RUB', 'USD'])

export type PropertyDirection = z.infer<typeof propertyDirectionSchema>
export type PropertyType = z.infer<typeof propertyTypeSchema>
export type PropertyStatus = z.infer<typeof propertyStatusSchema>
export type Currency = z.infer<typeof currencySchema>

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

// Writable fields without defaults — the source of truth for partial updates.
// Create layers defaults on top so admins can omit optional fields once.
const writableShape = {
  slug: propertySlugSchema,
  direction: propertyDirectionSchema,
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
} as const

export const createPropertySchema = z.object({
  ...writableShape,
  status: propertyStatusSchema.default('DRAFT'),
  rooms: roomsSchema.default(0),
  currency: currencySchema.default('RUB'),
  premium: z.boolean().default(false),
  installment: z.boolean().default(false),
  isNewBuilding: z.boolean().default(false),
  photos: photosSchema.default([]),
  badges: labelListSchema.default([]),
  features: labelListSchema.default([]),
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
  type: propertyTypeSchema.optional(),
  currency: currencySchema.optional(),
  city: z.string().trim().min(1).max(120).optional(),
  rooms: z.coerce.number().int().min(0).max(50).optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
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
