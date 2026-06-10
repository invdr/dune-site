import { z } from 'zod'

import { propertyDirectionSchema } from './property'

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))

const managerNameSchema = z.string().trim().min(2).max(120)
const photoUrlSchema = z
  .union([z.string().trim().url().max(2048), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value === undefined || value === null ? null : value))

export const managerSchema = z.object({
  id: z.string(),
  direction: propertyDirectionSchema,
  name: managerNameSchema,
  photo: z.string().nullable(),
  phone: z.string().nullable(),
  contact: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type ManagerDto = z.infer<typeof managerSchema>

const writableManagerShape = {
  direction: propertyDirectionSchema,
  name: managerNameSchema,
  photo: photoUrlSchema,
  phone: optionalText(60),
  contact: optionalText(200),
  active: z.boolean(),
} as const

export const createManagerSchema = z.object({
  ...writableManagerShape,
  active: z.boolean().default(true),
})

export type CreateManagerRequest = z.input<typeof createManagerSchema>
export type CreateManagerPayload = z.output<typeof createManagerSchema>

export const updateManagerSchema = z
  .object(writableManagerShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateManagerRequest = z.input<typeof updateManagerSchema>
export type UpdateManagerPayload = z.output<typeof updateManagerSchema>

export const managerResponseSchema = z.object({ manager: managerSchema })
export type ManagerResponse = z.infer<typeof managerResponseSchema>

// Resolved contact for a property card: the single manager/contact to show,
// after applying the precedence personal (object) → direction → company. `source`
// tells the UI which tier was used; `contact` may be null on a full fallthrough.
export const resolvedContactSchema = z.object({
  source: z.enum(['personal', 'direction', 'company']),
  name: z.string(),
  phone: z.string().nullable(),
  photo: z.string().nullable(),
  contact: z.string().nullable(),
})

export type ResolvedContactDto = z.infer<typeof resolvedContactSchema>

export const resolvedContactResponseSchema = z.object({ contact: resolvedContactSchema.nullable() })
export type ResolvedContactResponse = z.infer<typeof resolvedContactResponseSchema>

export const managerListResponseSchema = z.object({
  items: z.array(managerSchema),
})

export type ManagerListResponse = z.infer<typeof managerListResponseSchema>
