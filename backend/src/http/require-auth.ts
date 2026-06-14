import type { MiddlewareHandler } from 'hono'

import type { AuthService } from '../auth/service'

type RequireAuthEnv = {
  Variables: {
    authService: AuthService
  }
}

// Verifies the bearer access token and rejects the request when it is missing
// or invalid. Authenticated users are the admins managing the catalog.
export const requireAuth: MiddlewareHandler<RequireAuthEnv> = async (c, next) => {
  const authorization = c.req.header('authorization')
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined

  // Delegates validation (and 401 on failure) to the auth service.
  await c.get('authService').getMe(token)

  await next()
}
