import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { users, apiKeys } from '~/db/schema';
import { requireAuth } from '~/middleware/auth';
import { eq, and } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// Validation schemas
const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  username: z.string().min(3).max(50).optional(),
  bio: z.string().max(500).optional(),
  metadata: z.object({
    timezone: z.string().optional(),
    language: z.string().optional(),
    preferences: z.any().optional(),
  }).optional(),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
  expiresIn: z.number().optional(), // days
});

// GET /users/me - Get current user profile
app.get('/me', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      emailVerified: true,
      username: true,
      name: true,
      image: true,
      bio: true,
      plan: true,
      metadata: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

// PUT /users/me - Update current user profile
app.put('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();

  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues,
    }, 400);
  }

  const db = createDb(c.env);

  // Check username uniqueness if provided
  if (parsed.data.username) {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, parsed.data.username),
    });

    if (existing && existing.id !== userId) {
      return c.json({
        error: 'Username already taken',
      }, 409);
    }
  }

  // Update user
  const [updatedUser] = await db.update(users)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return c.json({
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      name: updatedUser.name,
      image: updatedUser.image,
      bio: updatedUser.bio,
      plan: updatedUser.plan,
      metadata: updatedUser.metadata,
    },
  });
});

// GET /users/me/api-keys - List user's API keys
app.get('/me/api-keys', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  const keys = await db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, userId),
    columns: {
      id: true,
      name: true,
      key: false, // Don't return the actual key
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      revokedAt: true,
    },
  });

  return c.json({ apiKeys: keys });
});

// POST /users/me/api-keys - Create new API key
app.post('/me/api-keys', async (c) => {
  const userId = c.get('userId');
  const userPlan = c.get('userPlan');
  const body = await c.req.json();

  // Only pro and enterprise users can create API keys
  if (userPlan === 'free') {
    return c.json({
      error: 'API keys are only available for Pro and Enterprise plans',
    }, 403);
  }

  const parsed = createApiKeySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues,
    }, 400);
  }

  const db = createDb(c.env);

  // Generate API key
  const key = `tk_${createId()}`;
  const hashedKey = await hashApiKey(key);

  // Calculate expiration
  const expiresAt = parsed.data.expiresIn
    ? new Date(Date.now() + parsed.data.expiresIn * 24 * 60 * 60 * 1000)
    : null;

  // Create API key
  const [newApiKey] = await db.insert(apiKeys).values({
    userId,
    name: parsed.data.name,
    key,
    hashedKey,
    scopes: parsed.data.scopes || [],
    expiresAt,
  }).returning();

  return c.json({
    apiKey: {
      id: newApiKey.id,
      name: newApiKey.name,
      key, // Only return the key once during creation
      scopes: newApiKey.scopes,
      expiresAt: newApiKey.expiresAt,
      createdAt: newApiKey.createdAt,
    },
    message: 'Save this API key securely. You won\'t be able to see it again.',
  }, 201);
});

// DELETE /users/me/api-keys/:id - Revoke API key
app.delete('/me/api-keys/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  const db = createDb(c.env);

  // Check ownership and revoke
  const [revokedKey] = await db.update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(apiKeys.id, keyId),
      eq(apiKeys.userId, userId)
    ))
    .returning();

  if (!revokedKey) {
    return c.json({ error: 'API key not found' }, 404);
  }

  return c.json({ success: true });
});

// DELETE /users/me - Delete user account
app.delete('/me', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env);

  // Delete user (cascade will handle related records)
  await db.delete(users).where(eq(users.id, userId));

  return c.json({ success: true, message: 'Account deleted successfully' });
});

// Helper function to hash API key
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default app;