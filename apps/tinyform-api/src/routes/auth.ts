import { Hono } from 'hono';
import { z } from 'zod';
import { sign, verify } from 'hono/jwt';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { users } from '~/db/schema';
import { strictRateLimiter } from '~/middleware/rate-limit';
import { hashPassword, verifyPassword, validatePasswordStrength } from '~/lib/password';

const auth = new Hono<{ Bindings: Env }>();

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(8).max(100),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Custom sign up endpoint (for email/password)
auth.post('/signup', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch (error) {
    return c.json({
      error: 'Invalid JSON',
      message: 'Failed to parse request body',
    }, 400);
  }
  const parsed = signUpSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues
    }, 400);
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(parsed.data.password);
  if (!passwordValidation.valid) {
    return c.json({
      error: 'Weak password',
      issues: passwordValidation.errors
    }, 400);
  }

  const db = createDb(c.env);

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, parsed.data.email),
  });

  if (existingUser) {
    throw new HTTPException(409, { message: 'User already exists' });
  }

  // Hash password
  const hashedPassword = await hashPassword(parsed.data.password);

  // Create user
  const [newUser] = await db.insert(users).values({
    email: parsed.data.email,
    name: parsed.data.name,
    password: hashedPassword,
  }).returning();

  // Generate JWT token
  const token = await sign(
    {
      sub: newUser.id,
      email: newUser.email,
      plan: newUser.plan,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    },
    c.env.NEXTAUTH_SECRET
  );

  return c.json({
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      plan: newUser.plan,
    },
    token,
  });
});

// Custom sign in endpoint (for API access)
auth.post('/signin', strictRateLimiter(), async (c) => {
  const body = await c.req.json();
  const parsed = signInSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues
    }, 400);
  }

  const db = createDb(c.env);

  // Find user
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, parsed.data.email),
  });

  if (!user || !user.password) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Verify password
  const isPasswordValid = await verifyPassword(parsed.data.password, user.password);
  if (!isPasswordValid) {
    throw new HTTPException(401, { message: 'Invalid credentials' });
  }

  // Update last login
  const { eq } = await import('drizzle-orm');
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  // Generate JWT token
  const token = await sign(
    {
      sub: user.id,
      email: user.email,
      plan: user.plan,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
    },
    c.env.NEXTAUTH_SECRET
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    },
    token,
  });
});

// Get current session
auth.get('/session', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return c.json({ user: null });
  }

  try {
    const payload = await verify(token, c.env.NEXTAUTH_SECRET);

    if (!payload.sub) {
      return c.json({ user: null });
    }

    const db = createDb(c.env);
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, payload.sub as string),
    });

    if (!user) {
      return c.json({ user: null });
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        plan: user.plan,
      },
    });
  } catch {
    return c.json({ user: null });
  }
});

// Refresh token
auth.post('/refresh', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    throw new HTTPException(401, { message: 'No token provided' });
  }

  try {
    const payload = await verify(token, c.env.NEXTAUTH_SECRET);

    if (!payload.sub) {
      throw new HTTPException(401, { message: 'Invalid token' });
    }

    const db = createDb(c.env);
    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, payload.sub as string),
    });

    if (!user) {
      throw new HTTPException(401, { message: 'User not found' });
    }

    // Generate new token
    const newToken = await sign(
      {
        sub: user.id,
        email: user.email,
        plan: user.plan,
        exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      },
      c.env.NEXTAUTH_SECRET
    );

    return c.json({ token: newToken });
  } catch {
    throw new HTTPException(401, { message: 'Invalid token' });
  }
});

// Sign out (optional - mainly for session cleanup)
auth.post('/signout', async (c) => {
  // In a JWT-based system, sign out is handled client-side
  // But we can use this to clean up server-side sessions if needed
  return c.json({ success: true });
});

export default auth;