import type { Currency, DisplayCurrency, PriceSet, PropertyDirection } from '@dune/contracts'

// AED and SAR are hard-pegged to the US dollar, so these are constants rather
// than fetched rates (PRD §5). The peg makes them mathematically exact, but the
// product decision is to still render them with "≈" alongside the floating ₽.
export const USD_TO_AED = 3.6725
export const USD_TO_SAR = 3.75

// Rounding granularity per display currency. ₽ is a coarse orientation figure
// (round to 100k); the pegged locals round to a clean 1k; $ shows as stored.
const RUB_ROUND_STEP = 100_000
const LOCAL_ROUND_STEP = 1_000

// Live conversion inputs. `usdToRub` already includes the settings surcharge and
// is null on a full cold start (no FX rate ever cached) — in that case the ₽
// line is omitted on foreign listings and only $/AED/SAR remain.
export type FxContext = {
  usdToRub: number | null
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step
}

function line(currency: DisplayCurrency, amount: number, approximate: boolean) {
  return { currency, amount: Math.max(0, Math.round(amount)), approximate }
}

// Builds the per-direction multi-currency display set for one listing.
//
//   RF (NEW/RESALE)  → [₽]                      (stored, exact)
//   Dubai (DUBAI)    → [$, ≈AED, ≈₽]            ($ stored, locals derived)
//   Saudi (SAUDI)    → [$, ≈SAR, ≈₽]
//
// `price` ≤ 0 collapses to "on request" (no figures). The ₽ line is dropped when
// no FX rate is available; AED/SAR never depend on the CBR rate.
export function buildPriceSet(
  price: number,
  baseCurrency: Currency,
  direction: PropertyDirection,
  fx: FxContext,
): PriceSet {
  if (!Number.isFinite(price) || price <= 0) {
    return { onRequest: true, base: null, lines: [] }
  }

  // Pivot everything through USD and RUB where the rate allows.
  const usd = baseCurrency === 'USD' ? price : fx.usdToRub ? price / fx.usdToRub : null
  const rub = baseCurrency === 'RUB' ? price : fx.usdToRub != null && usd != null ? usd * fx.usdToRub : null

  if (direction === 'NEW' || direction === 'RESALE') {
    // Domestic: a single ₽ line. Exact when the price is already stored in ₽.
    const amount = rub ?? price
    const base = line('RUB', amount, baseCurrency !== 'RUB')
    return { onRequest: false, base, lines: [base] }
  }

  // Foreign: $ is the primary line; locals + ₽ are derived.
  const lines: PriceSet['lines'] = []
  const usdAmount = usd ?? price
  lines.push(line('USD', usdAmount, false))

  const peg = direction === 'DUBAI' ? { currency: 'AED' as const, rate: USD_TO_AED } : { currency: 'SAR' as const, rate: USD_TO_SAR }
  lines.push(line(peg.currency, roundTo(usdAmount * peg.rate, LOCAL_ROUND_STEP), true))

  if (rub != null) {
    lines.push(line('RUB', roundTo(rub, RUB_ROUND_STEP), true))
  }

  return { onRequest: false, base: lines[0] ?? null, lines }
}
