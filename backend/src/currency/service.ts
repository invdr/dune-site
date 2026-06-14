import type { FxContext as FxContextDto, PriceSet, PropertyDirection } from '@dune/contracts'

import type { DbClient } from '../db'
import type { Currency } from '../generated/prisma/client'
import { fetchCbrUsdRub, type CbrFetcher } from './cbr'
import { buildPriceSet, USD_TO_AED, USD_TO_SAR, type FxContext } from './pricing'

const DEFAULT_SURCHARGE = 2

// Reads the cached CBR rate plus the settings surcharge, and refreshes the cache
// from the Central Bank. There is no staleness cutoff: per the product decision
// the last known rate is shown indefinitely (only a full cold start hides ₽).
export class CurrencyService {
  constructor(private readonly db: DbClient) {}

  // Surcharge-inclusive USD→RUB, or null when no rate was ever cached.
  private async loadUsdToRub(): Promise<{ usdToRub: number | null; asOf: Date | null }> {
    const [rate, settings] = await this.db.$transaction([
      this.db.fxRate.findUnique({ where: { base_quote: { base: 'USD', quote: 'RUB' } } }),
      this.db.siteSettings.findUnique({ where: { id: 'singleton' } }),
    ])

    if (!rate) return { usdToRub: null, asOf: null }

    const surcharge = settings?.usdRubSurcharge ?? DEFAULT_SURCHARGE
    return { usdToRub: Number(rate.value) + surcharge, asOf: rate.fetchedAt }
  }

  // Pivot context for `buildPriceSet`; fetch once per request and reuse.
  async getPricingContext(): Promise<FxContext> {
    const { usdToRub } = await this.loadUsdToRub()
    return { usdToRub }
  }

  // Public FX snapshot for non-listing surfaces (e.g. a catalog price slider).
  async getFxContext(): Promise<FxContextDto> {
    const [{ usdToRub, asOf }, settings] = await Promise.all([
      this.loadUsdToRub(),
      this.db.siteSettings.findUnique({ where: { id: 'singleton' } }),
    ])

    return {
      usdToRub,
      usdToAed: USD_TO_AED,
      usdToSar: USD_TO_SAR,
      surcharge: settings?.usdRubSurcharge ?? DEFAULT_SURCHARGE,
      asOf: asOf ? asOf.toISOString() : null,
    }
  }

  // Builds a listing's price set against an already-loaded context.
  price(
    price: number,
    currency: Currency,
    direction: PropertyDirection,
    context: FxContext,
  ): PriceSet {
    return buildPriceSet(price, currency, direction, context)
  }

  // Fetches today's USD→RUB from the CBR and upserts the cached row. On failure
  // it throws; the caller (cron) logs and leaves the last known value in place.
  async refreshFromCbr(fetcher?: CbrFetcher): Promise<{ value: number }> {
    const value = await fetchCbrUsdRub(fetcher)
    await this.db.fxRate.upsert({
      where: { base_quote: { base: 'USD', quote: 'RUB' } },
      create: { base: 'USD', quote: 'RUB', value, source: 'CBR', fetchedAt: new Date() },
      update: { value, source: 'CBR', fetchedAt: new Date() },
    })
    return { value }
  }
}
