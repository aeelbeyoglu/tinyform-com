export interface Env {
  // Environment variables
  NODE_ENV: string;
  APP_URL: string;
  API_URL: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN?: string;

  // NextAuth
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;

  // OAuth
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;

  // Services
  RESEND_API_KEY: string;
  OPENAI_API_KEY?: string;
  EMAIL_FROM: string;

  // KV Namespaces
  SESSION_KV: KVNamespace;
  CACHE_KV: KVNamespace;
  RATELIMIT_KV: KVNamespace;

  // R2 Storage
  FILE_STORAGE: R2Bucket;

  // Queues
  SUBMISSION_QUEUE: Queue;

  // Durable Objects
  // ANALYTICS: DurableObjectNamespace; // TODO: Uncomment when implemented

  // Feature Flags
  ENABLE_SIGNUP: string;
  ENABLE_AI_GENERATION: string;
  ENABLE_FILE_UPLOADS: string;

  // Limits
  MAX_FORMS_FREE: string;
  MAX_SUBMISSIONS_FREE: string;
  MAX_FILE_SIZE_MB: string;
}

// Message types for queues
export interface SubmissionMessage {
  id: string;
  formId: string;
  data: Record<string, any>;
  metadata: {
    ip?: string;
    userAgent?: string;
    timestamp: number;
  };
}

// Extend the global Request type for custom properties
declare global {
  interface Request {
    userId?: string;
    sessionId?: string;
  }
}