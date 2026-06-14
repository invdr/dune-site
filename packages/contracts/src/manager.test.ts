import { describe, expect, test } from 'bun:test'

import { createManagerSchema, updateManagerSchema } from './manager'

describe('manager contracts', () => {
  test('applies the active default and normalizes optional contact fields', () => {
    const result = createManagerSchema.parse({
      direction: 'DUBAI',
      name: 'Иса Дудаев',
      phone: '   ',
      contact: '',
    })
    expect(result.active).toBe(true)
    expect(result.phone).toBeNull()
    expect(result.contact).toBeNull()
  })

  test('validates direction enum', () => {
    expect(createManagerSchema.safeParse({ direction: 'MARS', name: 'X' }).success).toBe(false)
  })

  test('rejects empty update payloads', () => {
    expect(updateManagerSchema.safeParse({}).success).toBe(false)
    expect(updateManagerSchema.safeParse({ active: false }).success).toBe(true)
  })
})
