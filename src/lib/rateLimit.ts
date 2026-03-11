/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Each user gets a window of `windowMs` milliseconds in which they can make
 * up to `maxRequests` requests. Oldest timestamps are pruned on every check.
 *
 * For serverless (Vercel): each instance keeps its own map, so the effective
 * limit is per-instance. This is still useful because a single abusive client
 * will usually hit the same instance during a burst. For stricter global
 * limits, swap this for Upstash Redis ratelimit later.
 */

interface RateLimitConfig {
  /** Time window in milliseconds (default 60 000 = 1 minute) */
  windowMs?: number
  /** Max requests per window per user (default 15) */
  maxRequests?: number
}

interface WindowEntry {
  timestamps: number[]
}

const stores = new Map<string, Map<string, WindowEntry>>()

// Periodic cleanup to prevent memory leaks from inactive users.
// Runs every 5 minutes and removes entries older than 10 minutes.
const CLEANUP_INTERVAL = 5 * 60 * 1000
const CLEANUP_MAX_AGE = 10 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [, store] of stores) {
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < CLEANUP_MAX_AGE)
      if (entry.timestamps.length === 0) store.delete(key)
    }
  }
}, CLEANUP_INTERVAL).unref?.() // .unref() so the timer doesn't keep Node alive

/**
 * Creates a rate limiter instance. Call the returned function with a user ID
 * to check whether the request is allowed.
 *
 * Usage in an API route:
 * ```ts
 * import { createRateLimit } from '@/lib/rateLimit'
 * const rateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 10 })
 *
 * export async function POST(req: Request) {
 *   const userId = ... // from auth
 *   const { allowed, retryAfterMs } = rateLimit(userId)
 *   if (!allowed) {
 *     return new Response(JSON.stringify({ error: 'Too many requests' }), {
 *       status: 429,
 *       headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) },
 *     })
 *   }
 *   // ... handle request
 * }
 * ```
 */
export function createRateLimit(config: RateLimitConfig = {}) {
  const windowMs = config.windowMs ?? 60_000
  const maxRequests = config.maxRequests ?? 15

  // Each limiter gets its own store keyed by a unique id
  const storeKey = `rl_${Date.now()}_${Math.random()}`
  const store = new Map<string, WindowEntry>()
  stores.set(storeKey, store)

  return function checkRateLimit(userId: string): {
    allowed: boolean
    remaining: number
    retryAfterMs: number
  } {
    const now = Date.now()
    let entry = store.get(userId)
    if (!entry) {
      entry = { timestamps: [] }
      store.set(userId, entry)
    }

    // Prune timestamps outside the window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs)

    if (entry.timestamps.length >= maxRequests) {
      // Find how long until the oldest timestamp expires
      const oldest = entry.timestamps[0]
      const retryAfterMs = windowMs - (now - oldest)
      return { allowed: false, remaining: 0, retryAfterMs }
    }

    entry.timestamps.push(now)
    return {
      allowed: true,
      remaining: maxRequests - entry.timestamps.length,
      retryAfterMs: 0,
    }
  }
}
