import type {
  CommercialKind,
  Currency,
  LandUse,
  PropertyDirection,
  PropertyType,
  Utility,
} from '@dune/contracts'

import { child, children, textAt, type XmlNode } from './xml'

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

// QuickDeal `building/projectStatus` values that mark a primary/under-construction
// project. "readySecondary" (the common resale value) intentionally matches none.
const NEW_PROJECT_STATUS = /new|building|primary|unfinished|construction/i

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

// Land/garden areas come in sotka or hectare; the catalog stores and renders
// area in m² (the feed's own pricePerSquareMeter is computed against m²).
function areaToSquareMeters(value: number, unit: string | undefined): number {
  switch ((unit ?? '').toLowerCase()) {
    case 'sotka':
    case 'are':
      return value * 100
    case 'hectare':
      return value * 10_000
    default:
      return value
  }
}

// Maps the QuickDeal lifecycle status to the catalog status, or null for states
// that should not appear at all (draft/deferred/archived in the CRM). Objects
// that drop out of the feed are archived separately by the importer.
function mapStatus(status: string | undefined): 'PUBLISHED' | 'SOLD' | null {
  switch ((status ?? '').toLowerCase()) {
    case 'active':
      return 'PUBLISHED'
    case 'sold':
    case 'completed':
      return 'SOLD'
    default:
      return null
  }
}

export function mapDirection(
  countryIso: string | undefined,
  realtyType: string,
  projectStatus: string | undefined,
): PropertyDirection | null {
  const iso = (countryIso ?? '').toUpperCase()
  if (iso === 'AE') return 'DUBAI'
  if (iso === 'SA') return 'SAUDI'
  if (iso === 'RU' || iso === '') {
    const isNew = /new/i.test(realtyType) || NEW_PROJECT_STATUS.test(projectStatus ?? '')
    return isNew ? 'NEW' : 'RESALE'
  }
  // Other foreign listings have no direction bucket on this site yet.
  return null
}

const COMMERCIAL_REALTY = /office|retail|warehouse|commerc|business|production|garage|freeappointment|building/i

export function mapType(realtyType: string): PropertyType {
  const rt = realtyType.toLowerCase()
  if (rt.includes('land')) return COMMERCIAL_REALTY.test(rt) ? 'COMMERCIAL' : 'LAND'
  if (rt.includes('townhouse')) return 'TOWNHOUSE'
  if (rt.includes('house') || rt.includes('cottage')) return 'HOUSE'
  if (COMMERCIAL_REALTY.test(rt)) return 'COMMERCIAL'
  // Default residential bucket (flat, room, apartments, studio).
  return 'APARTMENT'
}

const LAND_USE_MAP: Record<string, LandUse> = {
  individualhousingconstruction: 'IZHS',
  izhs: 'IZHS',
  gardening: 'SNT',
  snt: 'SNT',
  personalsubsidiary: 'LPH',
  privatefarm: 'LPH',
  lph: 'LPH',
  commercial: 'COMMERCIAL',
  industrial: 'COMMERCIAL',
}

const COMMERCIAL_KIND_MAP: Record<string, CommercialKind> = {
  office: 'OFFICE',
  retail: 'RETAIL',
  shopping: 'RETAIL',
  warehouse: 'WAREHOUSE',
  production: 'WAREHOUSE',
  food: 'FOOD_SERVICE',
  freeappointment: 'FREE_PURPOSE',
  freepurpose: 'FREE_PURPOSE',
}

function matchFrom<T>(text: string | undefined, map: Record<string, T>): T | null {
  if (!text) return null
  const lower = text.toLowerCase()
  for (const [needle, mapped] of Object.entries(map)) {
    if (lower.includes(needle)) return mapped
  }
  return null
}

// Only objects flagged for the company site and not hidden are importable.
export function isImportable(object: XmlNode): boolean {
  const sendToSite = textAt(object, 'feedSettings', 'isSendToCompanySite') === 'true'
  const hidden = textAt(object, 'isHidden') === 'true'
  return sendToSite && !hidden
}

function collectPhotos(object: XmlNode): string[] {
  const sources = children(child(object, 'images'), 'src')
  const urls = sources
    .map((src) => ({ url: textAt(src, 'name'), isDefault: textAt(src, 'default') === 'true' }))
    .filter((item): item is { url: string; isDefault: boolean } => Boolean(item.url))
  // Lead photo (default) first; keep feed order otherwise.
  urls.sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
  return [...new Set(urls.map((item) => item.url))]
}

function managerName(assigned: XmlNode | undefined): string | null {
  const name = [textAt(assigned, 'firstName'), textAt(assigned, 'lastName')].filter(Boolean).join(' ').trim()
  return name || null
}

function fallbackTitle(type: PropertyType, rooms: number, area: number): string {
  const size = area > 0 ? `, ${area} м²` : ''
  switch (type) {
    case 'LAND':
      return `Земельный участок${size}`
    case 'HOUSE':
      return `Дом${size}`
    case 'TOWNHOUSE':
      return `Таунхаус${size}`
    case 'COMMERCIAL':
      return `Коммерческое помещение${size}`
    default:
      return rooms > 0 ? `${rooms}-комн. квартира${size}` : `Квартира${size}`
  }
}

// Maps one <estate-object> node to the feed-owned listing fields, or null when
// it lacks an id, a resolvable direction, or an importable status.
export function mapListing(object: XmlNode): MappedListing | null {
  const externalId = (textAt(object, 'feedId') ?? textAt(object, 'id'))?.trim()
  if (!externalId) return null

  const status = mapStatus(textAt(object, 'status'))
  if (!status) return null

  const countryIso = textAt(object, 'address', 'countryIsoCode')
  const realtyType = (textAt(object, 'realtyType') ?? '').toLowerCase()
  const projectStatus = textAt(object, 'building', 'projectStatus')

  const direction = mapDirection(countryIso, realtyType, projectStatus)
  if (!direction) return null

  const type = mapType(realtyType)
  const foreign = direction === 'DUBAI' || direction === 'SAUDI'

  // Foreign → USD standardizedPrice; domestic → ₽ price. Missing/zero stays 0
  // and surfaces as "Цена по запросу".
  const price = foreign
    ? toInt(textAt(object, 'bargainTerms', 'standardizedPrice')) ?? 0
    : toInt(textAt(object, 'bargainTerms', 'price')) ?? 0
  const currency: Currency = foreign ? 'USD' : 'RUB'

  const rooms = Math.max(0, toInt(textAt(object, 'realty', 'roomsCount')) ?? 0)

  const landValue = toNumber(textAt(object, 'realty', 'land', 'area', 'value'))
  const area =
    type === 'LAND' && landValue != null
      ? Math.round(areaToSquareMeters(landValue, textAt(object, 'realty', 'land', 'area', 'unit')))
      : Math.max(0, toInt(textAt(object, 'realty', 'totalArea', 'value')) ?? 0)

  const sale = child(child(object, 'bargainTerms'), 'sale')
  const paymentMethods = children(sale, 'paymentMethods').map((node) => node.text.toLowerCase())
  const installment = paymentMethods.some((method) => method.includes('installment'))

  const assigned = child(object, 'assigned')

  const utilities: Utility[] = []
  if (type === 'LAND') {
    if (textAt(object, 'realty', 'waterType')) utilities.push('WATER')
    if (textAt(object, 'realty', 'sewerageType')) utilities.push('SEWERAGE')
    if (textAt(object, 'realty', 'gasType') || textAt(object, 'building', 'hasGas') === 'true') utilities.push('GAS')
    if (textAt(object, 'realty', 'electricityType') || textAt(object, 'realty', 'powerType')) {
      utilities.push('ELECTRICITY')
    }
  }

  return {
    externalId,
    source: 'QUICKDEAL',
    externalSource: 'quickDeal',
    direction,
    type,
    status,
    title: textAt(object, 'title') ?? fallbackTitle(type, rooms, area),
    rooms,
    area,
    floor: toInt(textAt(object, 'realty', 'floorNumber')),
    totalFloors: toInt(textAt(object, 'building', 'floorsCount')),
    complex: textAt(object, 'developmentHouse', 'name') ?? textAt(object, 'developmentBuilding', 'name') ?? null,
    city:
      textAt(object, 'address', 'city') ??
      textAt(object, 'address', 'settlement') ??
      textAt(object, 'address', 'region') ??
      '—',
    district: textAt(object, 'address', 'district') ?? textAt(object, 'address', 'area') ?? null,
    price,
    currency,
    installment,
    isNewBuilding: direction === 'NEW' || NEW_PROJECT_STATUS.test(projectStatus ?? ''),
    delivery: textAt(object, 'building', 'usageStartYear') ?? null,
    photos: collectPhotos(object),
    lat: toNumber(textAt(object, 'geoLat') ?? textAt(object, 'address', 'geoLat')),
    lng: toNumber(textAt(object, 'geoLon') ?? textAt(object, 'address', 'geoLon')),
    landUse: type === 'LAND' ? matchFrom(textAt(object, 'realty', 'land', 'permittedLandUseType'), LAND_USE_MAP) : null,
    utilities: [...new Set(utilities)],
    commercialKind: type === 'COMMERCIAL' ? matchFrom(realtyType, COMMERCIAL_KIND_MAP) : null,
    managerName: managerName(assigned),
    managerPhone: textAt(assigned, 'mobilePhone') ?? null,
    managerPhotoUrl: textAt(assigned, 'photo') ?? null,
  }
}
