import type { PropertyAttribute, PropertyType } from '@dune/contracts'

import { child, children, textAt, type XmlNode } from './xml'

// Builds the type-specific "Характеристики" list shown on the property page,
// translated to Russian and display-ready. Only fields actually present in the
// feed are emitted; unknown enum tokens are skipped rather than shown raw.

const DECORATION: Record<string, string> = {
  finished: 'Чистовая',
  fine: 'Чистовая',
  preFine: 'Предчистовая',
  rough: 'Черновая',
  without: 'Без отделки',
}
const REPAIR: Record<string, string> = {
  cosmetic: 'Косметический',
  euro: 'Евроремонт',
  design: 'Дизайнерский',
  major: 'Капитальный',
  without: 'Без ремонта',
}
const MATERIAL: Record<string, string> = {
  monolith: 'Монолит',
  monolithBrick: 'Монолит-кирпич',
  brick: 'Кирпич',
  panel: 'Панель',
  block: 'Блочный',
  aerocreteBlock: 'Газоблок',
  foamConcreteBlock: 'Пеноблок',
  wood: 'Дерево',
  wireframe: 'Каркасный',
}
const PARKING: Record<string, string> = {
  multilevel: 'Многоуровневая',
  underground: 'Подземная',
  ground: 'Наземная',
  open: 'Открытая',
  openBordered: 'Открытая огороженная',
  closed: 'Закрытая',
}
const HEATING: Record<string, string> = { autonomous: 'Автономное', central: 'Центральное' }
const VIEW: Record<string, string> = {
  sea: 'Море',
  lake: 'Озеро',
  embankment: 'Набережная',
  river: 'Река',
  city: 'Город',
  yard: 'Двор',
  street: 'Улица',
  yardAndStreet: 'Во двор и на улицу',
  mountains: 'Горы',
  park: 'Парк',
}
const LAYOUT: Record<string, string> = {
  openSpace: 'Open space',
  open: 'Открытая',
  cabinet: 'Кабинетная',
  mixed: 'Смешанная',
  improve: 'Улучшенная',
  isolated: 'Изолированная',
  adjacent: 'Смежная',
}
const LAND_USE: Record<string, string> = {
  individualHousingConstruction: 'ИЖС',
  gardening: 'СНТ',
  personalSubsidiary: 'ЛПХ',
  privateFarm: 'ЛПХ',
  commercial: 'Коммерческая',
  industrial: 'Промышленная',
}
const LAND_STATUS: Record<string, string> = {
  settlements: 'Земли населённых пунктов',
  agricultural: 'Сельхозназначения',
  industrial: 'Земли промышленности',
}
const FURNISHED: Record<string, string> = {
  furnished: 'С мебелью',
  unfurnished: 'Без мебели',
  partly: 'Частично',
}
const BUILDING_TYPE: Record<string, string> = {
  businessCenter: 'Бизнес-центр',
  shoppingCenter: 'Торговый центр',
  mall: 'Торговый центр',
  warehouse: 'Складской комплекс',
  standalone: 'Отдельностоящее здание',
  residential: 'Жилое здание',
}
const BUILDING_CLASS: Record<string, string> = {
  aPlus: 'A+',
  a: 'A',
  bPlus: 'B+',
  b: 'B',
  c: 'C',
}
const NEW_STATE: Record<string, string> = { handOver: 'Сдан', built: 'Построен', unfinished: 'Строится' }
const QUARTER: Record<string, string> = { first: 'I', second: 'II', third: 'III', fourth: 'IV' }

function present(value: string | undefined): boolean {
  if (value == null) return false
  return !['no', 'none', 'false', 'absent', ''].includes(value.trim().toLowerCase())
}

class AttrList {
  private readonly out: PropertyAttribute[] = []

  text(label: string, value: string | undefined) {
    if (value && value.trim()) this.out.push({ label, value: value.trim() })
  }

  num(label: string, value: string | undefined, unit = '') {
    const n = value == null ? NaN : Number.parseFloat(value.replace(',', '.'))
    if (Number.isFinite(n) && n > 0) this.out.push({ label, value: unit ? `${n} ${unit}` : String(n) })
  }

  mapped(label: string, value: string | undefined, dict: Record<string, string>) {
    if (value && dict[value.trim()]) this.out.push({ label, value: dict[value.trim()]! })
  }

  raw(label: string, value: string) {
    this.out.push({ label, value })
  }

  list(): PropertyAttribute[] {
    return this.out
  }
}

// "8 сот." / "1.2 га" / "55 м²" from an <area><value/><unit/></area> node.
function areaText(node: XmlNode | undefined): string | undefined {
  const value = textAt(node, 'value')
  if (!value) return undefined
  const unit = (textAt(node, 'unit') ?? '').toLowerCase()
  const suffix = unit === 'sotka' ? 'сот.' : unit === 'hectare' ? 'га' : unit === 'are' ? 'а' : 'м²'
  return `${Number.parseFloat(value.replace(',', '.'))} ${suffix}`
}

function wcText(realty: XmlNode | undefined): string | undefined {
  const combined = Number(textAt(realty, 'combinedWcsCount') ?? 0)
  const separate = Number(textAt(realty, 'separateWcsCount') ?? 0)
  const total = Number(textAt(realty, 'wcsCount') ?? 0)
  const parts: string[] = []
  if (combined > 0) parts.push(`${combined} совм.`)
  if (separate > 0) parts.push(`${separate} разд.`)
  if (parts.length === 0 && total > 0) parts.push(String(total))
  return parts.length ? parts.join(', ') : undefined
}

// Joined "Электричество, Газ, Вода, Канализация" from a realty/building node.
function utilitiesText(object: XmlNode, realty: XmlNode | undefined, building: XmlNode | undefined): string | undefined {
  const additional = child(realty, 'additional')
  const parts: string[] = []
  if (
    textAt(additional, 'hasElectricity') === 'true' ||
    present(textAt(realty, 'electricityType')) ||
    present(textAt(realty, 'powerType'))
  )
    parts.push('Электричество')
  if (
    present(textAt(realty, 'gasType')) ||
    textAt(building, 'hasGas') === 'true' ||
    textAt(additional, 'hasGas') === 'true'
  )
    parts.push('Газ')
  if (present(textAt(realty, 'waterType'))) parts.push('Вода')
  if (present(textAt(realty, 'drainageType')) || present(textAt(realty, 'sewerageType'))) parts.push('Канализация')
  return parts.length ? parts.join(', ') : undefined
}

const FLAT_AMENITIES: [string, string][] = [
  ['hasFurniture', 'Мебель'],
  ['hasConditioner', 'Кондиционер'],
  ['hasAppliances', 'Бытовая техника'],
  ['hasInternet', 'Интернет'],
  ['hasWiFi', 'Wi-Fi'],
  ['hasPanoramicWindows', 'Панорамные окна'],
]
const HOUSE_AMENITIES: [string, string][] = [
  ['hasGarage', 'Гараж'],
  ['hasPool', 'Бассейн'],
  ['hasSauna', 'Сауна'],
  ['hasBathhouse', 'Баня'],
  ['hasTerrace', 'Терраса'],
  ['hasCellar', 'Погреб'],
  ['hasFurniture', 'Мебель'],
  ['hasConditioner', 'Кондиционер'],
]

function amenitiesText(realty: XmlNode | undefined, flags: [string, string][]): string | undefined {
  const additional = child(realty, 'additional')
  const labels = flags.filter(([key]) => textAt(additional, key) === 'true').map(([, label]) => label)
  return labels.length ? labels.join(', ') : undefined
}

export function buildAttributes(object: XmlNode, type: PropertyType): PropertyAttribute[] {
  const a = new AttrList()
  const realty = child(object, 'realty')
  const building = child(object, 'building')

  if (type === 'LAND') {
    const land = child(realty, 'land')
    a.text('Площадь участка', areaText(child(land, 'area')))
    a.mapped('Категория земли', textAt(land, 'permittedLandUseType'), LAND_USE)
    a.mapped('Статус земли', textAt(land, 'status'), LAND_STATUS)
    a.num('Расстояние до города', textAt(land, 'distanceToCity', 'value'), 'км')
    a.text('Коммуникации', utilitiesText(object, realty, building))
    a.text('Кадастровый номер', textAt(object, 'cadastralNumber'))
    return a.list()
  }

  if (type === 'HOUSE' || type === 'TOWNHOUSE') {
    a.num('Площадь дома', textAt(realty, 'totalArea', 'value'), 'м²')
    a.num('Комнат', textAt(realty, 'roomsCount'))
    a.num('Спален', textAt(realty, 'bedroomsCount'))
    a.num('Этажей', textAt(building, 'floorsCount'))
    a.text('Участок', areaText(child(child(realty, 'land'), 'area')))
    a.mapped('Материал', textAt(building, 'materialType'), MATERIAL)
    a.num('Год постройки', textAt(building, 'buildYear') ?? textAt(building, 'usageStartYear'))
    a.mapped('Отопление', textAt(building, 'heatingType'), HEATING)
    a.mapped('Ремонт', textAt(realty, 'repairType'), REPAIR)
    a.text('Коммуникации', utilitiesText(object, realty, building))
    a.text('Удобства', amenitiesText(realty, HOUSE_AMENITIES))
    return a.list()
  }

  if (type === 'COMMERCIAL') {
    a.num('Площадь', textAt(realty, 'totalArea', 'value'), 'м²')
    if (textAt(object, 'bargainTerms', 'sale', 'priceType') === 'squareMeter') {
      a.num('Цена за м²', textAt(object, 'bargainTerms', 'pricePerSquareMeter'), '₽')
    }
    a.mapped('Планировка', textAt(realty, 'layout'), LAYOUT)
    const floor = textAt(realty, 'floorNumber')
    const floors = textAt(building, 'floorsCount')
    if (floor) a.raw('Этаж', floors ? `${floor} из ${floors}` : floor)
    a.num('Входов', textAt(realty, 'entranceCount'))
    a.num('Высота потолков', textAt(building, 'ceilingHeight', 'value'), 'м')
    a.mapped('Класс здания', textAt(building, 'classType'), BUILDING_CLASS)
    a.mapped('Тип здания', textAt(building, 'type'), BUILDING_TYPE)
    a.mapped('Парковка', textAt(building, 'parking', 'type'), PARKING)
    return a.list()
  }

  // APARTMENT (resale and new build).
  a.num('Общая площадь', textAt(realty, 'totalArea', 'value'), 'м²')
  a.num('Жилая площадь', textAt(realty, 'livingArea', 'value'), 'м²')
  a.num('Площадь кухни', textAt(realty, 'kitchenArea', 'value'), 'м²')
  a.num('Комнат', textAt(realty, 'roomsCount'))
  const floor = textAt(realty, 'floorNumber')
  const floors = textAt(building, 'floorsCount')
  if (floor) a.raw('Этаж', floors ? `${floor} из ${floors}` : floor)
  a.text('Санузел', wcText(realty))
  a.mapped('Планировка', textAt(realty, 'flatLayout'), LAYOUT)
  a.mapped('Отделка', textAt(realty, 'decoration'), DECORATION)
  a.mapped('Ремонт', textAt(realty, 'repairType'), REPAIR)
  a.mapped('Вид из окон', textAt(realty, 'windowsViewType'), VIEW)
  a.mapped('Меблировка', textAt(realty, 'furnishedType'), FURNISHED)

  // New-build specifics.
  const isNew = textAt(object, 'realtyType')?.toLowerCase().includes('new') || child(building, 'new') != null
  if (isNew) {
    a.text('ЖК', textAt(object, 'developmentBuilding', 'name'))
    a.text('Корпус', textAt(object, 'developmentHouse', 'name'))
    const quarter = QUARTER[textAt(building, 'new', 'deadLineQuarter') ?? '']
    const year = textAt(building, 'new', 'deadLineYear') ?? textAt(building, 'usageStartYear')
    if (year) a.raw('Срок сдачи', quarter ? `${quarter} кв. ${year}` : String(year))
    a.mapped('Статус', textAt(building, 'new', 'state'), NEW_STATE)
  } else {
    a.num('Год постройки', textAt(building, 'buildYear') ?? textAt(building, 'usageStartYear'))
  }

  a.mapped('Материал дома', textAt(building, 'materialType'), MATERIAL)
  a.num('Высота потолков', textAt(building, 'ceilingHeight', 'value'), 'м')
  a.mapped('Парковка', textAt(building, 'parkingType'), PARKING)
  a.text('Удобства', amenitiesText(realty, FLAT_AMENITIES))
  return a.list()
}
