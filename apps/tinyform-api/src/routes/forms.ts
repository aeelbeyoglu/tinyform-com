import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { createId } from '@paralleldrive/cuid2';
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { forms } from '~/db/schema';
import { requireAuth, requirePlan } from '~/middleware/auth';
import { eq, and, desc, count } from 'drizzle-orm';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// Validation schemas
const createFormSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  schema: z.any(), // Will be validated separately
  settings: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    submitButtonText: z.string().optional(),
    successMessage: z.string().optional(),
    redirectUrl: z.string().url().optional(),
  }).optional(),
});

const updateFormSchema = createFormSchema.partial();

// GET /forms - List user's forms
app.get('/', async (c) => {
  const userId = c.get('userId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '10');
  const status = c.req.query('status');

  const db = createDb(c.env);

  const conditions = [eq(forms.userId, userId)];
  if (status) {
    conditions.push(eq(forms.status, status));
  }

  const [formsList, totalCount] = await Promise.all([
    db.query.forms.findMany({
      where: and(...conditions),
      orderBy: [desc(forms.updatedAt)],
      limit,
      offset: (page - 1) * limit,
    }),
    db.select({ count: count() })
      .from(forms)
      .where(and(...conditions)),
  ]);

  return c.json({
    forms: formsList,
    pagination: {
      page,
      limit,
      total: totalCount[0]?.count || 0,
      totalPages: Math.ceil((totalCount[0]?.count || 0) / limit),
    },
  });
});

// POST /forms - Create a new form
app.post('/', async (c) => {
  const userId = c.get('userId');
  const userPlan = c.get('userPlan');
  const body = await c.req.json();

  const parsed = createFormSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues
    }, 400);
  }

  const db = createDb(c.env);

  // Check form limits for free users
  if (userPlan === 'free') {
    const formCount = await db.select({ count: count() })
      .from(forms)
      .where(eq(forms.userId, userId));

    const maxForms = parseInt(c.env.MAX_FORMS_FREE || '3');
    if (formCount[0].count >= maxForms) {
      throw new HTTPException(403, {
        message: `Free plan is limited to ${maxForms} forms. Please upgrade to create more forms.`
      });
    }
  }

  // Create form
  const publicId = createId().slice(0, 12);
  const [newForm] = await db.insert(forms).values({
    ...parsed.data,
    userId,
    publicId,
    schema: parsed.data.schema || { fields: [] },
    settings: parsed.data.settings || {},
  }).returning();

  return c.json(newForm, 201);
});

// GET /forms/:id - Get a single form
app.get('/:id', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');

  const db = createDb(c.env);

  const form = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
    with: {
      webhooks: true,
    },
  });

  if (!form) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  return c.json(form);
});

// PUT /forms/:id - Update a form
app.put('/:id', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');
  const body = await c.req.json();

  const parsed = updateFormSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({
      error: 'Validation error',
      issues: parsed.error.issues
    }, 400);
  }

  const db = createDb(c.env);

  // Check ownership
  const existingForm = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
  });

  if (!existingForm) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Update form
  const [updatedForm] = await db.update(forms)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(forms.id, formId))
    .returning();

  return c.json(updatedForm);
});

// DELETE /forms/:id - Delete a form
app.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');

  const db = createDb(c.env);

  // Check ownership
  const existingForm = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
  });

  if (!existingForm) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Delete form (cascade will handle related records)
  await db.delete(forms).where(eq(forms.id, formId));

  return c.json({ success: true });
});

// POST /forms/:id/publish - Publish a form
app.post('/:id/publish', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');

  const db = createDb(c.env);

  // Check ownership
  const existingForm = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
  });

  if (!existingForm) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Update form status
  const [publishedForm] = await db.update(forms)
    .set({
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(forms.id, formId))
    .returning();

  // Cache in KV for faster access
  await c.env.CACHE_KV.put(
    `form:${publishedForm.publicId}`,
    JSON.stringify({
      schema: publishedForm.schema,
      settings: publishedForm.settings,
    }),
    { expirationTtl: 3600 } // 1 hour cache
  );

  return c.json({
    ...publishedForm,
    publicUrl: `${c.env.APP_URL}/f/${publishedForm.publicId}`,
  });
});

// POST /forms/:id/duplicate - Duplicate a form
app.post('/:id/duplicate', requirePlan(['pro', 'enterprise']), async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');

  const db = createDb(c.env);

  // Get original form
  const originalForm = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
  });

  if (!originalForm) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Create duplicate
  const publicId = createId().slice(0, 12);
  const [duplicatedForm] = await db.insert(forms).values({
    userId,
    publicId,
    title: `${originalForm.title} (Copy)`,
    description: originalForm.description,
    schema: originalForm.schema,
    settings: originalForm.settings,
    status: 'draft',
  }).returning();

  return c.json(duplicatedForm, 201);
});

// POST /forms/:id/archive - Archive a form
app.post('/:id/archive', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('id');

  const db = createDb(c.env);

  // Check ownership and update status
  const [archivedForm] = await db.update(forms)
    .set({
      status: 'archived',
      updatedAt: new Date(),
    })
    .where(and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ))
    .returning();

  if (!archivedForm) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  return c.json(archivedForm);
});

export default app;