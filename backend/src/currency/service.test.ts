import { describe, expect, test } from 'bun:test'

import type { DbClient } from '../db'
import { USD_TO_AED, USD_TO_SAR } from './pricing'
import { CurrencyService } from './service'

type RateRow = { value: number; fetchedAt: Date } | null
type SettingsRow = { usdRubSurcharge: number } | null

// Minimal in-memory stand-in for the Prisma client surface the service touches:
// the array form of `$transaction`, a single cached USD→RUB rate, the settings
// singleton, and `fxRate.upsert` (whose calls we count to prove the cache is
// preserved when a CBR refresh fails).
function makeDb({ rate, settings }: { rate: RateRow; settings: SettingsRow }) {
  const upsertCalls: unknown[] = []
  const db = {
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
    fxRate: {
      findUnique: async () => rate,
      upsert: async (args: unknown) => {
        upsertCalls.push(args)
        return rate
      },
    },
    siteSettings: {
      findUnique: async () => settings,
    },
  }
  return { db: db as unknown as DbClient, upsertCalls }
}

const asOf = new Date('2026-06-01T00:00:00.000Z')

describe('CurrencyService.getFxContext', () => {
  test('applies the settings surcharge on top of the cached CBR rate', async () => {
    const { db } = makeDb({ rate: { value: 90, fetchedAt: asOf }, settings: { usdRubSurcharge: 5 } })
    const fx = await new CurrencyService(db).getFxContext()

    expect(fx.usdToRub).toBe(95)
    expect(fx.surcharge).toBe(5)
    expect(fx.usdToAed).toBe(USD_TO_AED)
    expect(fx.usdToSar).toBe(USD_TO_SAR)
    expect(fx.asOf).toBe(asOf.toISOString())
  })

  test('falls back to the +2 ₽ default surcharge when settings are unset', async () => {
    const { db } = makeDb({ rate: { value: 90, fetchedAt: asOf }, settings: null })
    const fx = await new CurrencyService(db).getFxContext()

    expect(fx.usdToRub).toBe(92)
    expect(fx.surcharge).toBe(2)
  })

  test('cold start with no cached rate hides ₽ (null) but keeps the pegs', async () => {
    const { db } = makeDb({ rate: null, settings: { usdRubSurcharge: 5 } })
    const fx = await new CurrencyService(db).getFxContext()

    expect(fx.usdToRub).toBeNull()
    expect(fx.asOf).toBeNull()
    expect(fx.usdToAed).toBe(USD_TO_AED)
    expect(fx.usdToSar).toBe(USD_TO_SAR)
  })
})

describe('CurrencyService.getPricingContext', () => {
  test('keeps showing the last known rate indefinitely (no staleness cutoff)', async () => {
    const stale = new Date('2020-01-01T00:00:00.000Z')
    const { db } = makeDb({ rate: { value: 100, fetchedAt: stale }, settings: { usdRubSurcharge: 2 } })

    const context = await new CurrencyService(db).getPricingContext()
    expect(context.usdToRub).toBe(102)
  })

  test('cold start yields a null pivot so listings drop the ₽ line', async () => {
    const { db } = makeDb({ rate: null, settings: null })
    const context = await new CurrencyService(db).getPricingContext()
    expect(context.usdToRub).toBeNull()
  })
})

describe('CurrencyService.refreshFromCbr', () => {
  test('propagates the CBR failure and leaves the cached rate untouched', async () => {
    const { db, upsertCalls } = makeDb({
      rate: { value: 90, fetchedAt: asOf },
      settings: { usdRubSurcharge: 2 },
    })
    const service = new CurrencyService(db)

    await expect(
      service.refreshFromCbr(async () => {
        throw new Error('CBR unreachable')
      }),
    ).rejects.toThrow('CBR unreachable')

    // Never reached the upsert, so the previously cached value still stands.
    expect(upsertCalls).toHaveLength(0)
    expect((await service.getPricingContext()).usdToRub).toBe(92)
  })

  test('caches a freshly fetched rate on success', async () => {
    const { db, upsertCalls } = makeDb({ rate: null, settings: null })
    const service = new CurrencyService(db)

    const result = await service.refreshFromCbr(
      async () => '<Valute ID="R01235"><Nominal>1</Nominal><Value>95,5000</Value></Valute>',
    )

    expect(result.value).toBeCloseTo(95.5, 4)
    expect(upsertCalls).toHaveLength(1)
  })
})
