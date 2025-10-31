import { Hono } from 'hono';
import type { Env } from '~/types/env';
import { requireAuth } from '~/middleware/auth';

const app = new Hono<{ Bindings: Env }>();

// Apply auth to all routes
app.use('*', requireAuth());

// GET /analytics/forms/:id - Get form analytics
app.get('/forms/:id', async (c) => {
  const formId = c.req.param('id');
  // TODO: Implement form analytics
  return c.json({
    formId,
    message: 'Analytics endpoint - Coming soon',
    data: {
      views: 0,
      submissions: 0,
      conversionRate: 0,
    },
  });
});

// GET /analytics/overview - Get user analytics overview
app.get('/overview', async (c) => {
  // TODO: Implement user analytics overview
  return c.json({
    message: 'Analytics overview - Coming soon',
    data: {
      totalForms: 0,
      totalSubmissions: 0,
      totalViews: 0,
    },
  });
});

export default app;