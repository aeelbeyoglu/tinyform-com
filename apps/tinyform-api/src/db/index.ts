import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import type { Env } from '~/types/env';

export function createDb(env: Env) {
  // For pooler connections with credentials in the URL, we don't need an authToken
  const config = env.DATABASE_AUTH_TOKEN
    ? { authToken: env.DATABASE_AUTH_TOKEN }
    : {};

  const sql = neon(env.DATABASE_URL, config);

  return drizzle(sql, { schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };