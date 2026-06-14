import type {
  CommercialKind,
  Currency,
  LandUse,
  LeadStatus,
  PropertyDirection,
  PropertyStatus,
  PropertyType,
  Utility,
} from '@dune/contracts'

// Russian labels for the admin UI. Enum values stay the wire contract; these are
// display-only and centralized so every screen renders them consistently.

export const directionLabels: Record<PropertyDirection, string> = {
  NEW: 'Новостройки РФ',
  RESALE: 'Вторичка РФ',
  DUBAI: 'Дубай',
  SAUDI: 'Саудовская Аравия',
}

export const typeLabels: Record<PropertyType, string> = {
  APARTMENT: 'Квартира',
  HOUSE: 'Дом',
  TOWNHOUSE: 'Таунхаус',
  COMMERCIAL: 'Коммерция',
  LAND: 'Участок',
}

export const statusLabels: Record<PropertyStatus, string> = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликовано',
  ARCHIVED: 'В архиве',
  SOLD: 'Продано',
}

export const currencyLabels: Record<Currency, string> = {
  RUB: '₽ Рубль',
  USD: '$ Доллар',
}

export const landUseLabels: Record<LandUse, string> = {
  IZHS: 'ИЖС',
  SNT: 'СНТ',
  LPH: 'ЛПХ',
  COMMERCIAL: 'Коммерческое',
}

export const commercialKindLabels: Record<CommercialKind, string> = {
  OFFICE: 'Офис',
  RETAIL: 'Торговое',
  WAREHOUSE: 'Склад',
  FOOD_SERVICE: 'Общепит',
  FREE_PURPOSE: 'Свободного назначения',
}

export const utilityLabels: Record<Utility, string> = {
  ELECTRICITY: 'Электричество',
  GAS: 'Газ',
  WATER: 'Вода',
  SEWERAGE: 'Канализация',
}

export const leadStatusLabels: Record<LeadStatus, string> = {
  NEW: 'Новая',
  IN_PROGRESS: 'В работе',
  DONE: 'Завершена',
  SPAM: 'Спам',
}

export const leadStatusBadge: Record<LeadStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NEW: 'default',
  IN_PROGRESS: 'secondary',
  DONE: 'outline',
  SPAM: 'destructive',
}

export const statusBadge: Record<PropertyStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  DRAFT: 'outline',
  PUBLISHED: 'default',
  ARCHIVED: 'secondary',
  SOLD: 'destructive',
}

export const directions: PropertyDirection[] = ['NEW', 'RESALE', 'DUBAI', 'SAUDI']
export const propertyTypes: PropertyType[] = ['APARTMENT', 'HOUSE', 'TOWNHOUSE', 'COMMERCIAL', 'LAND']
export const propertyStatuses: PropertyStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SOLD']
export const currencies: Currency[] = ['RUB', 'USD']
export const landUses: LandUse[] = ['IZHS', 'SNT', 'LPH', 'COMMERCIAL']
export const commercialKinds: CommercialKind[] = ['OFFICE', 'RETAIL', 'WAREHOUSE', 'FOOD_SERVICE', 'FREE_PURPOSE']
export const utilities: Utility[] = ['ELECTRICITY', 'GAS', 'WATER', 'SEWERAGE']
export const leadStatuses: LeadStatus[] = ['NEW', 'IN_PROGRESS', 'DONE', 'SPAM']

// RF directions price in RUB; foreign directions price in USD. Used to default
// and constrain the currency field so admins don't mismatch direction & money.
export function defaultCurrencyForDirection(direction: PropertyDirection): Currency {
  return direction === 'DUBAI' || direction === 'SAUDI' ? 'USD' : 'RUB'
}
