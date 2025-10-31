import type { MiddlewareHandler } from 'hono';
import type { Env } from '~/types/env';

interface RateLimitOptions {
  limit?: number;
  window?: number; // in seconds
  keyPrefix?: string;
}

export function rateLimiter(options: RateLimitOptions = {}): MiddlewareHandler<{ Bindings: Env }> {
  const {
    limit = 60,
    window = 60,
    keyPrefix = 'ratelimit',
  } = options;

  return async (c, next) => {
    const env = c.env;
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const key = `${keyPrefix}:${ip}:${c.req.path}`;

    try {
      // Get current count from KV
      const current = await env.RATELIMIT_KV.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= limit) {
        return c.json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again later.`,
          retryAfter: window,
        }, 429);
      }

      // Increment counter
      await env.RATELIMIT_KV.put(
        key,
        String(count + 1),
        { expirationTtl: window }
      );

      // Add rate limit headers
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Remaining', String(limit - count - 1));
      c.header('X-RateLimit-Reset', String(Date.now() + window * 1000));

      await next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Continue on error to not block requests
      await next();
    }
  };
}

// Stricter rate limit for sensitive operations
export function strictRateLimiter(): MiddlewareHandler<{ Bindings: Env }> {
  return rateLimiter({
    limit: 5,
    window: 300, // 5 minutes
    keyPrefix: 'strict',
  });
}