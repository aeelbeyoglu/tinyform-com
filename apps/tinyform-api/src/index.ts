import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './types/env';

// Route imports
import authRoutes from './routes/auth';
import formRoutes from './routes/forms';
import submissionRoutes from './routes/submissions';
import publicRoutes from './routes/public';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/users';
import testRoutes from './routes/test';

// Middleware imports
import { errorHandler } from './middleware/error';
import { rateLimiter } from './middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS configuration
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.APP_URL,
      'http://localhost:3000',
      'https://tinyform.com',
      'https://www.tinyform.com'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      return origin || allowedOrigins[0];
    }
    return null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400,
}));

// Rate limiting
app.use('/api/*', rateLimiter());

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.NODE_ENV || 'development',
  });
});

// API Version
app.get('/api/v1', (c) => {
  return c.json({
    name: 'TinyForm API',
    version: '1.0.0',
    documentation: 'https://docs.tinyform.com',
  });
});

// Mount routes
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/forms', formRoutes);
app.route('/api/v1/submissions', submissionRoutes);
app.route('/api/v1/public', publicRoutes);
app.route('/api/v1/analytics', analyticsRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/test', testRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: c.req.path,
  }, 404);
});

// Error handling
app.onError(errorHandler);

// Export for Cloudflare Workers
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  // Queue handler for async processing
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        // Process submission queue messages
        if (message.queue === 'submission-processing') {
          await processSubmission(message.body, env);
        }
        message.ack();
      } catch (error) {
        console.error('Queue processing error:', error);
        message.retry();
      }
    }
  },

  // Scheduled handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '0 0 * * *': // Daily at midnight
        await aggregateAnalytics(env);
        break;
      case '0 */6 * * *': // Every 6 hours
        await cleanupExpiredForms(env);
        break;
    }
  },
};

// Helper functions for async tasks
async function processSubmission(data: any, env: Env): Promise<void> {
  // Implementation will be added
  console.log('Processing submission:', data);
}

async function aggregateAnalytics(env: Env): Promise<void> {
  // Implementation will be added
  console.log('Aggregating analytics');
}

async function cleanupExpiredForms(env: Env): Promise<void> {
  // Implementation will be added
  console.log('Cleaning up expired forms');
}