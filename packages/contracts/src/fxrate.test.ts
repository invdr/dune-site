import { describe, expect, test } from 'bun:test'

import { fxRateSchema, upsertFxRateSchema } from './fxrate'

describe('fx rate contracts', () => {
  test('parses a valid rate DTO', () => {
    const result = fxRateSchema.parse({
      id: 'fx-1',
      base: 'USD',
      quote: 'RUB',
      value: 90.5,
      source: 'CBR',
      fetchedAt: '2026-06-10T00:00:00.000Z',
      updatedAt: '2026-06-10T00:00:00.000Z',
    })
    expect(result.value).toBe(90.5)
    expect(result.base).toBe('USD')
  })

  test('rejects unknown currency and non-positive value on upsert', () => {
    expect(
      upsertFxRateSchema.safeParse({ base: 'EUR', quote: 'RUB', value: 90, source: 'CBR' }).success,
    ).toBe(false)
    expect(
      upsertFxRateSchema.safeParse({ base: 'USD', quote: 'RUB', value: 0, source: 'CBR' }).success,
    ).toBe(false)
  })
})
