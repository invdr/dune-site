import { z } from 'zod'

import { currencySchema } from './property'

export const fxRateSchema = z.object({
  id: z.string(),
  base: currencySchema,
  quote: currencySchema,
  value: z.number(),
  source: z.string(),
  fetchedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type FxRateDto = z.infer<typeof fxRateSchema>

// Upsert one current rate per (base, quote) pair. `fetchedAt` defaults to now
// on the server when omitted.
export const upsertFxRateSchema = z.object({
  base: currencySchema,
  quote: currencySchema,
  value: z.number().positive(),
  source: z.string().trim().min(1).max(60),
  fetchedAt: z.string().datetime().optional(),
})

export type UpsertFxRateRequest = z.input<typeof upsertFxRateSchema>
export type UpsertFxRatePayload = z.output<typeof upsertFxRateSchema>

export const fxRateResponseSchema = z.object({ rate: fxRateSchema })
export type FxRateResponse = z.infer<typeof fxRateResponseSchema>

export const fxRateListResponseSchema = z.object({
  items: z.array(fxRateSchema),
})

export type FxRateListResponse = z.infer<typeof fxRateListResponseSchema>
