import type {
  HomeContentDto,
  PublicSiteSettingsDto,
  SiteSettingsDto,
  UpdateHomeContentPayload,
  UpdateSiteSettingsPayload,
} from '@dune/contracts'

import type { DbClient } from '../db'
import { Prisma, type HomeContent, type SiteSettings } from '../generated/prisma/client'

const SINGLETON_ID = 'singleton'

function toSiteSettingsDto(row: SiteSettings): SiteSettingsDto {
  return {
    id: row.id,
    telegramBotToken: row.telegramBotToken,
    telegramChatId: row.telegramChatId,
    bitrixWebhookUrl: row.bitrixWebhookUrl,
    bitrixEnabled: row.bitrixEnabled,
    yandexMapsApiKey: row.yandexMapsApiKey,
    usdRubSurcharge: row.usdRubSurcharge,
    companyName: row.companyName,
    companyPhone: row.companyPhone,
    companyContact: row.companyContact,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toPublicSiteSettingsDto(row: SiteSettings): PublicSiteSettingsDto {
  return {
    companyName: row.companyName,
    companyPhone: row.companyPhone,
    companyContact: row.companyContact,
  }
}

function toHomeContentDto(row: HomeContent): HomeContentDto {
  return {
    id: row.id,
    heroTitle: row.heroTitle,
    heroSubtitle: row.heroSubtitle,
    heroImageUrl: row.heroImageUrl,
    chosenSlugs: row.chosenSlugs,
    tileLinks: row.tileLinks ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

// Owns the two singleton config rows. Reads lazily materialize defaults so the
// admin panel and public site always get a row.
export class SiteService {
  constructor(private readonly db: DbClient) {}

  private async settingsRow(): Promise<SiteSettings> {
    return this.db.siteSettings.upsert({ where: { id: SINGLETON_ID }, create: { id: SINGLETON_ID }, update: {} })
  }

  private async homeRow(): Promise<HomeContent> {
    return this.db.homeContent.upsert({ where: { id: SINGLETON_ID }, create: { id: SINGLETON_ID }, update: {} })
  }

  async getSettings(): Promise<SiteSettingsDto> {
    return toSiteSettingsDto(await this.settingsRow())
  }

  async getPublicSettings(): Promise<PublicSiteSettingsDto> {
    return toPublicSiteSettingsDto(await this.settingsRow())
  }

  async updateSettings(payload: UpdateSiteSettingsPayload): Promise<SiteSettingsDto> {
    const row = await this.db.siteSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...payload },
      update: payload,
    })
    return toSiteSettingsDto(row)
  }

  async getHome(): Promise<HomeContentDto> {
    return toHomeContentDto(await this.homeRow())
  }

  async updateHome(payload: UpdateHomeContentPayload): Promise<HomeContentDto> {
    const data = this.homeData(payload)
    const row = await this.db.homeContent.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    })
    return toHomeContentDto(row)
  }

  // Prisma's Json column needs the JsonNull sentinel to store an explicit null;
  // an omitted key leaves the column untouched.
  private homeData(payload: UpdateHomeContentPayload) {
    const { tileLinks, ...rest } = payload
    if (!('tileLinks' in payload)) return rest
    return {
      ...rest,
      tileLinks: tileLinks == null ? Prisma.JsonNull : (tileLinks as Prisma.InputJsonValue),
    }
  }
}
