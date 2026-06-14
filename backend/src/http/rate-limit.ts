import type { MiddlewareHandler } from 'hono'

import { AppError } from './errors'

type RateLimitOptions = {
  // Max requests allowed per IP within the window.
  limit: number
  // Sliding window length in milliseconds.
  windowMs: number
}

// Best-effort client IP from common proxy headers, falling back to a constant so
// the limiter still degrades to a global bucket rather than crashing.
function clientIp(headerValue: string | undefined, realIp: string | undefined): string {
  const forwarded = headerValue?.split(',')[0]?.trim()
  return forwarded || realIp?.trim() || 'unknown'
}

// In-memory per-IP sliding-window limiter. Deliberately generous (mobile/office
// NAT shares one IP across many real visitors); spam is caught by the honeypot
// and manual SPAM marking, not by a tight cap. Single-process only — adequate
// for the monolithic backend; revisit if the API is ever horizontally scaled.
export function createRateLimit(options: RateLimitOptions): MiddlewareHandler {
  const hits = new Map<string, number[]>()

  return async (c, next) => {
    const ip = clientIp(c.req.header('x-forwarded-for'), c.req.header('x-real-ip'))
    const now = Date.now()
    const windowStart = now - options.windowMs

    const recent = (hits.get(ip) ?? []).filter((ts) => ts > windowStart)

    if (recent.length >= options.limit) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')
    }

    recent.push(now)
    hits.set(ip, recent)

    // Opportunistic cleanup so the map does not grow unbounded.
    if (hits.size > 10_000) {
      for (const [key, value] of hits) {
        const live = value.filter((ts) => ts > windowStart)
        if (live.length === 0) hits.delete(key)
        else hits.set(key, live)
      }
    }

    await next()
  }
}
