import { describe, expect, test } from 'bun:test'

import { fetchCbrUsdRub, parseUsdRubFromCbrXml } from './cbr'

const SAMPLE_XML = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="10.06.2026" name="Foreign Currency Market">
  <Valute ID="R01035"><NumCode>826</NumCode><CharCode>GBP</CharCode><Nominal>1</Nominal><Name>Фунт</Name><Value>110,1234</Value></Valute>
  <Valute ID="R01235"><NumCode>840</NumCode><CharCode>USD</CharCode><Nominal>1</Nominal><Name>Доллар США</Name><Value>79,5500</Value></Valute>
</ValCurs>`

describe('CBR parsing', () => {
  test('extracts USD→RUB respecting comma decimals and nominal', () => {
    expect(parseUsdRubFromCbrXml(SAMPLE_XML)).toBeCloseTo(79.55, 4)
  })

  test('divides by nominal when greater than one', () => {
    const xml = SAMPLE_XML.replace('<Nominal>1</Nominal><Name>Доллар США</Name><Value>79,5500</Value>', '<Nominal>10</Nominal><Name>Доллар США</Name><Value>795,5000</Value>')
    expect(parseUsdRubFromCbrXml(xml)).toBeCloseTo(79.55, 4)
  })

  test('returns null when the USD block is absent', () => {
    expect(parseUsdRubFromCbrXml('<ValCurs></ValCurs>')).toBeNull()
  })

  test('fetcher path resolves the rate via the injected transport', async () => {
    const rate = await fetchCbrUsdRub(async () => SAMPLE_XML)
    expect(rate).toBeCloseTo(79.55, 4)
  })

  test('throws when the response cannot be parsed', () => {
    expect(fetchCbrUsdRub(async () => 'garbage')).rejects.toThrow()
  })
})
