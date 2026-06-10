import type { Lead } from '../generated/prisma/client'

// Minimal config pulled from SiteSettings (DB), not env — admins set the bot
// token and chat id in the panel.
export type TelegramConfig = {
  botToken: string | null
  chatId: string | null
}

export type TelegramSender = (url: string, body: unknown) => Promise<boolean>

const defaultSender: TelegramSender = async (url, body) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return response.ok
  } catch {
    return false
  }
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Human-readable Telegram card for a new lead. Object title/link are resolved by
// the caller (the service knows the property) and passed via `objectLine`.
export function formatLeadMessage(lead: Lead, objectLine: string | null): string {
  const rows = [
    '🏠 <b>Новая заявка — DUNE</b>',
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Телефон:</b> ${escapeHtml(lead.phone)}`,
  ]
  if (lead.email) rows.push(`<b>E-mail:</b> ${escapeHtml(lead.email)}`)
  if (lead.direction) rows.push(`<b>Направление:</b> ${lead.direction}`)
  if (objectLine) rows.push(`<b>Объект:</b> ${objectLine}`)
  if (lead.source) rows.push(`<b>Источник:</b> ${escapeHtml(lead.source)}`)
  if (lead.message) rows.push(`<b>Комментарий:</b> ${escapeHtml(lead.message)}`)
  rows.push(`<i>${lead.createdAt.toLocaleString('ru-RU')}</i>`)
  return rows.join('\n')
}

// Sends a lead notification to the managers' chat. Returns false (never throws)
// when unconfigured or on transport failure, so the caller can keep the
// delivery flag null and retry later.
export class TelegramNotifier {
  constructor(
    private readonly config: TelegramConfig,
    private readonly send: TelegramSender = defaultSender,
  ) {}

  get configured(): boolean {
    return Boolean(this.config.botToken && this.config.chatId)
  }

  async notify(lead: Lead, objectLine: string | null): Promise<boolean> {
    if (!this.config.botToken || !this.config.chatId) return false

    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`
    const body = {
      chat_id: this.config.chatId,
      text: formatLeadMessage(lead, objectLine),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }

    // A couple of quick retries cover transient blips without blocking the user
    // (delivery already runs in the background after the success screen).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await this.send(url, body)) return true
    }
    return false
  }
}
