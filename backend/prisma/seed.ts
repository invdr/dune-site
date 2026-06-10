/**
 * Seeds the DUNE demo catalogue ported from `design-reference/.../js/data.js`.
 *
 * Idempotent: every listing is upserted by its slug, so re-running keeps a
 * single copy and refreshes the content. Run with `bun prisma/seed.ts` or
 * `bun run --cwd backend prisma:seed` against a migrated database.
 */
import { createPrisma } from '../src/db'
import type {
  CommercialKind,
  Currency,
  LandUse,
  PropertyDirection,
  PropertySource,
  PropertyType,
} from '../src/generated/prisma/client'

type SeedProperty = {
  slug: string
  direction: PropertyDirection
  type: PropertyType
  title: string
  rooms: number
  area: number
  floor: number | null
  totalFloors: number | null
  complex: string
  city: string
  district: string
  price: number
  currency: Currency
  premium: boolean
  installment: boolean
  isNewBuilding: boolean
  delivery: string | null
  placeholderTone: string
  badges: string[]
  features: string[]
  // Defaults applied in the seed loop when omitted (SITE-authored demo rows).
  source?: PropertySource
  lat?: number | null
  lng?: number | null
  landUse?: LandUse | null
  commercialKind?: CommercialKind | null
  utilities?: string[]
}

const properties: SeedProperty[] = [
  // ---------- Новостройки (Грозный) ----------
  {
    slug: 'gz-01',
    direction: 'NEW',
    type: 'APARTMENT',
    title: '2-комн. квартира, 64 м²',
    rooms: 2,
    area: 64,
    floor: 7,
    totalFloors: 16,
    complex: 'ЖК «Грозный Сити»',
    city: 'Грозный',
    district: 'Ленинский р-н',
    price: 7_680_000,
    currency: 'RUB',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: '',
    badges: ['Новостройка', 'Рассрочка 0%'],
    features: ['Панорамные окна', 'Чистовая отделка', 'Подземный паркинг', 'Видеонаблюдение'],
  },
  {
    slug: 'gz-02',
    direction: 'NEW',
    type: 'APARTMENT',
    title: 'Студия, 32 м²',
    rooms: 0,
    area: 32,
    floor: 4,
    totalFloors: 12,
    complex: 'ЖК «Беркат»',
    city: 'Грозный',
    district: 'Октябрьский р-н',
    price: 3_990_000,
    currency: 'RUB',
    premium: false,
    installment: true,
    isNewBuilding: true,
    delivery: 'IV кв. 2026',
    placeholderTone: '',
    badges: ['Новостройка', 'Рассрочка'],
    features: ['Свободная планировка', 'Газоблок', 'Двор без машин'],
  },
  {
    slug: 'gz-03',
    direction: 'NEW',
    type: 'APARTMENT',
    title: '3-комн. квартира, 92 м²',
    rooms: 3,
    area: 92,
    floor: 11,
    totalFloors: 18,
    complex: 'ЖК «Ахмат Тауэр Резиденс»',
    city: 'Грозный',
    district: 'Центр',
    price: 13_340_000,
    currency: 'RUB',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: '',
    badges: ['Премиум', 'Рассрочка 0%'],
    features: ['Вид на проспект', 'Дизайнерский холл', '2 санузла', 'Консьерж 24/7'],
  },
  {
    slug: 'gz-04',
    direction: 'NEW',
    type: 'APARTMENT',
    title: '1-комн. квартира, 44 м²',
    rooms: 1,
    area: 44,
    floor: 6,
    totalFloors: 14,
    complex: 'ЖК «Феникс»',
    city: 'Грозный',
    district: 'Заводской р-н',
    price: 5_280_000,
    currency: 'RUB',
    premium: false,
    installment: true,
    isNewBuilding: true,
    delivery: 'II кв. 2027',
    placeholderTone: '',
    badges: ['Новостройка', 'Рассрочка'],
    features: ['Кладовая', 'Кухня-гостиная', 'Закрытый двор'],
  },
  // ---------- Вторичка ----------
  {
    slug: 'rs-01',
    direction: 'RESALE',
    type: 'APARTMENT',
    title: '3-комн. квартира, 78 м²',
    rooms: 3,
    area: 78,
    floor: 5,
    totalFloors: 9,
    complex: 'ул. Маяковского',
    city: 'Грозный',
    district: 'Ленинский р-н',
    price: 8_900_000,
    currency: 'RUB',
    premium: false,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'ink',
    badges: ['Вторичка'],
    features: ['Свежий ремонт', 'Раздельный санузел', 'Развитая инфраструктура'],
  },
  {
    slug: 'rs-02',
    direction: 'RESALE',
    type: 'HOUSE',
    title: 'Дом, 180 м², участок 6 сот.',
    rooms: 4,
    area: 180,
    floor: null,
    totalFloors: 2,
    complex: 'пос. Гикало',
    city: 'Грозный',
    district: 'Грозненский р-н',
    price: 11_500_000,
    currency: 'RUB',
    premium: true,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'sand',
    badges: ['Дом', 'Премиум'],
    features: ['Гараж на 2 авто', 'Газ, скважина', 'Сад и зона барбекю'],
  },
  {
    slug: 'rs-03',
    direction: 'RESALE',
    type: 'APARTMENT',
    title: '2-комн. квартира, 58 м²',
    rooms: 2,
    area: 58,
    floor: 3,
    totalFloors: 5,
    complex: 'пр. Кадырова',
    city: 'Грозный',
    district: 'Центр',
    price: 6_450_000,
    currency: 'RUB',
    premium: false,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'ink',
    badges: ['Вторичка'],
    features: ['Окна во двор', 'Мебель остаётся', 'Рядом школа и парк'],
  },
  {
    slug: 'rs-04',
    direction: 'RESALE',
    type: 'APARTMENT',
    title: '1-комн. квартира, 41 м²',
    rooms: 1,
    area: 41,
    floor: 8,
    totalFloors: 10,
    complex: 'ул. Дьякова',
    city: 'Грозный',
    district: 'Октябрьский р-н',
    price: 4_700_000,
    currency: 'RUB',
    premium: false,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'ink',
    badges: ['Вторичка'],
    features: ['Высокий этаж', 'Тёплый пол', 'Лоджия 6 м²'],
  },
  {
    slug: 'rs-05',
    direction: 'RESALE',
    type: 'LAND',
    title: 'Земельный участок, 8 соток',
    rooms: 0,
    area: 800,
    floor: null,
    totalFloors: null,
    complex: 'село Старые-Атаги',
    city: 'Грозный',
    district: 'Урус-Мартановский р-н',
    price: 1_500_000,
    currency: 'RUB',
    premium: false,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'sand',
    badges: ['Участок', 'ИЖС'],
    features: ['8 соток', 'Свет и газ рядом', 'Документы готовы'],
    lat: 43.135193,
    lng: 45.730526,
    landUse: 'IZHS',
    utilities: ['ELECTRICITY', 'GAS', 'WATER'],
  },
  {
    slug: 'rs-06',
    direction: 'RESALE',
    type: 'COMMERCIAL',
    title: 'Офисное помещение, 120 м²',
    rooms: 0,
    area: 120,
    floor: 1,
    totalFloors: 5,
    complex: 'пр. Кадырова',
    city: 'Грозный',
    district: 'Центр',
    price: 18_900_000,
    currency: 'RUB',
    premium: true,
    installment: false,
    isNewBuilding: false,
    delivery: null,
    placeholderTone: 'ink',
    badges: ['Коммерция', 'Центр'],
    features: ['Отдельный вход', 'Парковка', 'Высокий трафик'],
    lat: 43.317,
    lng: 45.694,
    commercialKind: 'OFFICE',
  },
  // ---------- Дубай ----------
  {
    slug: 'db-01',
    direction: 'DUBAI',
    type: 'APARTMENT',
    title: 'Apartment 1BR, 71 м²',
    rooms: 1,
    area: 71,
    floor: 24,
    totalFloors: 52,
    complex: 'Downtown, Burj Royale',
    city: 'Дубай',
    district: 'Downtown Dubai',
    price: 680_000,
    currency: 'USD',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: '',
    badges: ['Дубай', 'ROI 8%'],
    features: ['Вид на Бурдж-Халифа', 'Резиденция инвестора', 'Бассейн на крыше', 'Меблировано'],
  },
  {
    slug: 'db-02',
    direction: 'DUBAI',
    type: 'APARTMENT',
    title: 'Apartment Studio, 38 м²',
    rooms: 0,
    area: 38,
    floor: 12,
    totalFloors: 40,
    complex: 'JVC, Binghatti',
    city: 'Дубай',
    district: 'Jumeirah Village Circle',
    price: 230_000,
    currency: 'USD',
    premium: false,
    installment: true,
    isNewBuilding: true,
    delivery: 'I кв. 2027',
    placeholderTone: '',
    badges: ['Дубай', 'Рассрочка'],
    features: ['Старт инвестиций', 'План оплаты 40/60', 'Гарантия аренды'],
  },
  {
    slug: 'db-03',
    direction: 'DUBAI',
    type: 'APARTMENT',
    title: 'Apartment 2BR, 118 м²',
    rooms: 2,
    area: 118,
    floor: 31,
    totalFloors: 60,
    complex: 'Dubai Marina, Vida',
    city: 'Дубай',
    district: 'Dubai Marina',
    price: 1_290_000,
    currency: 'USD',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: '',
    badges: ['Премиум', 'Вид на марину'],
    features: ['Панорама на залив', '2 парковочных места', 'Smart-home', 'Консьерж'],
  },
  {
    slug: 'db-04',
    direction: 'DUBAI',
    type: 'HOUSE',
    title: 'Villa 4BR, 340 м²',
    rooms: 4,
    area: 340,
    floor: null,
    totalFloors: 2,
    complex: 'Palm Jumeirah, Signature',
    city: 'Дубай',
    district: 'Palm Jumeirah',
    price: 5_700_000,
    currency: 'USD',
    premium: true,
    installment: false,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: 'sand',
    badges: ['Вилла', 'Премиум'],
    features: ['Собственный пляж', 'Бассейн infinity', 'Лифт', 'Гараж на 3 авто'],
  },
  // ---------- Саудовская Аравия ----------
  {
    slug: 'sa-01',
    direction: 'SAUDI',
    type: 'APARTMENT',
    title: 'Apartment 2BR, 96 м²',
    rooms: 2,
    area: 96,
    floor: 18,
    totalFloors: 35,
    complex: 'ROSHN Sedra, Riyadh',
    city: 'Эр-Рияд',
    district: 'North Riyadh',
    price: 420_000,
    currency: 'USD',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'II кв. 2027',
    placeholderTone: 'sand',
    badges: ['Эр-Рияд', 'Рассрочка'],
    features: ['Программа Vision 2030', 'Закрытое комьюнити', 'Мечеть и парк рядом'],
  },
  {
    slug: 'sa-02',
    direction: 'SAUDI',
    type: 'APARTMENT',
    title: 'Apartment 1BR, 64 м²',
    rooms: 1,
    area: 64,
    floor: 9,
    totalFloors: 22,
    complex: 'Jeddah Corniche',
    city: 'Джидда',
    district: 'Al Shati',
    price: 285_000,
    currency: 'USD',
    premium: false,
    installment: true,
    isNewBuilding: true,
    delivery: 'Сдан',
    placeholderTone: 'sand',
    badges: ['Джидда', 'У моря'],
    features: ['Вид на Красное море', 'Набережная', 'Гарантия дохода'],
  },
  {
    slug: 'sa-03',
    direction: 'SAUDI',
    type: 'HOUSE',
    title: 'Villa 5BR, 420 м²',
    rooms: 4,
    area: 420,
    floor: null,
    totalFloors: 2,
    complex: 'Diriyah Gate, Riyadh',
    city: 'Эр-Рияд',
    district: 'Diriyah',
    price: 2_100_000,
    currency: 'USD',
    premium: true,
    installment: false,
    isNewBuilding: true,
    delivery: 'III кв. 2027',
    placeholderTone: 'sand',
    badges: ['Вилла', 'Премиум'],
    features: ['Историческ. район ЮНЕСКО', 'Частный сад', 'Мажлис', 'Премиум-отделка'],
  },
  {
    slug: 'sa-04',
    direction: 'SAUDI',
    type: 'APARTMENT',
    title: 'Apartment 2BR, 88 м²',
    rooms: 2,
    area: 88,
    floor: 14,
    totalFloors: 28,
    complex: 'King Salman Park, Riyadh',
    city: 'Эр-Рияд',
    district: 'Central Riyadh',
    price: 495_000,
    currency: 'USD',
    premium: true,
    installment: true,
    isNewBuilding: true,
    delivery: 'I кв. 2028',
    placeholderTone: 'sand',
    badges: ['Эр-Рияд', 'Рассрочка'],
    features: ['Крупнейший парк мира', 'Инвест-локация', 'Premium-инфраструктура'],
  },
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to seed the database')
  }

  const prisma = createPrisma(databaseUrl)
  const publishedAt = new Date()

  try {
    for (const property of properties) {
      const data = {
        source: 'SITE' as const,
        lat: null,
        lng: null,
        landUse: null,
        commercialKind: null,
        utilities: [] as string[],
        ...property,
        status: 'PUBLISHED' as const,
        photos: [],
        publishedAt,
      }

      await prisma.property.upsert({
        where: { slug: property.slug },
        update: data,
        create: data,
      })
    }

    // One active manager per direction (upsert by the unique direction).
    const managers: Array<{
      direction: PropertyDirection
      name: string
      phone: string
      photo: string | null
      contact: string | null
    }> = [
      { direction: 'NEW', name: 'Мехьди Расухаджиев', phone: '+79391016020', photo: null, contact: null },
      { direction: 'RESALE', name: 'Мехьди Расухаджиев', phone: '+79391016020', photo: null, contact: null },
      { direction: 'DUBAI', name: 'Иса Дудаев', phone: '+79391031133', photo: null, contact: null },
      { direction: 'SAUDI', name: 'Иса Дудаев', phone: '+79391031133', photo: null, contact: null },
    ]
    for (const manager of managers) {
      await prisma.manager.upsert({
        where: { direction: manager.direction },
        update: { ...manager, active: true },
        create: { ...manager, active: true },
      })
    }

    // Singleton site settings (Bitrix off by default, +2 ₽ FX surcharge).
    await prisma.siteSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton', bitrixEnabled: false, usdRubSurcharge: 2 },
    })

    // Singleton home content with a few curated selections.
    await prisma.homeContent.upsert({
      where: { id: 'singleton' },
      update: {},
      create: {
        id: 'singleton',
        heroTitle: 'Недвижимость в России и за рубежом',
        heroSubtitle: 'Новостройки и вторичка в России, инвестиции в Дубае и Саудовской Аравии',
        chosenSlugs: ['gz-01', 'gz-03', 'db-03', 'sa-04'],
      },
    })

    // Demo USD→RUB rate so the FX layer has a cached value to read.
    await prisma.fxRate.upsert({
      where: { base_quote: { base: 'USD', quote: 'RUB' } },
      update: { value: 90, source: 'SEED', fetchedAt: new Date() },
      create: { base: 'USD', quote: 'RUB', value: 90, source: 'SEED', fetchedAt: new Date() },
    })

    console.log(
      `Seeded ${properties.length} properties, ${managers.length} managers, site settings, home content and 1 FX rate`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
