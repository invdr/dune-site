import { describe, expect, test } from 'bun:test'

import { updateHomeContentSchema, updateSiteSettingsSchema } from './settings'

describe('site settings contracts', () => {
  test('rejects empty updates and validates surcharge bounds', () => {
    expect(updateSiteSettingsSchema.safeParse({}).success).toBe(false)
    expect(updateSiteSettingsSchema.safeParse({ usdRubSurcharge: 5 }).success).toBe(true)
    expect(updateSiteSettingsSchema.safeParse({ usdRubSurcharge: -1 }).success).toBe(false)
  })

  test('validates the Bitrix webhook URL when present', () => {
    expect(updateSiteSettingsSchema.safeParse({ bitrixWebhookUrl: 'not a url' }).success).toBe(false)
    expect(
      updateSiteSettingsSchema.safeParse({ bitrixWebhookUrl: 'https://crm.example/hook/1' }).success,
    ).toBe(true)
    // Empty string clears the field (collapses to null).
    expect(updateSiteSettingsSchema.parse({ bitrixWebhookUrl: '' }).bitrixWebhookUrl).toBeNull()
  })
})

describe('home content contracts', () => {
  test('validates chosen slugs against the slug format', () => {
    expect(updateHomeContentSchema.safeParse({ chosenSlugs: ['gz-01', 'db-03'] }).success).toBe(true)
    expect(updateHomeContentSchema.safeParse({ chosenSlugs: ['Bad Slug'] }).success).toBe(false)
  })

  test('rejects empty update payloads', () => {
    expect(updateHomeContentSchema.safeParse({}).success).toBe(false)
  })
})
