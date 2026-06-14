import {
  adminPropertyListQuerySchema,
  apiErrorSchema,
  createPropertySchema,
  propertyCitiesResponseSchema,
  propertyListQuerySchema,
  propertyListResponseSchema,
  propertyResponseSchema,
  updatePropertySchema,
} from '@dune/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import { requireAuth } from '../http/require-auth'
import type { PropertyService } from './service'

type PropertyRouteEnv = {
  Variables: {
    propertyService: PropertyService
    authService: AuthService
  }
}

const listResponseContent = {
  'application/json': { schema: propertyListResponseSchema },
}
const propertyResponseContent = {
  'application/json': { schema: propertyResponseSchema },
}
const errorResponseContent = {
  'application/json': { schema: apiErrorSchema },
}

// Param schemas are built with the backend's `@hono/zod-openapi` `z` so the
// `.openapi()` decorator is available; the contracts package ships its own zod
// copy, whose instances don't carry that extension. The slug pattern mirrors
// `propertySlugSchema` in @dune/contracts.
const slugParamSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .openapi({ param: { name: 'slug', in: 'path' } }),
})

const idParamSchema = z.object({
  id: z.string().uuid().openapi({ param: { name: 'id', in: 'path' } }),
})

// ---------------------------------------------------------------------------
// Public catalog (PUBLISHED listings only)
// ---------------------------------------------------------------------------

const listPublicRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: propertyListQuerySchema },
  responses: {
    200: { content: listResponseContent, description: 'Filtered list of published properties' },
    400: { content: errorResponseContent, description: 'Invalid query' },
  },
})

// Static `/cities` must be registered before `/{slug}`, otherwise the slug
// param route would capture it.
const citiesRoute = createRoute({
  method: 'get',
  path: '/cities',
  responses: {
    200: {
      content: { 'application/json': { schema: propertyCitiesResponseSchema } },
      description: 'Distinct published cities per country',
    },
  },
})

const getPublicRoute = createRoute({
  method: 'get',
  path: '/{slug}',
  request: { params: slugParamSchema },
  responses: {
    200: { content: propertyResponseContent, description: 'Published property' },
    404: { content: errorResponseContent, description: 'Property not found' },
  },
})

export function createPublicPropertyRoutes() {
  const routes = new OpenAPIHono<PropertyRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(listPublicRoute, async (c) => {
    const result = await c.get('propertyService').list(c.req.valid('query'), { publicOnly: true })
    return c.json(result, 200)
  })

  routes.openapi(citiesRoute, async (c) => {
    const cities = await c.get('propertyService').cities()
    return c.json({ cities }, 200)
  })

  routes.openapi(getPublicRoute, async (c) => {
    const { slug } = c.req.valid('param')
    const property = await c.get('propertyService').getBySlug(slug, { publicOnly: true })
    return c.json({ property }, 200)
  })

  return routes
}

// ---------------------------------------------------------------------------
// Admin CRUD (requires authentication; sees every status)
// ---------------------------------------------------------------------------

const listAdminRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: adminPropertyListQuerySchema },
  responses: {
    200: { content: listResponseContent, description: 'Filtered list of all properties' },
    400: { content: errorResponseContent, description: 'Invalid query' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const getAdminRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: idParamSchema },
  responses: {
    200: { content: propertyResponseContent, description: 'Property' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Property not found' },
  },
})

const createPropertyRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: createPropertySchema } } },
  },
  responses: {
    201: { content: propertyResponseContent, description: 'Created property' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    409: { content: errorResponseContent, description: 'Slug already exists' },
  },
})

const updatePropertyRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: updatePropertySchema } } },
  },
  responses: {
    200: { content: propertyResponseContent, description: 'Updated property' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Property not found' },
    409: { content: errorResponseContent, description: 'Slug already exists' },
  },
})

const deletePropertyRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: idParamSchema },
  responses: {
    204: { description: 'Property deleted' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Property not found' },
  },
})

export function createAdminPropertyRoutes() {
  const routes = new OpenAPIHono<PropertyRouteEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listAdminRoute, async (c) => {
    const result = await c.get('propertyService').list(c.req.valid('query'), { publicOnly: false })
    return c.json(result, 200)
  })

  routes.openapi(getAdminRoute, async (c) => {
    const { id } = c.req.valid('param')
    const property = await c.get('propertyService').getById(id)
    return c.json({ property }, 200)
  })

  routes.openapi(createPropertyRoute, async (c) => {
    const property = await c.get('propertyService').create(c.req.valid('json'))
    return c.json({ property }, 201)
  })

  routes.openapi(updatePropertyRoute, async (c) => {
    const { id } = c.req.valid('param')
    const property = await c.get('propertyService').update(id, c.req.valid('json'))
    return c.json({ property }, 200)
  })

  routes.openapi(deletePropertyRoute, async (c) => {
    const { id } = c.req.valid('param')
    await c.get('propertyService').delete(id)
    return c.body(null, 204)
  })

  return routes
}
