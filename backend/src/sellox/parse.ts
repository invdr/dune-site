// Pure parsing for the one-time sellox.ru → Complex migration.
//
// sellox.ru is a WordPress/Elementor real-estate site with no feed or REST
// endpoint, so the only source is the public HTML of each ЖК page. Everything
// here is deliberately string-based and side-effect free: `import.ts` does the
// fetching and database writes, this module just turns raw markup into a
// structured, review-ready draft. Extraction favours precision over coverage —
// a missing field is left null for an admin to fill, never guessed.

import type { Country, Currency, PropertyAttribute, PropertyDirection } from '@dune/contracts'

export type ParsedComplex = {
  slug: string
  name: string
  city: string
  country: Country
  direction: PropertyDirection
  currency: Currency
  description: string | null
  delivery: string | null
  photos: string[]
  floorPlans: string[]
  features: string[]
  attributes: PropertyAttribute[]
  badges: string[]
  priceFrom: number | null
  areaFrom: number | null
  address: string | null
  lat: number | null
  lng: number | null
}

// --- sitemap -----------------------------------------------------------------

// Returns the property page URLs from property-sitemap.xml, in document order.
export function parseSitemap(xml: string): string[] {
  const urls: string[] = []
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = decodeEntities(match[1]).trim()
    if (/\/property\/[^/]+\/?$/.test(url)) urls.push(url)
  }
  return urls
}

// --- single listing ----------------------------------------------------------

export function parseListing(html: string, url: string): ParsedComplex {
  const slug = slugFromUrl(url)
  // Drop scripts/styles once; every text-based extractor reuses this.
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // The page ends with a "related listings" widget linking to *other* /property/
  // slugs. Cut there so prices, areas and photos come only from this complex.
  const main = mainRegion(clean, slug)

  const haystack = `${metaContent(html, 'og:title') ?? ''} ${metaContent(html, 'og:description') ?? ''} ${main}`
  const geo = detectGeography(haystack)
  const media = extractMedia(html, main)
  const point = extractGeoPoint(html)

  return {
    slug,
    name: extractName(html, slug),
    city: geo.city,
    country: geo.country,
    direction: geo.direction,
    currency: geo.currency,
    description: extractDescription(html, main),
    delivery: extractDelivery(main),
    photos: media.photos,
    floorPlans: media.floorPlans,
    features: extractFeatures(main),
    attributes: extractAttributes(main),
    badges: /рассроч/i.test(main) ? ['Рассрочка'] : [],
    priceFrom: extractPriceFrom(main),
    areaFrom: extractAreaFrom(main),
    address: point.address,
    lat: point.lat,
    lng: point.lng,
  }
}

// --- field extractors --------------------------------------------------------

function slugFromUrl(url: string): string {
  const path = url.replace(/[?#].*$/, '').replace(/\/+$/, '')
  return path.slice(path.lastIndexOf('/') + 1).toLowerCase()
}

// Everything up to the first link to a *different* /property/ page. That widget
// is where sellox lists similar complexes, and its prices/photos are not ours.
function mainRegion(html: string, slug: string): string {
  let cut = html.length
  for (const m of html.matchAll(/\/property\/([a-z0-9-]+)\/?["'/]/gi)) {
    if (m[1].toLowerCase() !== slug && m.index! < cut) {
      cut = m.index!
      break
    }
  }
  return html.slice(0, cut)
}

// Complex name: the breadcrumb's last crumb is the cleanest ("ЖК Престиж"),
// falling back to the <title>/og:title with the site suffix stripped.
function extractName(html: string, slug: string): string {
  const crumbs = [...html.matchAll(/"ListItem","position":\d+,"name":"([^"]+)"/g)].map((m) => decodeEntities(m[1]))
  const last = crumbs.at(-1)?.trim()
  if (last && last.length >= 2) return clampName(last)

  const title = metaContent(html, 'og:title') ?? matchOne(html, /<title>([^<]*)<\/title>/i)
  if (title) return clampName(decodeEntities(title).split('|')[0].trim())

  return clampName(slug.replace(/-/g, ' '))
}

function clampName(value: string): string {
  const trimmed = value.trim().slice(0, 200)
  return trimmed.length >= 2 ? trimmed : 'ЖК'
}

// Prefer the long marketing copy from the body (the real description), falling
// back to the og:description summary. Body text is recovered by stripping tags
// and keeping the substantial paragraphs, which on these pages are the
// description blocks rather than nav/labels.
function extractDescription(html: string, main: string): string | null {
  const paragraphs = textChunks(main).filter((t) => t.length >= 120)
  const seen = new Set<string>()
  const unique = paragraphs.filter((p) => (seen.has(p) ? false : (seen.add(p), true)))
  if (unique.length > 0) return unique.join('\n\n').slice(0, 8000)

  const og = metaContent(html, 'og:description')
  return og ? decodeEntities(og).trim().slice(0, 8000) || null : null
}

// "от 68 000 ₽/м²" → 68000. The per-m² headline is what Complex.priceFrom
// stores (it surfaces as the "от X ₽/м²" line), so a plain ₽ total is only a
// fallback when no per-m² figure is present.
function extractPriceFrom(main: string): number | null {
  const text = decodeEntities(main)
  const perMeter = text.match(/([\d][\d\s.,]*)\s*(?:₽|руб[а-я.]*)\s*\/?\s*(?:м²|кв\.?\s*м)/i)
  // Fallbacks: a ruble total, then a foreign ($/USD/AED) total for Dubai stock.
  const total =
    perMeter ??
    text.match(/от\s*([\d][\d\s.,]*)\s*(?:₽|руб[а-я.]*)/i) ??
    text.match(/от\s*([\d][\d\s.,]*)\s*(?:\$|usd|aed|дирхам[а-я]*)/i)
  if (!total) return null
  const digits = total[1].replace(/[\s.,]/g, '')
  const value = Number.parseInt(digits, 10)
  return Number.isFinite(value) && value > 0 && value <= 2_000_000_000 ? value : null
}

// "от 47 м²" / "от 47,20 м²" → 47 (integer part).
function extractAreaFrom(main: string): number | null {
  const text = decodeEntities(main)
  const m = text.match(/от\s*(\d+)(?:[.,]\d+)?\s*(?:м²|кв\.?\s*м)/i)
  if (!m) return null
  const value = Number.parseInt(m[1], 10)
  return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? value : null
}

// "Год сдачи: 2026" / "Срок сдачи — IV кв. 2026" → a short, safe label. Only a
// year or a "<quarter> кв. <year>" form is accepted so adjacent cells (e.g. a
// following "Этажность") can't leak into the value.
function extractDelivery(main: string): string | null {
  const text = decodeEntities(stripTags(main))
  const m = text.match(/(?:год|срок)\s*сдачи\s*[:\-–—]?\s*((?:[IVX]+|\d)\s*кв\.?\s*)?(20\d{2})/i)
  if (!m) return null
  const quarter = m[1]?.trim().replace(/\s+/g, ' ')
  return `Сдача: ${quarter ? `${quarter} ` : ''}${m[2]}`
}

// Listing media: uploads under sellox.ru, minus the theme chrome (logo,
// favicons, agent avatar, decorative icons), de-duplicated across WordPress
// size variants and canonicalised to percent-encoded URLs. Floor-plan images
// (filenames like "Типовой-план-этажей") are split into their own list so the
// site can show a dedicated "Планировки" block.
const PHOTO_DENYLIST = ['sellox', 'favicon', 'android-chrome', 'agent-', 'group-', 'x1-', 'x2-', 'logo', 'placeholder']
const FLOOR_PLAN_HINT = /план|planirov|layout/i

function extractMedia(html: string, main: string): { photos: string[]; floorPlans: string[] } {
  const photos: string[] = []
  const floorPlans: string[] = []
  const seen = new Set<string>()

  const add = (raw: string, allowPlan = true) => {
    // Match the denylist against the file name only — the domain "sellox.ru"
    // would otherwise reject every URL.
    const file = decodeURIComponent(raw.slice(raw.lastIndexOf('/') + 1)).toLowerCase()
    if (PHOTO_DENYLIST.some((bad) => file.includes(bad))) return
    const canonical = canonicalPhoto(raw)
    if (!canonical) return
    const key = canonical.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    if (allowPlan && FLOOR_PLAN_HINT.test(file)) floorPlans.push(canonical)
    else photos.push(canonical)
  }

  // The hero (og:image) is always a photo, never reclassified as a plan.
  const primary = metaContent(html, 'og:image')
  if (primary) add(decodeEntities(primary), false)
  for (const m of main.matchAll(/https?:\/\/sellox\.ru\/wp-content\/uploads\/[^\s"'<>)]+\.(?:webp|jpe?g|png)/gi)) {
    add(m[0])
  }
  return { photos: photos.slice(0, 60), floorPlans: floorPlans.slice(0, 60) }
}

// Strip the WordPress `-1170x785` size suffix so variants of one photo collapse
// to a single canonical, percent-encoded URL.
function canonicalPhoto(raw: string): string | null {
  const deSized = raw.replace(/-\d+x\d+(\.(?:webp|jpe?g|png))$/i, '$1')
  try {
    return new URL(deSized).toString()
  } catch {
    return null
  }
}

// The "Особенности" list — Houzez renders each as a link into the /feature/
// taxonomy, so the anchor text is the authoritative, full feature list.
function extractFeatures(main: string): string[] {
  const seen = new Set<string>()
  const features: string[] = []
  for (const m of main.matchAll(/<a[^>]*href="[^"]*\/feature\/[^"]*"[^>]*>([^<]+)<\/a>/gi)) {
    const label = decodeEntities(m[1]).replace(/\s+/g, ' ').trim()
    const key = label.toLowerCase()
    if (!label || label.length > 120 || seen.has(key)) continue
    seen.add(key)
    features.push(label)
  }
  // Fallback for pages that don't use the feature taxonomy: a keyword scan.
  if (features.length === 0) return amenityKeywords(main)
  // Contract caps the list at 20 items.
  return features.slice(0, 20)
}

// High-precision amenity scan, used only when no /feature/ links are present.
const AMENITIES: Array<{ label: string; test: RegExp }> = [
  { label: 'Бассейн', test: /бассейн/i },
  { label: 'Фитнес-центр', test: /фитнес/i },
  { label: 'Хаммам', test: /хаммам/i },
  { label: 'Подземный паркинг', test: /паркинг|подземн\w*\s+(?:паркинг|парковк)/i },
  { label: 'Детская площадка', test: /детск\w*\s+(?:площад|игров)/i },
  { label: 'Лифт', test: /лифт/i },
  { label: 'Охраняемая территория', test: /охран/i },
  { label: 'Видеонаблюдение', test: /видеонаблюд/i },
  { label: 'Коммерческие помещения', test: /коммерческ\w*\s+(?:зон|помещ|площад)/i },
]

function amenityKeywords(main: string): string[] {
  const text = decodeEntities(stripTags(main))
  return AMENITIES.filter((a) => a.test.test(text)).map((a) => a.label).slice(0, 20)
}

// The "Характеристики" table — Houzez renders it as
// `<li><strong>Label:</strong> <span>Value</span></li>` inside the first
// `.detail-wrap` list. Returns display-ready {label, value} pairs in page order.
function extractAttributes(main: string): PropertyAttribute[] {
  const block = main.match(/<div class="detail-wrap">[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i)
  if (!block) return []

  const attributes: PropertyAttribute[] = []
  for (const m of block[1].matchAll(/<li[^>]*>\s*<strong>([\s\S]*?)<\/strong>([\s\S]*?)<\/li>/gi)) {
    const label = decodeEntities(stripTags(m[1])).replace(/\s+/g, ' ').replace(/:\s*$/, '').trim()
    const value = decodeEntities(stripTags(m[2])).replace(/\s+/g, ' ').trim()
    if (!label || !value || label.length > 120 || value.length > 200) continue
    attributes.push({ label, value })
  }
  return attributes.slice(0, 30)
}

// --- geography ---------------------------------------------------------------

// Cyrillic stem → canonical (nominative) Russian city name. First match wins.
const RU_CITIES: Array<{ canonical: string; test: RegExp }> = [
  { canonical: 'Краснодар', test: /краснодар/i },
  { canonical: 'Каспийск', test: /каспийск/i },
  { canonical: 'Махачкала', test: /махачкал/i },
  { canonical: 'Гудермес', test: /гудермес/i },
  { canonical: 'Аргун', test: /аргун/i },
  { canonical: 'Грозный', test: /грозн/i },
]

// "Дубай"/"в Дубае"/"Dubai" but not the adjective "дубайск(ий/ие)" — a complex
// named in Dubai *style* still sits in Russia.
const DUBAI_MENTION = /дубай(?![а-яё])|дубае(?![а-яё])|dubai/i
const FOREIGN_MONEY = /\$|usd|aed|дирхам/i
const RUBLE_MONEY = /₽|руб[а-я.]*/i

type Geography = { city: string; country: Country; direction: PropertyDirection; currency: Currency }

// Currency drives country/direction: sellox prices in ₽ are Russian listings
// regardless of any Dubai reference in the copy. A Dubai listing is recognised
// only when it actually quotes a foreign currency, so the single Dubai-themed
// ruble complex is correctly treated as Russian (admin fixes the exact city).
function detectGeography(haystack: string): Geography {
  const text = decodeEntities(haystack)
  const isDubai = DUBAI_MENTION.test(text) && FOREIGN_MONEY.test(text) && !RUBLE_MONEY.test(text)
  if (isDubai) return { city: 'Дубай', country: 'AE', direction: 'DUBAI', currency: 'USD' }

  for (const city of RU_CITIES) {
    if (city.test.test(text)) return { city: city.canonical, country: 'RU', direction: 'NEW', currency: 'RUB' }
  }
  // Sitemap is overwhelmingly Grozny; default keeps the required city field
  // populated and is trivially correctable in admin for the rare exception.
  return { city: 'Грозный', country: 'RU', direction: 'NEW', currency: 'RUB' }
}

// Map marker emitted by Houzez (`"address":"…","lat":"…","lng":"…"`). The single
// property page carries exactly one marker — its own — so address and a precise
// point come for free, enough to drop a pin on the "Расположение" map.
function extractGeoPoint(html: string): { address: string | null; lat: number | null; lng: number | null } {
  const m = html.match(/"address":"((?:[^"\\]|\\.)*)","lat":"(-?\d+(?:\.\d+)?)","lng":"(-?\d+(?:\.\d+)?)"/)
  if (!m) return { address: null, lat: null, lng: null }

  let address: string | null = null
  try {
    const decoded = (JSON.parse(`"${m[1]}"`) as string).replace(/\s+/g, ' ').trim()
    address = decoded.length > 0 ? decoded.slice(0, 240) : null
  } catch {
    address = null
  }

  const lat = Number.parseFloat(m[2])
  const lng = Number.parseFloat(m[3])
  // Reject the (0,0) placeholder and any out-of-range pair.
  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)
  return { address, lat: valid ? lat : null, lng: valid ? lng : null }
}

// --- small html helpers ------------------------------------------------------

function metaContent(html: string, property: string): string | null {
  const esc = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return (
    matchOne(html, new RegExp(`<meta[^>]+property=["']${esc}["'][^>]+content=["']([^"']*)["']`, 'i')) ??
    matchOne(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${esc}["']`, 'i'))
  )
}

function matchOne(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m ? m[1] : null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
}

// Visible text chunks (between tags), entity-decoded and whitespace-collapsed.
function textChunks(html: string): string[] {
  return html
    .split(/<[^>]+>/)
    .map((chunk) => decodeEntities(chunk).replace(/\s+/g, ' ').trim())
    .filter((chunk) => chunk.length > 0)
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»',
  mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', deg: '°',
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole)
}

function safeCodePoint(code: number): string {
  try {
    return String.fromCodePoint(code)
  } catch {
    return ''
  }
}
