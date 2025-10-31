import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '~/types/env';
import { requireAuth } from '~/middleware/auth';
import { createDb } from '~/db';
import { forms, formSubmissions } from '~/db/schema';
import { eq, desc, and, or, ilike, sql } from 'drizzle-orm';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// GET /forms/:formId/submissions - List submissions for a form
app.get('/forms/:formId/submissions', async (c) => {
  const userId = c.get('userId');
  const formId = c.req.param('formId');

  const page = parseInt(c.req.query('page') || '1');
  const limit = parseInt(c.req.query('limit') || '50');
  const search = c.req.query('search');
  const status = c.req.query('status');

  const db = createDb(c.env);

  // Verify form ownership
  const form = await db.query.forms.findFirst({
    where: and(
      eq(forms.id, formId),
      eq(forms.userId, userId)
    ),
  });

  if (!form) {
    throw new HTTPException(404, { message: 'Form not found' });
  }

  // Build query conditions
  const conditions = [eq(formSubmissions.formId, formId)];

  if (status) {
    conditions.push(eq(formSubmissions.status, status));
  }

  // Get submissions
  const submissions = await db.query.formSubmissions.findMany({
    where: and(...conditions),
    orderBy: [desc(formSubmissions.createdAt)],
    limit,
    offset: (page - 1) * limit,
  });

  // Get total count
  const [{ count: totalCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(formSubmissions)
    .where(and(...conditions));

  return c.json({
    submissions,
    pagination: {
      page,
      limit,
      total: Number(totalCount),
      totalPages: Math.ceil(Number(totalCount) / limit),
    },
  });
});

// GET /submissions/:id - Get a single submission
app.get('/submissions/:id', async (c) => {
  const userId = c.get('userId');
  const submissionId = c.req.param('id');

  const db = createDb(c.env);

  // Get submission with form ownership check
  const submission = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, submissionId),
    with: {
      form: true,
    },
  });

  if (!submission) {
    throw new HTTPException(404, { message: 'Submission not found' });
  }

  // Check if user owns the form
  if (submission.form.userId !== userId) {
    throw new HTTPException(403, { message: 'Not authorized to view this submission' });
  }

  return c.json({ submission });
});

// DELETE /submissions/:id - Delete a submission
app.delete('/submissions/:id', async (c) => {
  const userId = c.get('userId');
  const submissionId = c.req.param('id');

  const db = createDb(c.env);

  // Get submission with form ownership check
  const submission = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, submissionId),
    with: {
      form: true,
    },
  });

  if (!submission) {
    throw new HTTPException(404, { message: 'Submission not found' });
  }

  // Check if user owns the form
  if (submission.form.userId !== userId) {
    throw new HTTPException(403, { message: 'Not authorized to delete this submission' });
  }

  // Delete submission
  await db.delete(formSubmissions).where(eq(formSubmissions.id, submissionId));

  // Update submission count
  await db.update(forms)
    .set({
      submissionCount: sql`${forms.submissionCount} - 1`,
    })
    .where(eq(forms.id, submission.formId));

  return c.json({ success: true, message: 'Submission deleted successfully' });
});

export default app;