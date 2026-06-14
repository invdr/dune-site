import {
  apiErrorSchema,
  createManagerSchema,
  managerListResponseSchema,
  managerResponseSchema,
  updateManagerSchema,
} from '@dune/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import { requireAuth } from '../http/require-auth'
import type { ManagerService } from './service'

type ManagerRouteEnv = {
  Variables: {
    managerService: ManagerService
    authService: AuthService
  }
}

const managerResponseContent = { 'application/json': { schema: managerResponseSchema } }
const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

const idParamSchema = z.object({
  id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }),
})
// Rebuilt with the backend's `z` (from @hono/zod-openapi) so `.openapi()` is
// available; the @dune/contracts zod copy does not carry that extension. Mirrors
// `propertyDirectionSchema` in the contracts package.
const directionParamSchema = z.object({
  direction: z
    .enum(['NEW', 'RESALE', 'DUBAI', 'SAUDI'])
    .openapi({ param: { name: 'direction', in: 'path' } }),
})

// ---------------------------------------------------------------------------
// Public: a direction's active manager (for the property card)
// ---------------------------------------------------------------------------

const getByDirectionRoute = createRoute({
  method: 'get',
  path: '/{direction}',
  request: { params: directionParamSchema },
  responses: {
    200: { content: managerResponseContent, description: 'Direction manager' },
    404: { content: errorResponseContent, description: 'Manager not found' },
  },
})

export function createPublicManagerRoutes() {
  const routes = new OpenAPIHono<ManagerRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(getByDirectionRoute, async (c) => {
    const { direction } = c.req.valid('param')
    const manager = await c.get('managerService').getByDirection(direction)
    return c.json({ manager }, 200)
  })

  return routes
}

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

const listRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: { 'application/json': { schema: managerListResponseSchema } }, description: 'Managers' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const createManagerRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: createManagerSchema } } } },
  responses: {
    201: { content: managerResponseContent, description: 'Created manager' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    409: { content: errorResponseContent, description: 'Direction already has a manager' },
  },
})

const updateManagerRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: updateManagerSchema } } },
  },
  responses: {
    200: { content: managerResponseContent, description: 'Updated manager' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Manager not found' },
    409: { content: errorResponseContent, description: 'Direction already has a manager' },
  },
})

const deleteManagerRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: idParamSchema },
  responses: {
    204: { description: 'Manager deleted' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Manager not found' },
  },
})

export function createAdminManagerRoutes() {
  const routes = new OpenAPIHono<ManagerRouteEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listRoute, async (c) => {
    const result = await c.get('managerService').list()
    return c.json(result, 200)
  })

  routes.openapi(createManagerRoute, async (c) => {
    const manager = await c.get('managerService').create(c.req.valid('json'))
    return c.json({ manager }, 201)
  })

  routes.openapi(updateManagerRoute, async (c) => {
    const { id } = c.req.valid('param')
    const manager = await c.get('managerService').update(id, c.req.valid('json'))
    return c.json({ manager }, 200)
  })

  routes.openapi(deleteManagerRoute, async (c) => {
    const { id } = c.req.valid('param')
    await c.get('managerService').delete(id)
    return c.body(null, 204)
  })

  return routes
}
