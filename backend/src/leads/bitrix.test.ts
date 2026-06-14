import { describe, expect, test } from 'bun:test'

import type { Lead } from '../generated/prisma/client'
import { BitrixAdapter, toBitrixLeadFields } from './bitrix'

const lead = {
  id: '1',
  name: 'Анна',
  phone: '+7 900 000-00-00',
  email: 'a@example.com',
  message: 'Интересует рассрочка',
  source: 'Карточка объекта',
  direction: 'DUBAI',
  propertyId: 'prop-1',
  status: 'NEW',
  consentAt: new Date('2026-06-10T10:00:00Z'),
  telegramSentAt: null,
  bitrixSentAt: null,
  createdAt: new Date('2026-06-10T10:00:00Z'),
  updatedAt: new Date('2026-06-10T10:00:00Z'),
} as unknown as Lead

describe('toBitrixLeadFields', () => {
  test('carries core contact fields', () => {
    const fields = toBitrixLeadFields(lead, 'Marina view (/dubai-1)')
    expect(fields.NAME).toBe('Анна')
    expect(fields.PHONE).toEqual([{ VALUE: '+7 900 000-00-00', VALUE_TYPE: 'WORK' }])
    expect(fields.SOURCE_ID).toBe('WEB')
    expect(String(fields.COMMENTS)).toContain('Объект: Marina view (/dubai-1)')
  })

  test('routes to the object manager — name and phone land in the comment', () => {
    const fields = toBitrixLeadFields(lead, 'Marina view (/dubai-1)', {
      name: 'Карим',
      phone: '+971 50 000-00-00',
    })
    expect(String(fields.COMMENTS)).toContain('Менеджер объекта: Карим (+971 50 000-00-00)')
  })

  test('omits the manager line when no manager resolved', () => {
    const fields = toBitrixLeadFields(lead, null, null)
    expect(String(fields.COMMENTS ?? '')).not.toContain('Менеджер объекта')
  })

  test('keeps the manager name even without a phone', () => {
    const fields = toBitrixLeadFields(lead, null, { name: 'Карим', phone: null })
    expect(String(fields.COMMENTS)).toContain('Менеджер объекта: Карим')
    expect(String(fields.COMMENTS)).not.toContain('Карим (')
  })
})

describe('BitrixAdapter', () => {
  test('does not send while disabled', async () => {
    let sent = 0
    const adapter = new BitrixAdapter({ enabled: false, webhookUrl: 'https://x/rest/1/abc' }, async () => {
      sent += 1
      return true
    })
    expect(await adapter.deliver(lead, null, { name: 'Карим', phone: null })).toBe(false)
    expect(sent).toBe(0)
  })

  test('posts to crm.lead.add with the manager attached when enabled', async () => {
    const calls: { url: string; body: unknown }[] = []
    const adapter = new BitrixAdapter({ enabled: true, webhookUrl: 'https://x/rest/1/abc/' }, async (url, body) => {
      calls.push({ url, body })
      return true
    })
    const ok = await adapter.deliver(lead, 'Marina view (/dubai-1)', { name: 'Карим', phone: '+971' })
    expect(ok).toBe(true)
    expect(calls[0]?.url).toBe('https://x/rest/1/abc/crm.lead.add.json')
    const body = calls[0]?.body as { fields: { COMMENTS: string } }
    expect(body.fields.COMMENTS).toContain('Менеджер объекта: Карим (+971)')
  })
})
