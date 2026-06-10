import type { CreateLeadPayload, LeadListQuery, UpdateLeadPayload } from '@dune/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { Prisma } from '../generated/prisma/client'
import { BitrixAdapter, type BitrixSender } from './bitrix'
import { toLeadDto } from './serializer'
import { TelegramNotifier, type TelegramSender } from './telegram'

// Same phone + same object within this window is treated as a re-submit (double
// click / "did it go through?") and collapsed onto the first lead.
const DEDUPE_WINDOW_MS = 10 * 60 * 1000

type LeadServiceDeps = {
  // Injectable transports keep delivery deterministic in tests.
  telegramSender?: TelegramSender
  bitrixSender?: BitrixSender
}

export class LeadService {
  constructor(
    private readonly db: DbClient,
    private readonly deps: LeadServiceDeps = {},
  ) {}

  async create(payload: CreateLeadPayload) {
    const propertyId = payload.propertyId ?? null

    const existing = await this.db.lead.findFirst({
      where: {
        phone: payload.phone,
        propertyId,
        createdAt: { gt: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Idempotent: re-submits get the success screen without a second lead or a
    // duplicate Telegram ping.
    if (existing) return toLeadDto(existing)

    const lead = await this.db.lead.create({
      data: {
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? null,
        message: payload.message ?? null,
        source: payload.source ?? null,
        direction: payload.direction ?? null,
        propertyId,
        // Consent is validated as literal `true` by the contract; stamp the time.
        consentAt: new Date(),
      },
    })

    // Delivery runs after the success screen — never block the visitor on it.
    void this.deliver(lead.id).catch(() => {})

    return toLeadDto(lead)
  }

  // Pushes a lead to the configured channels and records per-channel delivery
  // flags. Safe to call repeatedly; already-delivered channels are skipped.
  async deliver(leadId: string): Promise<void> {
    const lead = await this.db.lead.findUnique({ where: { id: leadId } })
    if (!lead) return

    const settings = await this.db.siteSettings.findUnique({ where: { id: 'singleton' } })

    const notifier = new TelegramNotifier(
      { botToken: settings?.telegramBotToken ?? null, chatId: settings?.telegramChatId ?? null },
      this.deps.telegramSender,
    )
    if (notifier.configured && !lead.telegramSentAt) {
      const objectLine = await this.objectLine(lead.propertyId)
      if (await notifier.notify(lead, objectLine)) {
        await this.db.lead.update({ where: { id: lead.id }, data: { telegramSentAt: new Date() } })
      }
    }

    const bitrix = new BitrixAdapter(
      { enabled: settings?.bitrixEnabled ?? false, webhookUrl: settings?.bitrixWebhookUrl ?? null },
      this.deps.bitrixSender,
    )
    if (bitrix.enabled && !lead.bitrixSentAt) {
      if (await bitrix.deliver(lead)) {
        await this.db.lead.update({ where: { id: lead.id }, data: { bitrixSentAt: new Date() } })
      }
    }
  }

  private async objectLine(propertyId: string | null): Promise<string | null> {
    if (!propertyId) return null
    const property = await this.db.property.findUnique({
      where: { id: propertyId },
      select: { title: true, slug: true },
    })
    return property ? `${property.title} (/${property.slug})` : null
  }

  async list(query: LeadListQuery) {
    const where: Prisma.LeadWhereInput = {}
    if (query.status) where.status = query.status
    if (query.direction) where.direction = query.direction

    const skip = (query.page - 1) * query.limit
    const [items, total] = await this.db.$transaction([
      this.db.lead.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: query.limit }),
      this.db.lead.count({ where }),
    ])

    return {
      items: items.map(toLeadDto),
      total,
      page: query.page,
      limit: query.limit,
      pageCount: Math.max(1, Math.ceil(total / query.limit)),
    }
  }

  async updateStatus(id: string, payload: UpdateLeadPayload) {
    const lead = await this.db.lead
      .update({ where: { id }, data: payload })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new AppError(404, 'NOT_FOUND', 'Lead not found')
        }
        throw error
      })

    return toLeadDto(lead)
  }
}
