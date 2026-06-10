import {
  apiErrorSchema,
  createLeadSchema,
  leadListQuerySchema,
  leadListResponseSchema,
  leadResponseSchema,
  updateLeadSchema,
} from '@dune/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import { createRateLimit } from '../http/rate-limit'
import { requireAuth } from '../http/require-auth'
import type { LeadService } from './service'

type LeadRouteEnv = {
  Variables: {
    leadService: LeadService
    authService: AuthService
  }
}

const leadResponseContent = { 'application/json': { schema: leadResponseSchema } }
const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

const idParamSchema = z.object({
  id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }),
})

// ---------------------------------------------------------------------------
// Public submission
// ---------------------------------------------------------------------------

const createLeadRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: createLeadSchema } } } },
  responses: {
    201: { content: leadResponseContent, description: 'Lead accepted' },
    400: { content: errorResponseContent, description: 'Invalid payload or missing consent' },
    429: { content: errorResponseContent, description: 'Too many requests' },
  },
})

export function createPublicLeadRoutes() {
  const routes = new OpenAPIHono<LeadRouteEnv>({ defaultHook: validationErrorHook })

  // Generous per-IP cap: NAT shares one IP across many real visitors, so the
  // honeypot (and manual SPAM marking) do the real anti-spam work.
  routes.use('*', createRateLimit({ limit: 10, windowMs: 60 * 60 * 1000 }))

  routes.openapi(createLeadRoute, async (c) => {
    const lead = await c.get('leadService').create(c.req.valid('json'))
    return c.json({ lead }, 201)
  })

  return routes
}

// ---------------------------------------------------------------------------
// Admin management
// ---------------------------------------------------------------------------

const listLeadsRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: leadListQuerySchema },
  responses: {
    200: { content: { 'application/json': { schema: leadListResponseSchema } }, description: 'Leads' },
    400: { content: errorResponseContent, description: 'Invalid query' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const updateLeadRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: updateLeadSchema } } },
  },
  responses: {
    200: { content: leadResponseContent, description: 'Updated lead' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Lead not found' },
  },
})

export function createAdminLeadRoutes() {
  const routes = new OpenAPIHono<LeadRouteEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listLeadsRoute, async (c) => {
    const result = await c.get('leadService').list(c.req.valid('query'))
    return c.json(result, 200)
  })

  routes.openapi(updateLeadRoute, async (c) => {
    const { id } = c.req.valid('param')
    const lead = await c.get('leadService').updateStatus(id, c.req.valid('json'))
    return c.json({ lead }, 200)
  })

  return routes
}
