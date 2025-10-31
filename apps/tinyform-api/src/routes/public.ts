import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { forms, formSubmissions } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimiter } from '~/middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// Rate limit public endpoints more strictly
app.use('*', rateLimiter({ limit: 30, window: 60 }));

// GET /public/:publicId - Get public form
app.get('/:publicId', async (c) => {
  const publicId = c.req.param('publicId');

  // Try to get from cache first
  const cached = await c.env.CACHE_KV.get(`form:${publicId}`);
  if (cached) {
    return c.json(JSON.parse(cached));
  }

  const db = createDb(c.env);

  // Get form from database
  const form = await db.query.forms.findFirst({
    where: eq(forms.publicId, publicId),
    columns: {
      id: true,
      publicId: true,
      title: true,
      description: true,
      schema: true,
      settings: true,
      status: true,
      requireAuth: true,
      maxSubmissions: true,
      submissionCount: true,
      expiresAt: true,
    },
  });

  if (!form) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Check if form is published
  if (form.status !== 'published') {
    throw new HTTPException(404, { message: 'Form is not published' });
  }

  // Check if form has expired
  if (form.expiresAt && new Date(form.expiresAt) < new Date()) {
    throw new HTTPException(410, { message: 'Form has expired' });
  }

  // Check submission limit
  if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
    throw new HTTPException(410, { message: 'Form has reached submission limit' });
  }

  // Increment submission count field which already exists in the schema
  // For now, we'll track views later when we add the viewCount field
  // TODO: Add viewCount field to schema

  // Cache for future requests
  await c.env.CACHE_KV.put(
    `form:${publicId}`,
    JSON.stringify({
      publicId: form.publicId,
      title: form.title,
      description: form.description,
      schema: form.schema,
      settings: form.settings,
      requireAuth: form.requireAuth,
    }),
    { expirationTtl: 3600 } // 1 hour
  );

  return c.json({
    publicId: form.publicId,
    title: form.title,
    description: form.description,
    schema: form.schema,
    settings: form.settings,
    requireAuth: form.requireAuth,
  });
});

// POST /public/:publicId/submit - Submit form
app.post('/:publicId/submit', async (c) => {
  const publicId = c.req.param('publicId');
  const body = await c.req.json();

  const db = createDb(c.env);

  // Get form
  const form = await db.query.forms.findFirst({
    where: eq(forms.publicId, publicId),
  });

  if (!form) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Validate form status
  if (form.status !== 'published') {
    throw new HTTPException(404, { message: 'Form is not published' });
  }

  // Check expiration
  if (form.expiresAt && new Date(form.expiresAt) < new Date()) {
    throw new HTTPException(410, { message: 'Form has expired' });
  }

  // Check submission limit
  if (form.maxSubmissions && form.submissionCount >= form.maxSubmissions) {
    throw new HTTPException(410, { message: 'Form has reached submission limit' });
  }

  // TODO: Validate submission data against form schema

  // Get metadata
  const metadata = {
    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
    userAgent: c.req.header('User-Agent'),
    referrer: c.req.header('Referer'),
    country: c.req.header('CF-IPCountry'),
    sessionId: c.req.header('X-Session-ID'),
  };

  // Save submission directly to database (queue can be added later)
  const [submission] = await db.insert(formSubmissions).values({
    formId: form.id,
    data: body,
    metadata,
    status: 'processed',
  }).returning();

  // Update submission count
  await db.update(forms)
    .set({
      submissionCount: form.submissionCount + 1,
      lastSubmissionAt: new Date(),
    })
    .where(eq(forms.id, form.id));

  return c.json({
    success: true,
    message: form.settings?.successMessage || 'Thank you for your submission!',
    redirectUrl: form.settings?.redirectUrl,
  });
});

// GET /public/:publicId/stats - Get public form stats (if enabled)
app.get('/:publicId/stats', async (c) => {
  const publicId = c.req.param('publicId');

  const db = createDb(c.env);

  const form = await db.query.forms.findFirst({
    where: eq(forms.publicId, publicId),
    columns: {
      submissionCount: true,
      maxSubmissions: true,
    },
  });

  if (!form) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  return c.json({
    submissions: form.submissionCount,
    remaining: form.maxSubmissions ? form.maxSubmissions - form.submissionCount : null,
  });
});

export default app;