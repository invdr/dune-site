import type { Country, PropertyDirection, PropertyType } from '@dune/contracts'

// Direction metadata shared by the home page, catalog and property card. Keyed
// by the lowercase URL token used across the prototype (`?dir=new`), mapped to
// the canonical `PropertyDirection` enum the API speaks.
export type DirectionKey = 'new' | 'resale' | 'dubai' | 'saudi'

export interface DirectionMeta {
  key: DirectionKey
  direction: PropertyDirection
  label: string
  short: string
  sub: string
  /** placeholder silhouette kind (see placeholders.ts) */
  ph: string
  /** placeholder duotone variant */
  tone: '' | 'ink' | 'sand'
  /** display currency the catalog price filter uses for this direction */
  currency: 'RUB' | 'USD'
  /** default city used by the home search city control */
  city: string
}

export const DIRECTIONS: DirectionMeta[] = [
  { key: 'new', direction: 'NEW', label: 'Новостройки', short: 'Новостройки', sub: 'Грозный и Чеченская Республика', ph: 'grozny', tone: '', currency: 'RUB', city: 'Грозный' },
  { key: 'resale', direction: 'RESALE', label: 'Вторичка', short: 'Вторичка', sub: 'Проверенные квартиры и дома', ph: 'city', tone: 'ink', currency: 'RUB', city: 'Грозный' },
  { key: 'dubai', direction: 'DUBAI', label: 'Дубай', short: 'Дубай', sub: 'ОАЭ, доход и резиденция', ph: 'dubai', tone: '', currency: 'USD', city: 'Дубай' },
  { key: 'saudi', direction: 'SAUDI', label: 'Саудовская Аравия', short: 'KSA', sub: 'Эр-Рияд, Джидда, инвестиции', ph: 'riyadh', tone: 'sand', currency: 'USD', city: 'Эр-Рияд' },
]

const BY_KEY = new Map<string, DirectionMeta>(DIRECTIONS.map((d) => [d.key, d]))
const BY_DIRECTION = new Map<PropertyDirection, DirectionMeta>(DIRECTIONS.map((d) => [d.direction, d]))

export function metaByKey(key: string | null | undefined): DirectionMeta | undefined {
  return key ? BY_KEY.get(key) : undefined
}

export function metaByDirection(direction: PropertyDirection): DirectionMeta {
  // Every enum value is represented above, so this is always defined.
  return BY_DIRECTION.get(direction) as DirectionMeta
}

export function dirLabel(direction: PropertyDirection): string {
  return metaByDirection(direction).label
}

// Property type chips shown in the catalog. Mirrors the finalized QuickDeal set
// (§ "Типы объектов"): no STUDIO/VILLA/PENTHOUSE.
export const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'APARTMENT', label: 'Квартира' },
  { value: 'HOUSE', label: 'Дом' },
  { value: 'TOWNHOUSE', label: 'Таунхаус' },
  { value: 'COMMERCIAL', label: 'Коммерция' },
  { value: 'LAND', label: 'Участок' },
]

// Top level of the catalog hierarchy (Country → City → Category → Type).
// `currency` drives the price filter; RU prices are ₽, the Gulf markets are $.
export interface CountryMeta {
  key: Country
  label: string
  short: string
  currency: 'RUB' | 'USD'
  sub: string
}

export const COUNTRIES: CountryMeta[] = [
  { key: 'RU', label: 'Россия', short: 'Россия', currency: 'RUB', sub: 'Новостройки и вторичка в Грозном, Гудермесе и по всей Чеченской Республике.' },
  { key: 'AE', label: 'ОАЭ', short: 'ОАЭ', currency: 'USD', sub: 'Инвестиционные апартаменты и виллы в Дубае — план оплаты и доходность.' },
  { key: 'SA', label: 'Саудовская Аравия', short: 'KSA', currency: 'USD', sub: 'Эр-Рияд и Джидда на фоне программы Vision 2030.' },
]

const COUNTRY_BY_KEY = new Map<string, CountryMeta>(COUNTRIES.map((c) => [c.key, c]))

export function countryMeta(key: string | null | undefined): CountryMeta | undefined {
  return key ? COUNTRY_BY_KEY.get(key) : undefined
}

// Catalog type chips. New-build apartments are a distinct chip backed by
// type=APARTMENT + isNewBuilding=true; plain "Квартира" means resale.
export interface TypeOption {
  key: string
  label: string
  type: PropertyType
  isNewBuilding: boolean
}

export const TYPE_OPTIONS: TypeOption[] = [
  { key: 'apartment', label: 'Квартира', type: 'APARTMENT', isNewBuilding: false },
  { key: 'apartment_new', label: 'Квартира в новостройке', type: 'APARTMENT', isNewBuilding: true },
  { key: 'house', label: 'Дом', type: 'HOUSE', isNewBuilding: false },
  { key: 'townhouse', label: 'Таунхаус', type: 'TOWNHOUSE', isNewBuilding: false },
  { key: 'commercial', label: 'Коммерция', type: 'COMMERCIAL', isNewBuilding: false },
  { key: 'land', label: 'Участок', type: 'LAND', isNewBuilding: false },
]
