import type { Lead } from '../generated/prisma/client'

// Bitrix24 inbound-webhook delivery. Kept behind the `bitrixEnabled` flag and a
// configured webhook URL — off by default until the customer provides access
// (§14). Built now so flipping the flag is the only remaining step.
export type BitrixConfig = {
  enabled: boolean
  webhookUrl: string | null
}

export type BitrixSender = (url: string, body: unknown) => Promise<boolean>

const defaultSender: BitrixSender = async (url, body) => {
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

// Maps a lead onto Bitrix `crm.lead.add` fields. Comment carries the context
// (direction/object/source) the structured fields cannot hold.
export function toBitrixLeadFields(lead: Lead): Record<string, unknown> {
  const comment = [
    lead.message ? `Комментарий: ${lead.message}` : null,
    lead.direction ? `Направление: ${lead.direction}` : null,
    lead.source ? `Источник: ${lead.source}` : null,
    lead.propertyId ? `Объект: ${lead.propertyId}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    TITLE: `Заявка с сайта DUNE — ${lead.name}`,
    NAME: lead.name,
    PHONE: [{ VALUE: lead.phone, VALUE_TYPE: 'WORK' }],
    ...(lead.email ? { EMAIL: [{ VALUE: lead.email, VALUE_TYPE: 'WORK' }] } : {}),
    ...(comment ? { COMMENTS: comment } : {}),
    SOURCE_ID: 'WEB',
  }
}

export class BitrixAdapter {
  constructor(
    private readonly config: BitrixConfig,
    private readonly send: BitrixSender = defaultSender,
  ) {}

  get enabled(): boolean {
    return this.config.enabled && Boolean(this.config.webhookUrl)
  }

  async deliver(lead: Lead): Promise<boolean> {
    if (!this.config.enabled || !this.config.webhookUrl) return false

    const url = `${this.config.webhookUrl.replace(/\/$/, '')}/crm.lead.add.json`
    return this.send(url, { fields: toBitrixLeadFields(lead) })
  }
}
