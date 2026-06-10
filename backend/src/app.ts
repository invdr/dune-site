import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import type { DbClient } from './db'
import type { AppEnv } from './env'
import { createAuthRoutes } from './auth/routes'
import { AuthService } from './auth/service'
import { createPublicContactRoutes } from './contacts/routes'
import { CurrencyService } from './currency/service'
import { createPublicFxRoutes } from './currency/routes'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { LeadService } from './leads/service'
import { createAdminLeadRoutes, createPublicLeadRoutes } from './leads/routes'
import { ManagerService } from './managers/service'
import { createAdminManagerRoutes, createPublicManagerRoutes } from './managers/routes'
import { PropertyService } from './properties/service'
import { createAdminPropertyRoutes, createPublicPropertyRoutes } from './properties/routes'
import { SiteService } from './site/service'
import {
  createAdminHomeRoutes,
  createAdminSettingsRoutes,
  createPublicHomeRoutes,
  createPublicSiteRoutes,
} from './site/routes'
import { createAdminUploadRoutes } from './storage/routes'
import { createStorageServiceFromEnv, type StorageService } from './storage/service'

type AppBindings = {
  Variables: {
    authService: AuthService
    propertyService: PropertyService
    currencyService: CurrencyService
    leadService: LeadService
    managerService: ManagerService
    siteService: SiteService
    env: AppEnv
    storageService: StorageService | null
  }
}

type CreateAppOptions = {
  env: AppEnv
  prisma: DbClient
}

export function createApp({ env, prisma }: CreateAppOptions) {
  const authService = new AuthService(prisma, env)
  const currencyService = new CurrencyService(prisma)
  const propertyService = new PropertyService(prisma, currencyService)
  const leadService = new LeadService(prisma)
  const managerService = new ManagerService(prisma)
  const siteService = new SiteService(prisma)
  const storageService = createStorageServiceFromEnv(env)
  const app = new OpenAPIHono<AppBindings>({
    defaultHook: validationErrorHook,
  })

  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Platform'],
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  app.use('*', async (c, next) => {
    c.set('authService', authService)
    c.set('propertyService', propertyService)
    c.set('currencyService', currencyService)
    c.set('leadService', leadService)
    c.set('managerService', managerService)
    c.set('siteService', siteService)
    c.set('env', env)
    c.set('storageService', storageService)
    await next()
  })

  app.get('/', (c) => {
    return c.json({
      name: 'web_app_demo backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  app.route('/api/auth', createAuthRoutes())
  app.route('/api/properties', createPublicPropertyRoutes())
  app.route('/api/admin/properties', createAdminPropertyRoutes())
  app.route('/api/fx', createPublicFxRoutes())
  app.route('/api/leads', createPublicLeadRoutes())
  app.route('/api/admin/leads', createAdminLeadRoutes())
  app.route('/api/managers', createPublicManagerRoutes())
  app.route('/api/admin/managers', createAdminManagerRoutes())
  app.route('/api/contacts', createPublicContactRoutes())
  app.route('/api/site', createPublicSiteRoutes())
  app.route('/api/home', createPublicHomeRoutes())
  app.route('/api/admin/settings', createAdminSettingsRoutes())
  app.route('/api/admin/home', createAdminHomeRoutes())
  app.route('/api/admin/uploads', createAdminUploadRoutes())

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'web_app_demo API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

export type AppType = ReturnType<typeof createApp>
