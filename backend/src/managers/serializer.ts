import type { ManagerDto } from '@dune/contracts'

import type { Manager } from '../generated/prisma/client'

export function toManagerDto(manager: Manager): ManagerDto {
  return {
    id: manager.id,
    direction: manager.direction,
    name: manager.name,
    photo: manager.photo,
    phone: manager.phone,
    contact: manager.contact,
    active: manager.active,
    createdAt: manager.createdAt.toISOString(),
    updatedAt: manager.updatedAt.toISOString(),
  }
}
