import { describe, expect, test } from 'bun:test'

import { parseListing, parseSitemap } from './parse'
import { DUBAI_HTML, DUBAI_STYLE_RU_HTML, GROZNY_HTML, SITEMAP_XML } from './fixtures'

describe('parseSitemap', () => {
  test('keeps /property/ listing URLs and drops taxonomy URLs', () => {
    expect(parseSitemap(SITEMAP_XML)).toEqual([
      'https://sellox.ru/property/zhk-prestizh-v-groznom/',
      'https://sellox.ru/property/zhk-rivera/',
      'https://sellox.ru/property/zhk-dubaiskie-doma/',
    ])
  })
})

describe('parseListing — Grozny complex', () => {
  const url = 'https://sellox.ru/property/zhk-prestizh-v-groznom/'
  const parsed = parseListing(GROZNY_HTML, url)

  test('slug comes from the URL', () => {
    expect(parsed.slug).toBe('zhk-prestizh-v-groznom')
  })

  test('name is the last breadcrumb crumb', () => {
    expect(parsed.name).toBe('ЖК Престиж')
  })

  test('per-m² ruble headline → priceFrom, "от N м²" → areaFrom', () => {
    expect(parsed.priceFrom).toBe(68000)
    expect(parsed.areaFrom).toBe(47)
  })

  test('geography defaults to Grozny / RU / RUB', () => {
    expect(parsed).toMatchObject({ city: 'Грозный', country: 'RU', direction: 'NEW', currency: 'RUB' })
  })

  test('delivery is normalised to a short label', () => {
    expect(parsed.delivery).toBe('Сдача: 2026')
  })

  test('map marker yields address and coordinates', () => {
    expect(parsed.address).toBe('Грозный, проспект Путина')
    expect(parsed.lat).toBeCloseTo(43.3245, 3)
    expect(parsed.lng).toBeCloseTo(45.6681, 3)
  })

  test('installment surfaces as a badge', () => {
    expect(parsed.badges).toEqual(['Рассрочка'])
  })

  test('features come from the Особенности (/feature/) links, in order', () => {
    expect(parsed.features).toEqual(['Бассейн', 'Есть рассрочка', 'Школа рядом'])
  })

  test('characteristics: Артикул hidden, Гаражи→Парковка, Статус недв.→Статус недвижимости', () => {
    expect(parsed.attributes).toEqual([
      { label: 'Цена', value: 'от 68,000₽/м²' },
      { label: 'Этажность', value: '18' },
      { label: 'Парковка', value: 'Есть' },
      { label: 'Тип недвижимости', value: 'Новостройки' },
      { label: 'Статус недвижимости', value: 'ЖК в Грозном' },
    ])
    expect(parsed.attributes.some((a) => /артикул/i.test(a.label))).toBe(false)
  })

  test('description captures the marketing copy', () => {
    expect(parsed.description).toContain('проспекте Путина')
    expect(parsed.description!.length).toBeGreaterThan(120)
  })

  test('photos: theme chrome removed, size variants deduped, og image first, plans excluded', () => {
    expect(parsed.photos).toEqual([
      'https://sellox.ru/wp-content/uploads/2024/07/%D0%96%D0%9A-%D0%9F%D1%80%D0%B5%D1%81%D1%82%D0%B8%D0%B6-1.webp',
      'https://sellox.ru/wp-content/uploads/2024/07/%D0%96%D0%9A-%D0%9F%D1%80%D0%B5%D1%81%D1%82%D0%B8%D0%B6-2.webp',
    ])
  })

  test('floor-plan images are split into their own list', () => {
    // Both the "план"-named file and the arbitrarily-named IMG_8842 are kept:
    // the latter is classified by its position under the "Планировки" heading,
    // proving section detection, not just the filename hint.
    expect(parsed.floorPlans).toEqual([
      'https://sellox.ru/wp-content/uploads/2024/07/%D0%A2%D0%B8%D0%BF%D0%BE%D0%B2%D0%BE%D0%B9-%D0%BF%D0%BB%D0%B0%D0%BD-%D1%8D%D1%82%D0%B0%D0%B6%D0%B5%D0%B9.webp',
      'https://sellox.ru/wp-content/uploads/2024/07/IMG_8842.webp',
    ])
    expect(parsed.photos.some((p) => p.toLowerCase().includes('plan'))).toBe(false)
    expect(parsed.photos.some((p) => p.includes('IMG_8842'))).toBe(false)
  })

  test('related-listing widget is excluded from facts and photos', () => {
    // The related ЖК Ривера card (59 000 ₽/м², its own image) must not leak in.
    expect(parsed.priceFrom).not.toBe(59000)
    expect(parsed.photos.some((p) => p.toLowerCase().includes('rivera'))).toBe(false)
  })
})

describe('parseListing — floor-plan classification signals', () => {
  // A focused page: a benign gallery image and a "план"-named image above the
  // heading, plus an arbitrarily-named image under it.
  const html = `<!doctype html><html><head>
<meta property="og:image" content="https://sellox.ru/wp-content/uploads/hero.webp" />
</head><body><main>
  <h1>ЖК Сигнал</h1>
  <img src="https://sellox.ru/wp-content/uploads/gallery-1.webp" />
  <img src="https://sellox.ru/wp-content/uploads/план-фасада.webp" />
  <h2>Планировки</h2>
  <img src="https://sellox.ru/wp-content/uploads/DSC_0001.webp" />
</main></body></html>`
  const parsed = parseListing(html, 'https://sellox.ru/property/zhk-signal/')

  test('an arbitrarily-named image under the heading is a plan (position wins)', () => {
    expect(parsed.floorPlans.some((p) => p.includes('DSC_0001'))).toBe(true)
  })

  test('a "план"-named image above the heading is a plan (filename hint as fallback)', () => {
    expect(parsed.floorPlans.some((p) => p.includes('%D1%84%D0%B0%D1%81%D0%B0%D0%B4%D0%B0'))).toBe(true)
  })

  test('a benign gallery image above the heading stays a photo, never swept into plans', () => {
    expect(parsed.photos.some((p) => p.includes('gallery-1'))).toBe(true)
    expect(parsed.floorPlans.some((p) => p.includes('gallery-1'))).toBe(false)
  })
})

describe('parseListing — geography keys off currency', () => {
  test('foreign-priced Dubai listing → AE / DUBAI / USD', () => {
    const parsed = parseListing(DUBAI_HTML, 'https://sellox.ru/property/dubai-marina/')
    expect(parsed).toMatchObject({ city: 'Дубай', country: 'AE', direction: 'DUBAI', currency: 'USD' })
    expect(parsed.priceFrom).toBe(350000)
  })

  test('Dubai-themed but ruble-priced listing stays Russian', () => {
    const parsed = parseListing(DUBAI_STYLE_RU_HTML, 'https://sellox.ru/property/zhk-dubaiskie-doma/')
    expect(parsed).toMatchObject({ country: 'RU', direction: 'NEW', currency: 'RUB' })
    expect(parsed.city).not.toBe('Дубай')
    expect(parsed.priceFrom).toBe(90000)
  })
})
