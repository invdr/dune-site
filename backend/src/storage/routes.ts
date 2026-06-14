import { apiErrorSchema, createUploadUrlSchema, presignedUploadResponseSchema } from '@dune/contracts'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import type { AuthService } from '../auth/service'
import { AppError, validationErrorHook } from '../http/errors'
import { requireAuth } from '../http/require-auth'
import { createStorageObjectKey, type StorageService } from './service'

type StorageRouteEnv = {
  Variables: {
    storageService: StorageService | null
    authService: AuthService
  }
}

const errorResponseContent = { 'application/json': { schema: apiErrorSchema } }

const createUploadUrlRoute = createRoute({
  method: 'post',
  path: '/',
  request: { body: { content: { 'application/json': { schema: createUploadUrlSchema } } } },
  responses: {
    201: {
      content: { 'application/json': { schema: presignedUploadResponseSchema } },
      description: 'Presigned upload target',
    },
    400: { content: errorResponseContent, description: 'Invalid payload' },
    401: { content: errorResponseContent, description: 'Authentication required' },
    503: { content: errorResponseContent, description: 'Object storage is not configured' },
  },
})

// Issues a short-lived presigned PUT URL so the admin can upload a photo straight
// to object storage, then persist the returned public URL on the listing.
export function createAdminUploadRoutes() {
  const routes = new OpenAPIHono<StorageRouteEnv>({ defaultHook: validationErrorHook })

  routes.use('*', requireAuth)

  routes.openapi(createUploadUrlRoute, async (c) => {
    const storageService = c.get('storageService')
    if (!storageService) {
      throw new AppError(
        503,
        'INTERNAL_ERROR',
        'Object storage is not configured. Set SPACES_* env vars or paste an image URL instead.',
      )
    }

    const { namespace, filename, contentType, byteSize } = c.req.valid('json')
    const key = createStorageObjectKey({ namespace, filename })
    const upload = await storageService.createUploadUrl({
      key,
      contentType,
      byteSize,
      visibility: 'public',
    })

    // Public-read uploads always carry a publicUrl; assert it for the contract.
    if (!upload.publicUrl) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Storage did not return a public URL')
    }

    return c.json({ upload: { ...upload, publicUrl: upload.publicUrl } }, 201)
  })

  return routes
}
