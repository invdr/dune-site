import {
  apiErrorSchema,
  homeContentResponseSchema,
  publicSiteSettingsResponseSchema,
  siteSettingsResponseSchema,
  updateHomeContentSchema,
  updateSiteSettingsSchema,
} from '@dune/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { validationErrorHook } from '../http/errors'
import { requireAuth } from '../http/require-auth'
import type { SiteService } from './service'

type SiteRouteEnv = {
  Variables: {
    siteService: SiteService
    authService: AuthService
  }
}

const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }
const settingsContent = { 'application/json': { schema: siteSettingsResponseSchema } }
const homeContent = { 'application/json': { schema: homeContentResponseSchema } }

// --- Public: company contact + home content ---

const publicSettingsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: publicSiteSettingsResponseSchema } },
      description: 'Public company contact',
    },
  },
})

export function createPublicSiteRoutes() {
  const routes = new OpenAPIHono<SiteRouteEnv>({ defaultHook: validationErrorHook })
  routes.openapi(publicSettingsRoute, async (c) => {
    const settings = await c.get('siteService').getPublicSettings()
    return c.json({ settings }, 200)
  })
  return routes
}

const publicHomeRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: homeContent, description: 'Home page content' },
  },
})

export function createPublicHomeRoutes() {
  const routes = new OpenAPIHono<SiteRouteEnv>({ defaultHook: validationErrorHook })
  routes.openapi(publicHomeRoute, async (c) => {
    const content = await c.get('siteService').getHome()
    return c.json({ content }, 200)
  })
  return routes
}

// --- Admin: full settings ---

const getSettingsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: settingsContent, description: 'Site settings' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const updateSettingsRoute = createRoute({
  method: 'put',
  path: '/',
  request: { body: { content: { 'application/json': { schema: updateSiteSettingsSchema } } } },
  responses: {
    200: { content: settingsContent, description: 'Updated settings' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

export function createAdminSettingsRoutes() {
  const routes = new OpenAPIHono<SiteRouteEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)

  routes.openapi(getSettingsRoute, async (c) => {
    const settings = await c.get('siteService').getSettings()
    return c.json({ settings }, 200)
  })

  routes.openapi(updateSettingsRoute, async (c) => {
    const settings = await c.get('siteService').updateSettings(c.req.valid('json'))
    return c.json({ settings }, 200)
  })

  return routes
}

// --- Admin: home content ---

const getHomeRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: homeContent, description: 'Home content' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

const updateHomeRoute = createRoute({
  method: 'put',
  path: '/',
  request: { body: { content: { 'application/json': { schema: updateHomeContentSchema } } } },
  responses: {
    200: { content: homeContent, description: 'Updated home content' },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
  },
})

export function createAdminHomeRoutes() {
  const routes = new OpenAPIHono<SiteRouteEnv>({ defaultHook: validationErrorHook })
  routes.use('*', requireAuth)

  routes.openapi(getHomeRoute, async (c) => {
    const content = await c.get('siteService').getHome()
    return c.json({ content }, 200)
  })

  routes.openapi(updateHomeRoute, async (c) => {
    const content = await c.get('siteService').updateHome(c.req.valid('json'))
    return c.json({ content }, 200)
  })

  return routes
}
