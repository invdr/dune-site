import { describe, expect, test } from 'bun:test'

import type { Lead } from '../generated/prisma/client'
import { TelegramNotifier, formatLeadMessage } from './telegram'

const lead = {
  id: '1',
  name: 'Анна <test>',
  phone: '+7 900 000-00-00',
  email: 'a@example.com',
  message: 'Интересует рассрочка',
  source: 'Главная',
  direction: 'DUBAI',
  propertyId: null,
  status: 'NEW',
  consentAt: new Date('2026-06-10T10:00:00Z'),
  telegramSentAt: null,
  bitrixSentAt: null,
  createdAt: new Date('2026-06-10T10:00:00Z'),
  updatedAt: new Date('2026-06-10T10:00:00Z'),
} as unknown as Lead

describe('formatLeadMessage', () => {
  test('includes contact details and escapes HTML', () => {
    const text = formatLeadMessage(lead, 'Marina view (/dubai-1)')
    expect(text).toContain('+7 900 000-00-00')
    expect(text).toContain('Marina view (/dubai-1)')
    expect(text).toContain('Анна &lt;test&gt;')
  })
})

describe('TelegramNotifier', () => {
  test('is not configured without token and chat id', () => {
    expect(new TelegramNotifier({ botToken: null, chatId: null }).configured).toBe(false)
  })

  test('sends via the configured chat and reports success', async () => {
    const calls: string[] = []
    const notifier = new TelegramNotifier(
      { botToken: 'T', chatId: 'C' },
      async (url) => {
        calls.push(url)
        return true
      },
    )
    expect(await notifier.notify(lead, null)).toBe(true)
    expect(calls[0]).toContain('/botT/sendMessage')
  })

  test('retries then gives up on persistent failure', async () => {
    let attempts = 0
    const notifier = new TelegramNotifier({ botToken: 'T', chatId: 'C' }, async () => {
      attempts += 1
      return false
    })
    expect(await notifier.notify(lead, null)).toBe(false)
    expect(attempts).toBe(3)
  })
})
