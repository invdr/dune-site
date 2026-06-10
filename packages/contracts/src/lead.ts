import { z } from 'zod'

import { propertyDirectionSchema } from './property'

export const leadStatusSchema = z.enum(['NEW', 'IN_PROGRESS', 'DONE', 'SPAM'])
export type LeadStatus = z.infer<typeof leadStatusSchema>

// Collapses blank/undefined/null to null, mirroring the property contract.
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))

// Normalize first (trim + lowercase) so a blank/whitespace value collapses to
// null instead of failing email validation; a present value must be a real email.
const optionalEmail = z
  .preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.union([z.literal(''), z.string().email().max(254)]).nullish(),
  )
  .transform((value) => (value === '' || value === undefined || value === null ? null : value))

const nameSchema = z.string().trim().min(2).max(120)
const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(32)
  .regex(/^[+0-9()\-\s]+$/, 'Phone may contain digits, spaces and + ( ) - only')

export const leadSchema = z.object({
  id: z.string(),
  name: nameSchema,
  phone: z.string(),
  email: z.string().nullable(),
  message: z.string().nullable(),
  source: z.string().nullable(),
  direction: propertyDirectionSchema.nullable(),
  propertyId: z.string().nullable(),
  status: leadStatusSchema,
  consentAt: z.string().datetime(),
  telegramSentAt: z.string().datetime().nullable(),
  bitrixSentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type LeadDto = z.infer<typeof leadSchema>

// Public submission: PDn consent is mandatory; honeypot must stay empty and is
// never persisted (the server reads it for spam detection then discards it).
export const createLeadSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  email: optionalEmail,
  message: optionalText(2000),
  source: optionalText(120),
  direction: propertyDirectionSchema.optional(),
  propertyId: z.string().uuid().optional(),
  consent: z.literal(true, {
    message: 'Consent to personal data processing is required',
  }),
  honeypot: z.string().max(0).optional(),
})

export type CreateLeadRequest = z.input<typeof createLeadSchema>
export type CreateLeadPayload = z.output<typeof createLeadSchema>

// Admin-side mutations: status changes and delivery markers.
const writableLeadShape = {
  status: leadStatusSchema,
  telegramSentAt: z.string().datetime().nullable(),
  bitrixSentAt: z.string().datetime().nullable(),
} as const

export const updateLeadSchema = z
  .object(writableLeadShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateLeadRequest = z.input<typeof updateLeadSchema>
export type UpdateLeadPayload = z.output<typeof updateLeadSchema>

export const leadListQuerySchema = z.object({
  status: leadStatusSchema.optional(),
  direction: propertyDirectionSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
})

export type LeadListQuery = z.infer<typeof leadListQuerySchema>

export const leadResponseSchema = z.object({ lead: leadSchema })
export type LeadResponse = z.infer<typeof leadResponseSchema>

export const leadListResponseSchema = z.object({
  items: z.array(leadSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
  pageCount: z.number().int(),
})

export type LeadListResponse = z.infer<typeof leadListResponseSchema>
