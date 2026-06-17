import type { ComplexDto } from '@dune/contracts'

import { metaByDirection } from './directions'
import { escapeHtml, formatDelivery, formatRub } from './format'
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

// Branded placeholder tone: honour an explicit site-layer tone, else fall back
// to the direction's default. Shared by the card and the ЖК detail gallery.
export function resolvePlaceholderTone(c: Pick<ComplexDto, 'placeholderTone' | 'direction'>): '' | 'ink' | 'sand' {
  if (c.placeholderTone === 'ink' || c.placeholderTone === 'sand' || c.placeholderTone === '') {
    return c.placeholderTone
  }
  return metaByDirection(c.direction).tone
}

// Catalog headline: "от X ₽/м²" when known, else the entry total, else a prompt.
export function complexHeadline(c: ComplexDto): string {
  if (c.pricePerMeterFrom != null) return `от ${formatRub(c.pricePerMeterFrom)}/м²`
  if (c.priceFrom != null) return `от ${formatRub(c.priceFrom)}`
  return 'Цена по запросу'
}

// A ЖК is favourited under a namespaced id (`zhk:<slug>`) so the shared local
// favourites store can hold complexes and apartments side by side without slug
// collisions; the favourites page splits them back by this prefix.
export function complexFavoriteId(slug: string): string {
  return `zhk:${slug}`
}

export interface ComplexCardOptions {
  favorite?: boolean
}

// Single source of truth for a ЖК card's markup (catalog grid + favourites).
export function complexCardHtml(c: ComplexDto, opts: ComplexCardOptions = {}): string {
  const meta = metaByDirection(c.direction)

  const favId = escapeHtml(complexFavoriteId(c.slug))
  // "Планировки" signals that the freshly-imported floor-plan block exists on
  // the detail page — a concrete reason to open the ЖК.
  const planTag = c.floorPlans.length > 0 ? '<span class="tag tag--sand">Планировки</span>' : ''

  const media = phHtml({
    kind: meta.ph,
    tone: resolvePlaceholderTone(c),
    sun: c.direction === 'DUBAI' || c.direction === 'SAUDI',
    photo: c.photos[0] ?? null,
    extraClass: 'card__media',
    overlay:
      `<div class="card__tags">${badgeTags(c)}${planTag}</div>` +
      `<button class="card__fav${opts.favorite ? ' is-on' : ''}" type="button" data-fav="${favId}" ` +
      `aria-label="В избранное" aria-pressed="${opts.favorite ? 'true' : 'false'}">${ICONS.heart}</button>` +
      `<div class="card__price-badge">${escapeHtml(complexHeadline(c))}</div>`,
  })

  const facts: { b: string; s: string }[] = []
  if (c.areaFrom != null) facts.push({ b: `от ${c.areaFrom} м²`, s: 'площадь' })
  if (c.unitCount > 0) facts.push({ b: String(c.unitCount), s: 'в продаже' })
  if (c.delivery) facts.push({ b: formatDelivery(c.delivery), s: 'сдача' })
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
