import { z } from 'zod'

import { propertySlugSchema } from './property'

const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))

const optionalUrl = (max: number) =>
  z
    .union([z.string().trim().url().max(max), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value === undefined || value === null ? null : value))

// --- SiteSettings (singleton): integration secrets + FX surcharge ---

export const siteSettingsSchema = z.object({
  id: z.string(),
  telegramBotToken: z.string().nullable(),
  telegramChatId: z.string().nullable(),
  bitrixWebhookUrl: z.string().nullable(),
  bitrixEnabled: z.boolean(),
  yandexMapsApiKey: z.string().nullable(),
  usdRubSurcharge: z.number().int(),
  companyName: z.string().nullable(),
  companyPhone: z.string().nullable(),
  companyContact: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type SiteSettingsDto = z.infer<typeof siteSettingsSchema>

// Public projection: company fallback contact only. Integration secrets
// (Telegram/Bitrix) and the FX surcharge are never exposed to the browser.
export const publicSiteSettingsSchema = z.object({
  companyName: z.string().nullable(),
  companyPhone: z.string().nullable(),
  companyContact: z.string().nullable(),
})

export type PublicSiteSettingsDto = z.infer<typeof publicSiteSettingsSchema>

export const publicSiteSettingsResponseSchema = z.object({ settings: publicSiteSettingsSchema })
export type PublicSiteSettingsResponse = z.infer<typeof publicSiteSettingsResponseSchema>

const writableSiteSettingsShape = {
  telegramBotToken: optionalText(200),
  telegramChatId: optionalText(120),
  bitrixWebhookUrl: optionalUrl(2048),
  bitrixEnabled: z.boolean(),
  yandexMapsApiKey: optionalText(200),
  usdRubSurcharge: z.number().int().min(0).max(1000),
  companyName: optionalText(160),
  companyPhone: optionalText(60),
  companyContact: optionalText(200),
} as const

export const updateSiteSettingsSchema = z
  .object(writableSiteSettingsShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateSiteSettingsRequest = z.input<typeof updateSiteSettingsSchema>
export type UpdateSiteSettingsPayload = z.output<typeof updateSiteSettingsSchema>

export const siteSettingsResponseSchema = z.object({ settings: siteSettingsSchema })
export type SiteSettingsResponse = z.infer<typeof siteSettingsResponseSchema>

// --- HomeContent (singleton): editorial content for fixed home sections (§6) ---

export const homeContentSchema = z.object({
  id: z.string(),
  heroTitle: z.string().nullable(),
  heroSubtitle: z.string().nullable(),
  heroImageUrl: z.string().nullable(),
  chosenSlugs: z.array(z.string()),
  tileLinks: z.unknown().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type HomeContentDto = z.infer<typeof homeContentSchema>

const writableHomeContentShape = {
  heroTitle: optionalText(200),
  heroSubtitle: optionalText(400),
  heroImageUrl: optionalUrl(2048),
  chosenSlugs: z.array(propertySlugSchema).max(40),
  tileLinks: z.unknown().nullish(),
} as const

export const updateHomeContentSchema = z
  .object(writableHomeContentShape)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type UpdateHomeContentRequest = z.input<typeof updateHomeContentSchema>
export type UpdateHomeContentPayload = z.output<typeof updateHomeContentSchema>

export const homeContentResponseSchema = z.object({ content: homeContentSchema })
export type HomeContentResponse = z.infer<typeof homeContentResponseSchema>
