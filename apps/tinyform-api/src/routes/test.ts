import { Hono } from 'hono';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { users } from '~/db/schema';

const test = new Hono<{ Bindings: Env }>();

// Test database connection
test.get('/db', async (c) => {
  try {
    const db = createDb(c.env);

    // Try a simple query
    const result = await db.execute('SELECT 1 as test');

    return c.json({
      status: 'connected',
      result: result,
      database_url_exists: !!c.env.DATABASE_URL,
      database_url_length: c.env.DATABASE_URL?.length || 0,
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      message: error.message,
      database_url_exists: !!c.env.DATABASE_URL,
      database_url_length: c.env.DATABASE_URL?.length || 0,
    }, 500);
  }
});

// Test creating a user directly
test.post('/create-user', async (c) => {
  try {
    const db = createDb(c.env);

    // Create a test user
    const [newUser] = await db.insert(users).values({
      email: 'direct-test@example.com',
      name: 'Direct Test User',
    }).returning();

    return c.json({
      status: 'success',
      user: newUser,
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      message: error.message,
      stack: error.stack,
    }, 500);
  }
});

// Test raw body parsing
test.post('/echo', async (c) => {
  try {
    const text = await c.req.text();
    const headers = Object.fromEntries(c.req.raw.headers.entries());

    return c.json({
      raw_body: text,
      body_length: text.length,
      content_type: c.req.header('content-type'),
      headers: headers,
    });
  } catch (error: any) {
    return c.json({
      error: 'Failed to read body',
      message: error.message,
    }, 500);
  }
});

export default test;