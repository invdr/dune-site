import { z } from 'zod'

// Display currencies shown on cards/pages. Storage is only RUB|USD
// (`currencySchema`); AED/SAR exist purely as derived display lines.
export const displayCurrencySchema = z.enum(['RUB', 'USD', 'AED', 'SAR'])
export type DisplayCurrency = z.infer<typeof displayCurrencySchema>

// One rendered money line. `approximate` drives the "≈" prefix: it is true for
// every derived value (RUB equivalent, and AED/SAR per the product decision)
// and false only for the object's own stored base price.
export const priceLineSchema = z.object({
  currency: displayCurrencySchema,
  amount: z.number().int().nonnegative(),
  approximate: z.boolean(),
})
export type PriceLine = z.infer<typeof priceLineSchema>

// The full per-direction price set for one listing.
// - `onRequest`: price is 0/unset → render "Цена по запросу", no figures.
// - `base`: the primary line to feature (null when on request).
// - `lines`: ordered display set for the direction (RF → [₽]; Dubai → [$, AED, ₽];
//   Saudi → [$, SAR, ₽]). The ₽ line is omitted on a full cold start (no FX rate).
export const priceSetSchema = z.object({
  onRequest: z.boolean(),
  base: priceLineSchema.nullable(),
  lines: z.array(priceLineSchema),
})
export type PriceSet = z.infer<typeof priceSetSchema>

// Current FX context exposed publicly so non-listing surfaces can convert too
// (e.g. a catalog price slider). `usdToRub` already includes the settings
// surcharge; it is null on a full cold start. `asOf` is the source timestamp.
export const fxContextSchema = z.object({
  usdToRub: z.number().nullable(),
  usdToAed: z.number(),
  usdToSar: z.number(),
  surcharge: z.number().int(),
  asOf: z.string().datetime().nullable(),
})
export type FxContext = z.infer<typeof fxContextSchema>

export const fxContextResponseSchema = z.object({ fx: fxContextSchema })
export type FxContextResponse = z.infer<typeof fxContextResponseSchema>
