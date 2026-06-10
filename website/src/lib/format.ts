import type { PriceLine, PriceSet, PropertyDto } from '@dune/contracts'

// Pure presentation helpers shared by server (Astro frontmatter) and client
// islands. No DOM access — safe to import anywhere.

const RU = 'ru-RU'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function roomsLabel(rooms: number): string {
  return rooms === 0 ? 'Студия' : `${rooms}-комн.`
}

export function floorLabel(floor: number | null, totalFloors: number | null): string {
  if (floor != null && totalFloors != null) return `${floor} / ${totalFloors}`
  if (floor != null) return String(floor)
  if (totalFloors != null) return `${totalFloors} эт.`
  return '—'
}

// Money line → display string. `≈` prefixes every derived/approximate line
// (RUB equivalent, AED/SAR). USD/RUB carry their symbol; AED/SAR are suffixed.
export function formatLine(line: PriceLine): string {
  const n = line.amount.toLocaleString(RU)
  const approx = line.approximate ? '≈ ' : ''
  switch (line.currency) {
    case 'USD':
      return `${approx}$ ${n}`
    case 'RUB':
      return `${approx}${n} ₽`
    case 'AED':
      return `${approx}${n} AED`
    case 'SAR':
      return `${approx}${n} SAR`
  }
}

// Primary price for a card/badge. `onRequest` (price 0/unset) → "Цена по запросу".
export function mainPrice(pricing: PriceSet | null): string {
  if (!pricing || pricing.onRequest || !pricing.base) return 'Цена по запросу'
  return formatLine(pricing.base)
}

// Secondary display lines (everything after the base) for the detail price card.
export function secondaryLines(pricing: PriceSet | null): string[] {
  if (!pricing || pricing.onRequest || !pricing.base) return []
  return pricing.lines.filter((l) => l.currency !== pricing.base!.currency).map(formatLine)
}

// "≈ 120 000 ₽/м²" — per-square price from the RUB equivalent when available,
// else from the base line. Returns null when there is no usable figure.
export function perMeter(property: PropertyDto): string | null {
  const pricing = property.pricing
  if (!pricing || pricing.onRequest || !property.area) return null
  const rub = pricing.lines.find((l) => l.currency === 'RUB')
  const line = rub ?? pricing.base
  if (!line) return null
  const value = Math.round(line.amount / property.area).toLocaleString(RU)
  const approx = line.currency === 'RUB' || line.approximate ? '≈ ' : ''
  const unit = line.currency === 'RUB' ? '₽' : line.currency === 'USD' ? '$' : line.currency
  return line.currency === 'USD' ? `${approx}$ ${value}/м²` : `${approx}${value} ${unit}/м²`
}

export function formatRub(amount: number): string {
  return `${Math.round(amount).toLocaleString(RU)} ₽`
}
