import { createRateLimit } from '@/lib/rateLimit'

/**
 * Pre-configured rate limiters for different route types.
 *
 * Chat routes:   10 requests per minute per user
 * Translation:   8 requests per minute per user
 * Document:      5 requests per minute per user (heavy operations)
 * Upload:        20 requests per minute per user
 */
export const chatRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 10 })
export const translationRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 8 })
export const documentRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 5 })
export const uploadRateLimit = createRateLimit({ windowMs: 60_000, maxRequests: 20 })

/**
 * Returns a 429 Response if the user has exceeded their rate limit.
 * Returns null if the request is allowed.
 */
export function checkRateLimitOrRespond(
  limiter: ReturnType<typeof createRateLimit>,
  userId: string,
): Response | null {
  const { allowed, retryAfterMs } = limiter(userId)
  if (!allowed) {
    return new Response(
      JSON.stringify({
        error: 'Too many requests. Please wait before trying again.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        },
      },
    )
  }
  return null
}
