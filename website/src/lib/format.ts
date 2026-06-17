import type { PriceLine, PriceSet, PropertyDto } from '@dune/contracts'

import { PROPERTY_TYPES } from './directions'

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

// Normalises a complex's delivery date for display. Legacy/admin values may bake
// a "Сдача:"/"Срок сдачи:" label into the string — strip it, then append "год"
// when what remains is a bare year so the UI reads "2026 год" (not "2026" or the
// doubled "Срок сдачи: Сдача: 2026").
export function formatDelivery(raw: string): string {
  const value = raw.replace(/^\s*(?:срок\s+сдачи|сдача)\s*[:\-–—]?\s*/i, '').trim()
  return /^\d{4}$/.test(value) ? `${value} год` : value
}

// --- Type-aware listing facts ------------------------------------------------
// QuickDeal listings span apartments, houses, land and commercial units, so a
// single apartment-shaped fact list (комнатность / этаж) misrepresents a plot
// or a house. These helpers render each type with its own fields.

export type Fact = { b: string; s: string }

const LAND_USE_LABEL: Record<string, string> = {
  IZHS: 'ИЖС',
  SNT: 'СНТ',
  LPH: 'ЛПХ',
  COMMERCIAL: 'Коммерческая',
}

const COMMERCIAL_KIND_LABEL: Record<string, string> = {
  OFFICE: 'Офис',
  RETAIL: 'Торговое',
  WAREHOUSE: 'Склад',
  FOOD_SERVICE: 'Общепит',
  FREE_PURPOSE: 'Свободного назначения',
}

const UTILITY_LABEL: Record<string, string> = {
  ELECTRICITY: 'Электричество',
  GAS: 'Газ',
  WATER: 'Вода',
  SEWERAGE: 'Канализация',
}

export function landUseLabel(value: string | null): string | null {
  return value ? LAND_USE_LABEL[value] ?? null : null
}

export function commercialKindLabel(value: string | null): string | null {
  return value ? COMMERCIAL_KIND_LABEL[value] ?? null : null
}

export function utilitiesLabel(values: string[]): string | null {
  const labels = values.map((value) => UTILITY_LABEL[value]).filter((label): label is string => Boolean(label))
  return labels.length > 0 ? labels.join(', ') : null
}

export function typeLabel(type: PropertyDto['type']): string {
  return PROPERTY_TYPES.find((t) => t.value === type)?.label ?? 'Объект'
}

// Area display: plots are shown in сотки (the feed's native unit; `area` is
// stored in m², 1 сотка = 100 m²), everything else in m².
export function areaLabel(property: Pick<PropertyDto, 'type' | 'area'>): string {
  if (property.type === 'LAND') {
    const sotka = Math.round((property.area / 100) * 100) / 100
    return `${sotka.toLocaleString(RU)} сот.`
  }
  return `${property.area} м²`
}

// Ordered, type-appropriate facts for a listing. The card uses the first three;
// the property page shows all of them. A plot never reads as a "Студия" on an
// "этаж" line — it shows площадь (сотки), назначение and коммуникации instead.
export function propertyFacts(p: PropertyDto): Fact[] {
  const area: Fact = { b: areaLabel(p), s: 'площадь' }
  const kind: Fact = { b: typeLabel(p.type), s: 'тип' }

  if (p.type === 'LAND') {
    const facts: Fact[] = [area]
    const use = landUseLabel(p.landUse)
    if (use) facts.push({ b: use, s: 'назначение' })
    const utils = utilitiesLabel(p.utilities)
    if (utils) facts.push({ b: utils, s: 'коммуникации' })
    facts.push(kind)
    return facts
  }

  if (p.type === 'HOUSE' || p.type === 'TOWNHOUSE') {
    const facts: Fact[] = [area]
    if (p.rooms > 0) facts.push({ b: roomsLabel(p.rooms), s: 'комнатность' })
    if (p.totalFloors != null) facts.push({ b: `${p.totalFloors} эт.`, s: 'этажность' })
    facts.push(kind)
    return facts
  }

  if (p.type === 'COMMERCIAL') {
    const facts: Fact[] = [area]
    const ck = commercialKindLabel(p.commercialKind)
    if (ck) facts.push({ b: ck, s: 'назначение' })
    if (p.floor != null || p.totalFloors != null) {
      facts.push({ b: floorLabel(p.floor, p.totalFloors), s: 'этаж' })
    }
    facts.push(kind)
    return facts
  }

  // APARTMENT (and any future residential default).
  const last: Fact =
    p.isNewBuilding && p.delivery ? { b: p.delivery, s: 'срок сдачи' } : kind
  return [
    area,
    { b: roomsLabel(p.rooms), s: 'комнатность' },
    { b: floorLabel(p.floor, p.totalFloors), s: 'этаж' },
    last,
  ]
}
