import { describe, expect, test } from 'bun:test'

import { buildPriceSet, USD_TO_AED, USD_TO_SAR } from './pricing'

describe('currency pegs', () => {
  test('match the customer-agreed constants (§14)', () => {
    expect(USD_TO_AED).toBe(3.6725)
    expect(USD_TO_SAR).toBe(3.75)
  })
})

describe('buildPriceSet', () => {
  const rate = { usdToRub: 94 } // surcharge already folded in by the service

  test('domestic listing shows a single exact ₽ line', () => {
    const set = buildPriceSet(7_680_000, 'RUB', 'NEW', rate)
    expect(set.onRequest).toBe(false)
    expect(set.lines).toHaveLength(1)
    expect(set.lines[0]).toEqual({ currency: 'RUB', amount: 7_680_000, approximate: false })
    expect(set.base?.currency).toBe('RUB')
  })

  test('Dubai listing shows $, ≈AED and ≈₽ with ₽ rounded to 100k', () => {
    const set = buildPriceSet(450_000, 'USD', 'DUBAI', rate)
    expect(set.base?.currency).toBe('USD')
    const codes = set.lines.map((l) => l.currency)
    expect(codes).toEqual(['USD', 'AED', 'RUB'])

    const usd = set.lines.find((l) => l.currency === 'USD')!
    expect(usd).toEqual({ currency: 'USD', amount: 450_000, approximate: false })

    const aed = set.lines.find((l) => l.currency === 'AED')!
    expect(aed.approximate).toBe(true)
    expect(aed.amount).toBe(Math.round((450_000 * USD_TO_AED) / 1000) * 1000)

    const rub = set.lines.find((l) => l.currency === 'RUB')!
    expect(rub.approximate).toBe(true)
    expect(rub.amount % 100_000).toBe(0)
    expect(rub.amount).toBe(Math.round((450_000 * 94) / 100_000) * 100_000)
  })

  test('Saudi listing uses the SAR peg', () => {
    const set = buildPriceSet(200_000, 'USD', 'SAUDI', rate)
    expect(set.lines.map((l) => l.currency)).toEqual(['USD', 'SAR', 'RUB'])
    const sar = set.lines.find((l) => l.currency === 'SAR')!
    expect(sar.amount).toBe(Math.round((200_000 * USD_TO_SAR) / 1000) * 1000)
  })

  test('cold start (no rate) drops the ₽ line but keeps $ and the peg', () => {
    const set = buildPriceSet(450_000, 'USD', 'DUBAI', { usdToRub: null })
    expect(set.lines.map((l) => l.currency)).toEqual(['USD', 'AED'])
  })

  test('zero or missing price collapses to "on request"', () => {
    expect(buildPriceSet(0, 'USD', 'DUBAI', rate)).toEqual({ onRequest: true, base: null, lines: [] })
    expect(buildPriceSet(-1, 'RUB', 'NEW', rate).onRequest).toBe(true)
  })
})
