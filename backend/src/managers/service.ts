import type { CreateManagerPayload, PropertyDirection, UpdateManagerPayload } from '@dune/contracts'

import type { DbClient } from '../db'
import { AppError } from '../http/errors'
import { Prisma } from '../generated/prisma/client'
import { toManagerDto } from './serializer'

// Second tier of a listing's manager chain: one curated record per direction.
export class ManagerService {
  constructor(private readonly db: DbClient) {}

  async list() {
    const items = await this.db.manager.findMany({ orderBy: { direction: 'asc' } })
    return { items: items.map(toManagerDto) }
  }

  // Public lookup for a direction's manager; inactive records are hidden so the
  // card falls through to the company contact.
  async getByDirection(direction: PropertyDirection) {
    const manager = await this.db.manager.findUnique({ where: { direction } })
    if (!manager || !manager.active) {
      throw new AppError(404, 'NOT_FOUND', 'Manager not found')
    }
    return toManagerDto(manager)
  }

  async create(payload: CreateManagerPayload) {
    const manager = await this.db.manager.create({ data: payload }).catch((error: unknown) => {
      throw this.translateWriteError(error)
    })
    return toManagerDto(manager)
  }

  async update(id: string, payload: UpdateManagerPayload) {
    const manager = await this.db.manager
      .update({ where: { id }, data: payload })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new AppError(404, 'NOT_FOUND', 'Manager not found')
        }
        throw this.translateWriteError(error)
      })
    return toManagerDto(manager)
  }

  async delete(id: string) {
    await this.db.manager.delete({ where: { id } }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new AppError(404, 'NOT_FOUND', 'Manager not found')
      }
      throw error
    })
  }

  private translateWriteError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppError(409, 'CONFLICT', 'A manager for this direction already exists')
    }
    return error
  }
}
