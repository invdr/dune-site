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

  test('installment surfaces as a badge', () => {
    expect(parsed.badges).toEqual(['Рассрочка'])
  })

  test('amenities become feature bullets', () => {
    expect(parsed.features).toEqual(
      expect.arrayContaining(['Бассейн', 'Фитнес-центр', 'Хаммам', 'Подземный паркинг', 'Охраняемая территория']),
    )
  })

  test('description captures the marketing copy', () => {
    expect(parsed.description).toContain('проспекте Путина')
    expect(parsed.description!.length).toBeGreaterThan(120)
  })

  test('photos: theme chrome removed, size variants deduped, og image first', () => {
    expect(parsed.photos).toEqual([
      'https://sellox.ru/wp-content/uploads/2024/07/%D0%96%D0%9A-%D0%9F%D1%80%D0%B5%D1%81%D1%82%D0%B8%D0%B6-1.webp',
      'https://sellox.ru/wp-content/uploads/2024/07/%D0%96%D0%9A-%D0%9F%D1%80%D0%B5%D1%81%D1%82%D0%B8%D0%B6-2.webp',
    ])
  })

  test('related-listing widget is excluded from facts and photos', () => {
    // The related ЖК Ривера card (59 000 ₽/м², its own image) must not leak in.
    expect(parsed.priceFrom).not.toBe(59000)
    expect(parsed.photos.some((p) => p.toLowerCase().includes('rivera'))).toBe(false)
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
