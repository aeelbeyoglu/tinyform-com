import { Hono } from 'hono';
import type { Env } from '~/types/env';
import { requireAuth } from '~/middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// GET /submissions - List submissions for a form
app.get('/', async (c) => {
  // TODO: Implement submission listing
  return c.json({ submissions: [], message: 'Submissions endpoint - Coming soon' });
});

// GET /submissions/:id - Get a single submission
app.get('/:id', async (c) => {
  const submissionId = c.req.param('id');
  // TODO: Implement single submission retrieval
  return c.json({ id: submissionId, message: 'Single submission - Coming soon' });
});

// DELETE /submissions/:id - Delete a submission
app.delete('/:id', async (c) => {
  const submissionId = c.req.param('id');
  // TODO: Implement submission deletion
  return c.json({ success: true, message: 'Submission deletion - Coming soon' });
});

export default app;