import type { PropertyDto } from '@dune/contracts'

import { metaByDirection } from './directions'
import { escapeHtml, mainPrice, propertyFacts } from './format'
import { ICONS } from './icons'
import { phHtml } from './placeholder'

// Resolve the placeholder silhouette/tone/sun for a listing. Houses and
// townhouses use the "villa" silhouette regardless of direction; the duotone
// tone honours an explicit site-layer `placeholderTone` first.
export function placeholderFor(p: PropertyDto): { kind: string; tone: '' | 'ink' | 'sand'; sun: boolean } {
  const meta = metaByDirection(p.direction)
  const isVilla = p.type === 'HOUSE' || p.type === 'TOWNHOUSE'
  const kind = isVilla ? 'villa' : meta.ph
  const explicit = p.placeholderTone
  const tone: '' | 'ink' | 'sand' =
    explicit === 'ink' || explicit === 'sand' || explicit === ''
      ? explicit
      : isVilla
        ? 'sand'
        : meta.tone
  const sun = p.direction === 'DUBAI' || p.direction === 'SAUDI'
  return { kind, tone, sun }
}

// Up to three badge chips. First reads as the headline (bordo), the rest sand —
// mirrors the prototype's two-tone tag treatment.
function badgeTags(p: PropertyDto): string {
  return p.badges
    .slice(0, 3)
    .map((b, i) => `<span class="tag tag--${i === 0 ? 'bordo' : 'sand'}">${escapeHtml(b)}</span>`)
    .join('')
}

export interface CardOptions {
  favorite?: boolean
  eager?: boolean
}

// Single source of truth for a listing card's markup (home featured, catalog
// grid, similar). The favourite button carries `data-fav` so the favourites
// island can toggle/persist it via event delegation.
export function cardHtml(p: PropertyDto, opts: CardOptions = {}): string {
  const ph = placeholderFor(p)
  const media = phHtml({
    kind: ph.kind,
    tone: ph.tone,
    sun: ph.sun,
    photo: p.photos[0] ?? null,
    eager: opts.eager,
    extraClass: 'card__media',
    overlay:
      `<div class="card__tags">${badgeTags(p)}</div>` +
      `<button class="card__fav${opts.favorite ? ' is-on' : ''}" type="button" data-fav="${escapeHtml(
        p.slug,
      )}" aria-label="В избранное" aria-pressed="${opts.favorite ? 'true' : 'false'}">${ICONS.heart}</button>` +
      `<div class="card__price-badge">${escapeHtml(mainPrice(p.pricing))}</div>`,
  })

  const metaCells = propertyFacts(p)
    .slice(0, 3)
    .map((f) => `<div><b>${escapeHtml(f.b)}</b><span>${escapeHtml(f.s)}</span></div>`)
    .join('')

  const loc = [p.district, p.city].filter(Boolean).map((s) => escapeHtml(String(s))).join(', ')
  const complex = p.complex ? `<div class="card__complex">${escapeHtml(p.complex)}</div>` : ''

  return (
    `<a class="card fade-up" href="/property/${escapeHtml(p.slug)}">` +
    media +
    '<div class="card__body">' +
    `<div class="card__title">${escapeHtml(p.title)}</div>` +
    complex +
    `<div class="card__loc">${ICONS.pin}<span>${loc}</span></div>` +
    '<div class="card__meta">' +
    metaCells +
    '</div>' +
    '</div>' +
    '</a>'
  )
}
