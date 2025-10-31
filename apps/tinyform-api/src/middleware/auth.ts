import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verify } from 'hono/jwt';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { apiKeys } from '~/db/schema';

// JWT authentication middleware
export function requireAuth(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new HTTPException(401, { message: 'Unauthorized: No token provided' });
    }

    try {
      const payload = await verify(token, c.env.NEXTAUTH_SECRET);

      if (!payload.sub) {
        throw new HTTPException(401, { message: 'Unauthorized: Invalid token' });
      }

      // Add user ID to request
      c.set('userId', payload.sub as string);
      c.set('userPlan', payload.plan as string || 'free');

      await next();
    } catch (error) {
      throw new HTTPException(401, { message: 'Unauthorized: Invalid token' });
    }
  };
}

// Optional authentication - doesn't throw, just sets userId if available
export function optionalAuth(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const payload = await verify(token, c.env.NEXTAUTH_SECRET);
        if (payload.sub) {
          c.set('userId', payload.sub as string);
          c.set('userPlan', payload.plan as string || 'free');
        }
      } catch {
        // Ignore invalid tokens for optional auth
      }
    }

    await next();
  };
}

// API key authentication for programmatic access
export function requireApiKey(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const apiKey = c.req.header('X-API-Key');

    if (!apiKey) {
      throw new HTTPException(401, { message: 'Unauthorized: No API key provided' });
    }

    const db = createDb(c.env);

    // Find API key in database
    const key = await db.query.apiKeys.findFirst({
      where: (apiKeys, { and, eq, isNull, gt }) => and(
        eq(apiKeys.key, apiKey),
        isNull(apiKeys.revokedAt),
        gt(apiKeys.expiresAt, new Date())
      ),
    });

    if (!key) {
      throw new HTTPException(401, { message: 'Unauthorized: Invalid API key' });
    }

    // Update last used timestamp
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: key.usageCount + 1,
      })
      .where((apiKeys, { eq }) => eq(apiKeys.id, key.id));

    // Set user context
    c.set('userId', key.userId);
    c.set('apiKeyId', key.id);
    c.set('apiKeyScopes', key.scopes || []);

    await next();
  };
}

// Check if user has required plan
export function requirePlan(requiredPlans: string[]): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const userPlan = c.get('userPlan') || 'free';

    if (!requiredPlans.includes(userPlan)) {
      throw new HTTPException(403, {
        message: `This feature requires one of the following plans: ${requiredPlans.join(', ')}`
      });
    }

    await next();
  };
}

// Rate limit by user (stricter than IP-based)
export function userRateLimit(limit: number = 100): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const userId = c.get('userId');

    if (!userId) {
      await next();
      return;
    }

    const key = `user_ratelimit:${userId}:${c.req.path}`;
    const current = await c.env.RATELIMIT_KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      throw new HTTPException(429, {
        message: 'Rate limit exceeded for this user'
      });
    }

    await c.env.RATELIMIT_KV.put(
      key,
      String(count + 1),
      { expirationTtl: 3600 } // 1 hour window
    );

    await next();
  };
}