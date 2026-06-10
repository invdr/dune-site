import { apiErrorSchema, resolvedContactResponseSchema, type ResolvedContactDto } from '@dune/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { ManagerService } from '../managers/service'
import type { PropertyService } from '../properties/service'
import type { SiteService } from '../site/service'
import { validationErrorHook } from '../http/errors'

type ContactRouteEnv = {
  Variables: {
    propertyService: PropertyService
    managerService: ManagerService
    siteService: SiteService
  }
}

// Slug pattern mirrors `propertySlugSchema`; rebuilt with the backend `z` so
// `.openapi()` is available.
const slugParamSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .openapi({ param: { name: 'slug', in: 'path' } }),
})

const resolveRoute = createRoute({
  method: 'get',
  path: '/property/{slug}',
  request: { params: slugParamSchema },
  responses: {
    200: {
      content: { 'application/json': { schema: resolvedContactResponseSchema } },
      description: 'Resolved contact for the property card (personal → direction → company)',
    },
    404: { content: { 'application/json': { schema: apiErrorSchema } }, description: 'Property not found' },
  },
})

// Resolves the single contact to show on a property card, applying the agreed
// precedence once on the server so the frontend never re-implements it:
//   personal manager (object) → direction manager → company contact.
export function createPublicContactRoutes() {
  const routes = new OpenAPIHono<ContactRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(resolveRoute, async (c) => {
    const { slug } = c.req.valid('param')
    const property = await c.get('propertyService').getBySlug(slug, { publicOnly: true })

    let contact: ResolvedContactDto | null = null

    if (property.managerName) {
      contact = {
        source: 'personal',
        name: property.managerName,
        phone: property.managerPhone,
        photo: property.managerPhotoUrl,
        contact: null,
      }
    } else {
      const manager = await c.get('managerService').findActiveByDirection(property.direction)
      if (manager) {
        contact = { source: 'direction', name: manager.name, phone: manager.phone, photo: manager.photo, contact: manager.contact }
      } else {
        const settings = await c.get('siteService').getPublicSettings()
        if (settings.companyName || settings.companyPhone || settings.companyContact) {
          contact = {
            source: 'company',
            name: settings.companyName ?? 'DUNE',
            phone: settings.companyPhone,
            photo: null,
            contact: settings.companyContact,
          }
        }
      }
    }

    return c.json({ contact }, 200)
  })

  return routes
}
