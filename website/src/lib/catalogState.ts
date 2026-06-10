import type { PropertyType } from '@dune/contracts'

import { metaByKey, PROPERTY_TYPES, type DirectionKey } from './directions'
import type { PropertyQuery } from './api'

// Single source of truth for catalog filters, shared by the SSR page and the
// client island. Direction and rooms are single-select to match the Этап 2 API
// contract (one direction, one rooms value per query).
export interface CatalogState {
  dir: DirectionKey | null
  type: PropertyType | null
  rooms: number | null
  minPrice: number | null
  maxPrice: number | null
  minArea: number | null
  maxArea: number | null
  installment: boolean
  premium: boolean
  isNewBuilding: boolean
  sort: string
}

const DIR_KEYS: DirectionKey[] = ['new', 'resale', 'dubai', 'saudi']
const TYPE_VALUES = PROPERTY_TYPES.map((t) => t.value)
const SORTS = ['newest', 'price_asc', 'price_desc', 'area_asc', 'area_desc']
export const PAGE_LIMIT = 12

function num(value: string | null): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

export function parseState(params: URLSearchParams): CatalogState {
  const dir = params.get('dir')
  const type = params.get('type')
  const sort = params.get('sort') ?? 'newest'
  const rawMax = num(params.get('maxPrice'))
  return {
    dir: dir && DIR_KEYS.includes(dir as DirectionKey) ? (dir as DirectionKey) : null,
    type: type && TYPE_VALUES.includes(type as PropertyType) ? (type as PropertyType) : null,
    rooms: num(params.get('rooms')),
    minPrice: num(params.get('minPrice')),
    // ignore the "no limit" sentinel coming from the home search selects
    maxPrice: rawMax != null && rawMax < 900_000_000 ? rawMax : null,
    minArea: num(params.get('minArea')),
    maxArea: num(params.get('maxArea')),
    installment: params.get('inst') === '1',
    premium: params.get('prem') === '1',
    isNewBuilding: params.get('new') === '1',
    sort: SORTS.includes(sort) ? sort : 'newest',
  }
}

// Price filter is meaningful only inside a direction (its currency). Outside a
// selected direction the numeric price filter is hidden/ignored (§14 default).
export function priceEnabled(state: CatalogState): boolean {
  return state.dir != null
}

export function priceCurrency(state: CatalogState): 'RUB' | 'USD' | null {
  return state.dir ? (metaByKey(state.dir)?.currency ?? null) : null
}

export function toQuery(state: CatalogState, page: number): PropertyQuery {
  const meta = state.dir ? metaByKey(state.dir) : undefined
  const query: PropertyQuery = { sort: state.sort, page, limit: PAGE_LIMIT }
  if (meta) query.direction = meta.direction
  if (state.type) query.type = state.type
  if (state.rooms != null) query.rooms = state.rooms
  if (priceEnabled(state)) {
    if (state.minPrice != null) query.minPrice = state.minPrice
    if (state.maxPrice != null) query.maxPrice = state.maxPrice
  }
  if (state.minArea != null) query.minArea = state.minArea
  if (state.maxArea != null) query.maxArea = state.maxArea
  // Only send positive flags; sending `false` would exclude everything else.
  if (state.installment) query.installment = true
  if (state.premium) query.premium = true
  if (state.isNewBuilding) query.isNewBuilding = true
  return query
}

export function toSearch(state: CatalogState): string {
  const p = new URLSearchParams()
  if (state.dir) p.set('dir', state.dir)
  if (state.type) p.set('type', state.type)
  if (state.rooms != null) p.set('rooms', String(state.rooms))
  if (priceEnabled(state)) {
    if (state.minPrice != null) p.set('minPrice', String(state.minPrice))
    if (state.maxPrice != null) p.set('maxPrice', String(state.maxPrice))
  }
  if (state.minArea != null) p.set('minArea', String(state.minArea))
  if (state.maxArea != null) p.set('maxArea', String(state.maxArea))
  if (state.installment) p.set('inst', '1')
  if (state.premium) p.set('prem', '1')
  if (state.isNewBuilding) p.set('new', '1')
  if (state.sort && state.sort !== 'newest') p.set('sort', state.sort)
  return p.toString()
}

export interface CatalogHead {
  title: string
  titleHtml: string
  sub: string
  crumb: string
}

const SUBS: Record<DirectionKey, string> = {
  new: 'Квартиры от застройщиков Грозного с рассрочкой 0% от застройщика.',
  resale: 'Проверенные квартиры и дома с юридическим сопровождением сделки.',
  dubai: 'Инвестиционные апартаменты и виллы в ОАЭ с планом оплаты и доходностью.',
  saudi: 'Недвижимость в Эр-Рияде и Джидде на фоне программы Vision 2030.',
}

export function headFor(state: CatalogState): CatalogHead {
  if (state.dir) {
    const meta = metaByKey(state.dir)
    const label = meta?.label ?? 'Каталог'
    const titleHtml = label.replace(/(\S+)$/, '<b>$1</b>')
    return { title: label, titleHtml, sub: SUBS[state.dir], crumb: label }
  }
  return {
    title: 'Каталог недвижимости',
    titleHtml: 'Каталог <b>недвижимости</b>',
    sub: 'Новостройки, вторичка и зарубежные инвестиции — в одной базе DUNE.',
    crumb: 'Все объекты',
  }
}

// Active filter chips (for the pills row). `key` is used to remove the filter.
export function activePills(state: CatalogState): { key: string; label: string }[] {
  const pills: { key: string; label: string }[] = []
  if (state.dir) pills.push({ key: 'dir', label: metaByKey(state.dir)?.label ?? state.dir })
  if (state.type) {
    const t = PROPERTY_TYPES.find((x) => x.value === state.type)
    pills.push({ key: 'type', label: t?.label ?? state.type })
  }
  if (state.rooms != null)
    pills.push({ key: 'rooms', label: state.rooms === 0 ? 'Студия' : state.rooms >= 4 ? '4+ комн.' : `${state.rooms} комн.` })
  const cur = priceCurrency(state) === 'USD' ? '$' : '₽'
  if (priceEnabled(state) && state.minPrice != null) pills.push({ key: 'minPrice', label: `от ${state.minPrice.toLocaleString('ru-RU')} ${cur}` })
  if (priceEnabled(state) && state.maxPrice != null) pills.push({ key: 'maxPrice', label: `до ${state.maxPrice.toLocaleString('ru-RU')} ${cur}` })
  if (state.minArea != null) pills.push({ key: 'minArea', label: `от ${state.minArea} м²` })
  if (state.maxArea != null) pills.push({ key: 'maxArea', label: `до ${state.maxArea} м²` })
  if (state.installment) pills.push({ key: 'inst', label: 'Рассрочка' })
  if (state.premium) pills.push({ key: 'prem', label: 'Премиум' })
  if (state.isNewBuilding) pills.push({ key: 'new', label: 'Новостройки' })
  return pills
}
