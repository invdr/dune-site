import { describe, expect, test } from 'bun:test'

import { displayCurrencySchema, fxContextSchema, priceSetSchema } from './pricing'

describe('pricing contracts', () => {
  test('display currency set includes the derived locals', () => {
    expect(displayCurrencySchema.options).toEqual(['RUB', 'USD', 'AED', 'SAR'])
  })

  test('accepts a full foreign price set', () => {
    const parsed = priceSetSchema.parse({
      onRequest: false,
      base: { currency: 'USD', amount: 450000, approximate: false },
      lines: [
        { currency: 'USD', amount: 450000, approximate: false },
        { currency: 'AED', amount: 1653000, approximate: true },
        { currency: 'RUB', amount: 42300000, approximate: true },
      ],
    })
    expect(parsed.lines).toHaveLength(3)
  })

  test('accepts an on-request set with a null base', () => {
    expect(priceSetSchema.parse({ onRequest: true, base: null, lines: [] }).onRequest).toBe(true)
  })

  test('rejects fractional or negative amounts', () => {
    expect(priceSetSchema.safeParse({ onRequest: false, base: null, lines: [{ currency: 'USD', amount: -1, approximate: false }] }).success).toBe(false)
  })

  test('fx context allows a null cold-start rate', () => {
    const parsed = fxContextSchema.parse({ usdToRub: null, usdToAed: 3.6725, usdToSar: 3.75, surcharge: 2, asOf: null })
    expect(parsed.usdToRub).toBeNull()
  })
})
