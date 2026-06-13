import type { Country, PropertyCategory, PropertyType } from '@dune/contracts'

import { COUNTRIES, countryMeta, TYPE_OPTIONS, type TypeOption } from './directions'
import type { PropertyQuery } from './api'

// Single source of truth for catalog filters, shared by the SSR page and the
// client island. The catalog is a hierarchy: Country → City → Category → Type.
// Country is mandatory (default Россия — shows all RU listings) and keeps the
// price filter in one currency; the lower levels are optional refinements.
export const DEFAULT_COUNTRY: Country = 'RU'

export interface CatalogState {
  country: Country
  city: string | null
  category: PropertyCategory | null
  // Underlying enum + new-build flag; the type chips combine them so that
  // "Квартира в новостройке" is a distinct option from resale "Квартира".
  type: PropertyType | null
  isNewBuilding: boolean
  rooms: number | null
  minPrice: number | null
  maxPrice: number | null
  minArea: number | null
  maxArea: number | null
  installment: boolean
  premium: boolean
  sort: string
}

const COUNTRY_KEYS = COUNTRIES.map((c) => c.key)
const CATEGORY_KEYS: PropertyCategory[] = ['RESIDENTIAL', 'COMMERCIAL']
const TYPE_ENUM: PropertyType[] = ['APARTMENT', 'HOUSE', 'TOWNHOUSE', 'COMMERCIAL', 'LAND']
const SORTS = ['newest', 'price_asc', 'price_desc', 'area_asc', 'area_desc']
export const PAGE_LIMIT = 12

function num(value: string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

// The active type chip for the current (type, isNewBuilding) pair, if any.
export function typeOptionFor(state: CatalogState): TypeOption | undefined {
  if (!state.type) return undefined
  return (
    TYPE_OPTIONS.find((o) => o.type === state.type && o.isNewBuilding === state.isNewBuilding) ??
    TYPE_OPTIONS.find((o) => o.type === state.type)
  )
}

// Applies a type chip by key, toggling it off when already active.
export function applyTypeOption(state: CatalogState, key: string): void {
  const opt = TYPE_OPTIONS.find((o) => o.key === key)
  if (!opt) return
  const active = state.type === opt.type && state.isNewBuilding === opt.isNewBuilding
  if (active) {
    state.type = null
    state.isNewBuilding = false
  } else {
    state.type = opt.type
    state.isNewBuilding = opt.isNewBuilding
  }
}

export function defaultState(): CatalogState {
  return {
    country: DEFAULT_COUNTRY,
    city: null,
    category: null,
    type: null,
    isNewBuilding: false,
    rooms: null,
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    installment: false,
    premium: false,
    sort: 'newest',
  }
}

export function parseState(params: URLSearchParams): CatalogState {
  const state = defaultState()

  // Country: explicit param wins; otherwise fall back to the legacy `?dir=`
  // tokens still used by the home page, header and footer.
  const countryParam = params.get('country')
  if (countryParam && COUNTRY_KEYS.includes(countryParam as Country)) {
    state.country = countryParam as Country
  } else {
    const dir = params.get('dir')
    if (dir === 'dubai') state.country = 'AE'
    else if (dir === 'saudi') state.country = 'SA'
    else if (dir === 'new') {
      state.country = 'RU'
      state.isNewBuilding = true
    } else if (dir === 'resale') state.country = 'RU'
  }

  if (params.get('new') === '1') state.isNewBuilding = true

  // Type: accept the new chip keys and legacy enum values from the home search.
  const typeParam = params.get('type')
  if (typeParam) {
    const opt = TYPE_OPTIONS.find((o) => o.key === typeParam)
    if (opt) {
      state.type = opt.type
      state.isNewBuilding = opt.isNewBuilding || state.isNewBuilding
    } else if (TYPE_ENUM.includes(typeParam as PropertyType)) {
      state.type = typeParam as PropertyType
    }
  }

  const cat = params.get('cat')
  if (cat && CATEGORY_KEYS.includes(cat as PropertyCategory)) state.category = cat as PropertyCategory

  const city = params.get('city')
  state.city = city && city.trim() ? city.trim() : null

  state.rooms = num(params.get('rooms'))
  state.minPrice = num(params.get('minPrice'))
  const rawMax = num(params.get('maxPrice'))
  // ignore the "no limit" sentinel coming from the home search selects
  state.maxPrice = rawMax != null && rawMax < 900_000_000 ? rawMax : null
  state.minArea = num(params.get('minArea'))
  state.maxArea = num(params.get('maxArea'))
  state.installment = params.get('inst') === '1'
  state.premium = params.get('prem') === '1'
  const sort = params.get('sort') ?? 'newest'
  state.sort = SORTS.includes(sort) ? sort : 'newest'
  return state
}

export function priceCurrency(state: CatalogState): 'RUB' | 'USD' {
  return countryMeta(state.country)?.currency ?? 'RUB'
}

export function toQuery(state: CatalogState, page: number): PropertyQuery {
  const query: PropertyQuery = { sort: state.sort, page, limit: PAGE_LIMIT }
  query.country = state.country
  if (state.city) query.city = state.city
  if (state.category) query.category = state.category
  if (state.type) {
    query.type = state.type
    // For apartments, the new-build flag distinguishes resale vs новостройка,
    // so we send it explicitly (including false). For other types we omit it.
    if (state.isNewBuilding) query.isNewBuilding = true
    else if (state.type === 'APARTMENT') query.isNewBuilding = false
  } else if (state.isNewBuilding) {
    query.isNewBuilding = true
  }
  if (state.rooms != null) query.rooms = state.rooms
  if (state.minPrice != null) query.minPrice = state.minPrice
  if (state.maxPrice != null) query.maxPrice = state.maxPrice
  if (state.minArea != null) query.minArea = state.minArea
  if (state.maxArea != null) query.maxArea = state.maxArea
  // Only send positive flags; sending `false` would exclude everything else.
  if (state.installment) query.installment = true
  if (state.premium) query.premium = true
  return query
}

export function toSearch(state: CatalogState): string {
  const p = new URLSearchParams()
  if (state.country !== DEFAULT_COUNTRY) p.set('country', state.country)
  if (state.city) p.set('city', state.city)
  if (state.category) p.set('cat', state.category)
  const opt = typeOptionFor(state)
  if (opt) p.set('type', opt.key)
  else if (state.isNewBuilding) p.set('new', '1')
  if (state.rooms != null) p.set('rooms', String(state.rooms))
  if (state.minPrice != null) p.set('minPrice', String(state.minPrice))
  if (state.maxPrice != null) p.set('maxPrice', String(state.maxPrice))
  if (state.minArea != null) p.set('minArea', String(state.minArea))
  if (state.maxArea != null) p.set('maxArea', String(state.maxArea))
  if (state.installment) p.set('inst', '1')
  if (state.premium) p.set('prem', '1')
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort)
  return p.toString()
}

export interface CatalogHead {
  title: string
  titleHtml: string
  sub: string
  crumb: string
}

const HEADS: Record<Country, { title: string; sub: string }> = {
  RU: { title: 'Недвижимость в России', sub: COUNTRIES[0]!.sub },
  AE: { title: 'Недвижимость в ОАЭ', sub: COUNTRIES[1]!.sub },
  SA: { title: 'Недвижимость в Саудовской Аравии', sub: COUNTRIES[2]!.sub },
}

export function headFor(state: CatalogState): CatalogHead {
  const base = HEADS[state.country]
  const meta = countryMeta(state.country)
  const title = state.city ? `Недвижимость · ${state.city}` : base.title
  const titleHtml = title.replace(/(\S+)$/, '<b>$1</b>')
  const crumb = state.city ? `${meta?.short ?? base.title} · ${state.city}` : meta?.short ?? base.title
  return { title, titleHtml, sub: base.sub, crumb }
}

// Active filter chips for the pills row. Country is the mandatory head, so it
// has no removable pill.
export function activePills(state: CatalogState): { key: string; label: string }[] {
  const pills: { key: string; label: string }[] = []
  if (state.city) pills.push({ key: 'city', label: state.city })
  if (state.category)
    pills.push({ key: 'cat', label: state.category === 'COMMERCIAL' ? 'Коммерческая' : 'Жилая' })
  const opt = typeOptionFor(state)
  if (opt) pills.push({ key: 'type', label: opt.label })
  if (state.rooms != null)
    pills.push({
      key: 'rooms',
      label: state.rooms === 0 ? 'Студия' : state.rooms >= 4 ? '4+ комн.' : `${state.rooms} комн.`,
    })
  const cur = priceCurrency(state) === 'USD' ? '$' : '₽'
  if (state.minPrice != null) pills.push({ key: 'minPrice', label: `от ${state.minPrice.toLocaleString('ru-RU')} ${cur}` })
  if (state.maxPrice != null) pills.push({ key: 'maxPrice', label: `до ${state.maxPrice.toLocaleString('ru-RU')} ${cur}` })
  if (state.minArea != null) pills.push({ key: 'minArea', label: `от ${state.minArea} м²` })
  if (state.maxArea != null) pills.push({ key: 'maxArea', label: `до ${state.maxArea} м²` })
  if (state.installment) pills.push({ key: 'inst', label: 'Рассрочка' })
  if (state.premium) pills.push({ key: 'prem', label: 'Премиум' })
  return pills
}
