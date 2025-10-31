import type { ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Env } from '~/types/env';

export const errorHandler: ErrorHandler<{ Bindings: Env }> = (err, c) => {
  console.error('Error:', err);

  // Handle HTTP exceptions
  if (err instanceof HTTPException) {
    return c.json({
      error: err.message,
      status: err.status,
    }, err.status);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return c.json({
      error: 'Validation Error',
      message: 'The request data is invalid',
      errors: (err as any).errors,
    }, 400);
  }

  // Handle database errors
  if (err.message?.includes('Database')) {
    return c.json({
      error: 'Database Error',
      message: 'A database error occurred. Please try again later.',
    }, 500);
  }

  // Default error response
  return c.json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(c.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack,
    }),
  }, 500);
};