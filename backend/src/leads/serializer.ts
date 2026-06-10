import type { LeadDto } from '@dune/contracts'

import type { Lead } from '../generated/prisma/client'

export function toLeadDto(lead: Lead): LeadDto {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    message: lead.message,
    source: lead.source,
    direction: lead.direction,
    propertyId: lead.propertyId,
    status: lead.status,
    consentAt: lead.consentAt.toISOString(),
    telegramSentAt: lead.telegramSentAt ? lead.telegramSentAt.toISOString() : null,
    bitrixSentAt: lead.bitrixSentAt ? lead.bitrixSentAt.toISOString() : null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }
}
