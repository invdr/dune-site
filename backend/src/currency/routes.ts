import { fxContextResponseSchema } from '@dune/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { validationErrorHook } from '../http/errors'
import type { CurrencyService } from './service'

type FxRouteEnv = {
  Variables: {
    currencyService: CurrencyService
  }
}

const fxContextRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: { 'application/json': { schema: fxContextResponseSchema } },
      description: 'Current FX context (USD→RUB incl. surcharge, pegged locals)',
    },
  },
})

// Public FX snapshot so non-listing surfaces (e.g. a catalog price slider) can
// convert without re-deriving the rate rules.
export function createPublicFxRoutes() {
  const routes = new OpenAPIHono<FxRouteEnv>({ defaultHook: validationErrorHook })
  routes.openapi(fxContextRoute, async (c) => {
    const fx = await c.get('currencyService').getFxContext()
    return c.json({ fx }, 200)
  })
  return routes
}
