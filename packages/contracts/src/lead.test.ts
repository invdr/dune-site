import { describe, expect, test } from 'bun:test'

import { createLeadSchema, updateLeadSchema } from './lead'

const validLead = {
  name: 'Иван Петров',
  phone: '+7 939 101 60 20',
  consent: true,
} as const

describe('lead contracts', () => {
  test('accepts a valid submission with consent and normalizes optional text', () => {
    const result = createLeadSchema.parse({ ...validLead, email: '  ', message: '   ' })
    expect(result.consent).toBe(true)
    expect(result.email).toBeNull()
    expect(result.message).toBeNull()
  })

  test('rejects a submission without explicit consent', () => {
    expect(createLeadSchema.safeParse({ name: 'Иван Петров', phone: '+79391016020' }).success).toBe(
      false,
    )
    expect(createLeadSchema.safeParse({ ...validLead, consent: false }).success).toBe(false)
  })

  test('honeypot must stay empty (filled = bot)', () => {
    expect(createLeadSchema.safeParse({ ...validLead, honeypot: '' }).success).toBe(true)
    expect(createLeadSchema.safeParse({ ...validLead, honeypot: 'spam' }).success).toBe(false)
  })

  test('rejects malformed phone and email', () => {
    expect(createLeadSchema.safeParse({ ...validLead, phone: 'call me' }).success).toBe(false)
    expect(createLeadSchema.safeParse({ ...validLead, email: 'not-an-email' }).success).toBe(false)
  })

  test('rejects empty admin update payloads', () => {
    expect(updateLeadSchema.safeParse({}).success).toBe(false)
    expect(updateLeadSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true)
  })
})
