import type { ComplexDto } from '@dune/contracts'

import { metaByDirection } from './directions'
import { escapeHtml, formatRub } from './format'
import { ICONS } from './icons'
import { phHtml } from './placeholder'

// Up to three badge chips; "Рекомендуем" leads for featured complexes.
function badgeTags(c: ComplexDto): string {
  const badges = c.premium ? ['Рекомендуем', ...c.badges] : c.badges
  return badges
    .slice(0, 3)
    .map((b, i) => `<span class="tag tag--${i === 0 ? 'bordo' : 'sand'}">${escapeHtml(b)}</span>`)
    .join('')
}

// Catalog headline: "от X ₽/м²" when known, else the entry total, else a prompt.
export function complexHeadline(c: ComplexDto): string {
  if (c.pricePerMeterFrom != null) return `от ${formatRub(c.pricePerMeterFrom)}/м²`
  if (c.priceFrom != null) return `от ${formatRub(c.priceFrom)}`
  return 'Цена по запросу'
}

// Single source of truth for a ЖК card's markup (catalog grid + related rows).
export function complexCardHtml(c: ComplexDto): string {
  const meta = metaByDirection(c.direction)
  const tone =
    c.placeholderTone === 'ink' || c.placeholderTone === 'sand' || c.placeholderTone === ''
      ? c.placeholderTone
      : meta.tone

  const media = phHtml({
    kind: meta.ph,
    tone,
    sun: c.direction === 'DUBAI' || c.direction === 'SAUDI',
    photo: c.photos[0] ?? null,
    extraClass: 'card__media',
    overlay:
      `<div class="card__tags">${badgeTags(c)}</div>` +
      `<div class="card__price-badge">${escapeHtml(complexHeadline(c))}</div>`,
  })

  const facts: { b: string; s: string }[] = []
  if (c.areaFrom != null) facts.push({ b: `от ${c.areaFrom} м²`, s: 'площадь' })
  if (c.unitCount > 0) facts.push({ b: String(c.unitCount), s: 'в продаже' })
  if (c.delivery) facts.push({ b: c.delivery, s: 'сдача' })
  const metaCells = facts
    .slice(0, 3)
    .map((f) => `<div><b>${escapeHtml(f.b)}</b><span>${escapeHtml(f.s)}</span></div>`)
    .join('')

  const loc = [c.district, c.city].filter(Boolean).map((s) => escapeHtml(String(s))).join(', ')
  const sub = c.developer ? `<div class="card__complex">${escapeHtml(c.developer)}</div>` : ''

  return (
    `<a class="card fade-up" href="/zhk/${escapeHtml(c.slug)}">` +
    media +
    '<div class="card__body">' +
    `<div class="card__title">${escapeHtml(c.name)}</div>` +
    sub +
    `<div class="card__loc">${ICONS.pin}<span>${loc}</span></div>` +
    (metaCells ? `<div class="card__meta">${metaCells}</div>` : '') +
    '</div>' +
    '</a>'
  )
}
