import {
  adminComplexListQuerySchema,
  apiErrorSchema,
  bulkCreateComplexesResultSchema,
  complexDetailResponseSchema,
  complexFacetsResponseSchema,
  complexListQuerySchema,
  complexListResponseSchema,
  complexResponseSchema,
  createComplexSchema,
  updateComplexSchema,
} from '@dune/contracts'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import { requireAuth } from '../http/require-auth'
import type { ComplexService } from './service'

type ComplexRouteEnv = {
  Variables: {
    complexService: ComplexService
    authService: AuthService
  }
}

const listResponseContent = { 'application/json': { schema: complexListResponseSchema } }
const complexResponseContent = { 'application/json': { schema: complexResponseSchema } }
const detailResponseContent = { 'application/json': { schema: complexDetailResponseSchema } }
const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

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
// Public (PUBLISHED complexes only)
// ---------------------------------------------------------------------------

const listPublicRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: complexListQuerySchema },
  responses: {
    200: { content: listResponseContent, description: 'Filtered list of published complexes' },
    400: { content: errorResponseContent, description: 'Invalid query' },
  },
})

// Static `/facets` must be registered before `/{slug}`, otherwise the slug
// param route would capture it.
const facetsRoute = createRoute({
  method: 'get',
  path: '/facets',
  responses: {
    200: {
      content: { 'application/json': { schema: complexFacetsResponseSchema } },
      description: 'Distinct filter facets across published complexes',
    },
  },
})

const getPublicRoute = createRoute({
  method: 'get',
  path: '/{slug}',
  request: { params: slugParamSchema },
  responses: {
    200: { content: detailResponseContent, description: 'Published complex with linked units' },
    404: { content: errorResponseContent, description: 'Complex not found' },
  },
})

export function createPublicComplexRoutes() {
  const routes = new OpenAPIHono<ComplexRouteEnv>({ defaultHook: validationErrorHook })

  routes.openapi(listPublicRoute, async (c) => {
    const result = await c.get('complexService').list(c.req.valid('query'), { publicOnly: true })
    return c.json(result, 200)
  })

  routes.openapi(facetsRoute, async (c) => {
    const facets = await c.get('complexService').facets()
    return c.json(facets, 200)
  })

  routes.openapi(getPublicRoute, async (c) => {
    const { slug } = c.req.valid('param')
    const complex = await c.get('complexService').getBySlug(slug, { publicOnly: true })
    return c.json({ complex }, 200)
  })

  return routes
}

// ---------------------------------------------------------------------------
// Admin CRUD (requires authentication; sees every status)
// ---------------------------------------------------------------------------

const listAdminRoute = createRoute({
  method: 'get',
  path: '/',
  request: { query: adminComplexListQuerySchema },
  responses: {
    200: { content: listResponseContent, description: 'Filtered list of all complexes' },
    400: { content: errorResponseContent, description: 'Invalid query' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const bulkRoute = createRoute({
  method: 'post',
  path: '/bulk',
  responses: {
    201: {
      content: { 'application/json': { schema: bulkCreateComplexesResultSchema } },
      description: 'Created draft complexes from new-build property names',
    },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const getAdminRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: idParamSchema },
  responses: {
    200: { content: complexResponseContent, description: 'Complex' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Complex not found' },
  },
})

const createComplexRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: createComplexSchema } } } },
  responses: {
    201: { content: complexResponseContent, description: 'Created complex' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    409: { content: errorResponseContent, description: 'Slug already exists' },
  },
})

const updateComplexRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: idParamSchema,
    body: { content: { 'application/json': { schema: updateComplexSchema } } },
  },
  responses: {
    200: { content: complexResponseContent, description: 'Updated complex' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Complex not found' },
    409: { content: errorResponseContent, description: 'Slug already exists' },
  },
})

const deleteComplexRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: idParamSchema },
  responses: {
    204: { description: 'Complex deleted' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    404: { content: errorResponseContent, description: 'Complex not found' },
  },
})

export function createAdminComplexRoutes() {
  const routes = new OpenAPIHono<ComplexRouteEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(listAdminRoute, async (c) => {
    const result = await c.get('complexService').list(c.req.valid('query'), { publicOnly: false })
    return c.json(result, 200)
  })

  routes.openapi(bulkRoute, async (c) => {
    const result = await c.get('complexService').bulkCreateFromProperties()
    return c.json(result, 201)
  })

  routes.openapi(getAdminRoute, async (c) => {
    const { id } = c.req.valid('param')
    const complex = await c.get('complexService').getById(id)
    return c.json({ complex }, 200)
  })

  routes.openapi(createComplexRoute, async (c) => {
    const complex = await c.get('complexService').create(c.req.valid('json'))
    return c.json({ complex }, 201)
  })

  routes.openapi(updateComplexRoute, async (c) => {
    const { id } = c.req.valid('param')
    const complex = await c.get('complexService').update(id, c.req.valid('json'))
    return c.json({ complex }, 200)
  })

  routes.openapi(deleteComplexRoute, async (c) => {
    const { id } = c.req.valid('param')
    await c.get('complexService').delete(id)
    return c.body(null, 204)
  })

  return routes
}
