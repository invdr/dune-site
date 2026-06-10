import type {
  CommercialKind,
  Currency,
  LandUse,
  PropertyDirection,
  PropertyType,
  Utility,
} from '@dune/contracts'

// Shape of one object in the QuickDeal native feed (`format=quickDeal`). The
// live schema is not yet available (§14 — feed secret/samples pending), so this
// is a tolerant, best-effort view of the documented fields. Everything is
// optional; the mapper degrades gracefully and the importer publishes what it
// can (per the product decision). Adjust this type against real samples when
// they arrive — it is the single point of coupling to the feed.
export type QuickDealFeedObject = {
  feedId?: string
  isSendToCompanySite?: boolean
  export?: string
  countryIsoCode?: string
  // Object kind/view as named in QuickDeal (e.g. "Квартира в новостройке").
  objectType?: string
  objectView?: string
  status?: string
  rooms?: number | string
  area?: number | string
  floor?: number | string
  totalFloors?: number | string
  title?: string
  complex?: string
  city?: string
  district?: string
  // Foreign listings carry a USD `standardizedPrice`; RU listings a ₽ `price`.
  standardizedPrice?: number | string
  price?: number | string
  lat?: number | string
  lng?: number | string
  photos?: string[]
  installment?: boolean
  delivery?: string
  landUse?: string
  utilities?: string[]
  commercialKind?: string
  assigned?: { name?: string; phone?: string; photo?: string } | null
}

// Feed-owned fields written on every sync. The site layer (slug, badges,
// premium, placeholderTone, curated selections) is never part of this.
export type MappedListing = {
  externalId: string
  source: 'QUICKDEAL'
  externalSource: string
  direction: PropertyDirection
  type: PropertyType
  status: 'PUBLISHED' | 'SOLD'
  title: string
  rooms: number
  area: number
  floor: number | null
  totalFloors: number | null
  complex: string | null
  city: string
  district: string | null
  price: number
  currency: Currency
  installment: boolean
  isNewBuilding: boolean
  delivery: string | null
  photos: string[]
  lat: number | null
  lng: number | null
  landUse: LandUse | null
  utilities: Utility[]
  commercialKind: CommercialKind | null
  managerName: string | null
  managerPhone: string | null
  managerPhotoUrl: string | null
}

const NEW_BUILDING_HINT = /новостро|new build/i
const TOWNHOUSE_HINT = /таунхаус|townhouse/i
const HOUSE_HINT = /дом|коттедж|house|cottage|villa/i
const LAND_HINT = /участок|земл|land|plot/i
const COMMERCIAL_HINT = /коммерц|commercial|офис|office|магазин|retail|склад|warehouse/i

const LAND_USE_MAP: Record<string, LandUse> = {
  ижс: 'IZHS',
  izhs: 'IZHS',
  снт: 'SNT',
  snt: 'SNT',
  лпх: 'LPH',
  lph: 'LPH',
  коммерческая: 'COMMERCIAL',
  commercial: 'COMMERCIAL',
}

const COMMERCIAL_KIND_MAP: Record<string, CommercialKind> = {
  офис: 'OFFICE',
  office: 'OFFICE',
  магазин: 'RETAIL',
  ритейл: 'RETAIL',
  retail: 'RETAIL',
  склад: 'WAREHOUSE',
  warehouse: 'WAREHOUSE',
  общепит: 'FOOD_SERVICE',
  food: 'FOOD_SERVICE',
  свободного: 'FREE_PURPOSE',
  free: 'FREE_PURPOSE',
}

const UTILITY_MAP: Record<string, Utility> = {
  электр: 'ELECTRICITY',
  electric: 'ELECTRICITY',
  газ: 'GAS',
  gas: 'GAS',
  вода: 'WATER',
  water: 'WATER',
  канализ: 'SEWERAGE',
  sewer: 'SEWERAGE',
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

function transliterate(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((char) => (char in TRANSLIT ? TRANSLIT[char] : char))
    .join('')
}

// Stable, URL-safe slug from a title plus a short externalId suffix for
// uniqueness. Generated once per listing; the importer freezes it afterwards.
export function slugFromListing(title: string, externalId: string): string {
  const base = transliterate(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  const suffix = externalId.replace(/[^a-zA-Z0-9]+/g, '').slice(-6).toLowerCase() || 'qd'
  const head = base.length >= 2 ? base : 'obj'
  return `${head}-${suffix}`
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function toInt(value: unknown): number | null {
  const parsed = toNumber(value)
  return parsed == null ? null : Math.round(parsed)
}

function matchFrom<T>(text: string | undefined, map: Record<string, T>): T | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [needle, mapped] of Object.entries(map)) {
    if (lower.includes(needle)) return mapped
  }
  return null
}

export function mapDirection(country: string | undefined, kindText: string): PropertyDirection | null {
  const iso = (country ?? '').toUpperCase()
  if (iso === 'AE') return 'DUBAI'
  if (iso === 'SA') return 'SAUDI'
  if (iso === 'RU' || iso === '') {
    return NEW_BUILDING_HINT.test(kindText) ? 'NEW' : 'RESALE'
  }
  return null
}

export function mapType(kindText: string): PropertyType {
  if (LAND_HINT.test(kindText)) return 'LAND'
  if (COMMERCIAL_HINT.test(kindText)) return 'COMMERCIAL'
  if (TOWNHOUSE_HINT.test(kindText)) return 'TOWNHOUSE'
  if (HOUSE_HINT.test(kindText)) return 'HOUSE'
  // Default residential bucket; studios are rooms=0, not a type.
  return 'APARTMENT'
}

// Only objects flagged for the company site are importable (§ "Решения").
export function isImportable(object: QuickDealFeedObject): boolean {
  return object.isSendToCompanySite === true || object.export === 'companySite'
}

// Maps one feed object to the feed-owned listing fields, or null when it is too
// empty to publish (no id, title, or resolvable direction).
export function mapListing(object: QuickDealFeedObject): MappedListing | null {
  const externalId = object.feedId?.trim()
  const title = object.title?.trim()
  if (!externalId || !title) return null

  const kindText = `${object.objectType ?? ''} ${object.objectView ?? ''}`.trim()
  const direction = mapDirection(object.countryIsoCode, kindText)
  if (!direction) return null

  const type = mapType(kindText)
  const foreign = direction === 'DUBAI' || direction === 'SAUDI'

  // Foreign → USD standardizedPrice; domestic → ₽ price. Missing/zero stays 0
  // and surfaces as "Цена по запросу".
  const price = foreign
    ? toInt(object.standardizedPrice) ?? toInt(object.price) ?? 0
    : toInt(object.price) ?? 0
  const currency: Currency = foreign ? 'USD' : 'RUB'

  const photos = (object.photos ?? []).filter((url): url is string => typeof url === 'string' && url.length > 0)

  return {
    externalId,
    source: 'QUICKDEAL',
    externalSource: 'quickDeal',
    direction,
    type,
    status: (object.status ?? '').toLowerCase() === 'sold' ? 'SOLD' : 'PUBLISHED',
    title,
    rooms: Math.max(0, toInt(object.rooms) ?? 0),
    area: Math.max(0, toInt(object.area) ?? 0),
    floor: toInt(object.floor),
    totalFloors: toInt(object.totalFloors),
    complex: object.complex?.trim() || null,
    city: object.city?.trim() || '—',
    district: object.district?.trim() || null,
    price,
    currency,
    installment: object.installment === true,
    isNewBuilding: direction === 'NEW' || NEW_BUILDING_HINT.test(kindText),
    delivery: object.delivery?.trim() || null,
    photos,
    lat: toNumber(object.lat),
    lng: toNumber(object.lng),
    landUse: type === 'LAND' ? matchFrom(object.landUse, LAND_USE_MAP) : null,
    utilities:
      type === 'LAND'
        ? [...new Set((object.utilities ?? []).map((u) => matchFrom(u, UTILITY_MAP)).filter((u): u is Utility => u != null))]
        : [],
    commercialKind: type === 'COMMERCIAL' ? matchFrom(object.commercialKind, COMMERCIAL_KIND_MAP) : null,
    managerName: object.assigned?.name?.trim() || null,
    managerPhone: object.assigned?.phone?.trim() || null,
    managerPhotoUrl: object.assigned?.photo?.trim() || null,
  }
}
