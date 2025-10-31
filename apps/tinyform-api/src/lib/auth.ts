import { Auth } from '@auth/core';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Google from '@auth/core/providers/google';
import GitHub from '@auth/core/providers/github';
// Email provider removed - not compatible with Cloudflare Workers
import type { Env } from '~/types/env';
import { createDb } from '~/db';
import { users, accounts, sessions, verificationTokens } from '~/db/schema';

export function createAuth(env: Env) {
  const db = createDb(env);

  return Auth({
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    secret: env.NEXTAUTH_SECRET,
    trustHost: true,
    session: {
      strategy: 'jwt',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    pages: {
      signIn: '/auth/signin',
      signOut: '/auth/signout',
      error: '/auth/error',
      verifyRequest: '/auth/verify',
      newUser: '/onboarding',
    },
    providers: [
      Google({
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        allowDangerousEmailAccountLinking: true,
      }),
      GitHub({
        clientId: env.GITHUB_CLIENT_ID || '',
        clientSecret: env.GITHUB_CLIENT_SECRET || '',
      }),
      // Email provider removed - use Resend API directly for email auth
      // Email auth will be handled via custom endpoints with Resend
    ],
    callbacks: {
      async session({ session, token }) {
        if (token?.sub) {
          session.user.id = token.sub;
        }
        if (token?.plan) {
          session.user.plan = token.plan as string;
        }
        return session;
      },
      async jwt({ token, user, account }) {
        if (user) {
          token.sub = user.id;
          token.plan = user.plan || 'free';
        }
        return token;
      },
      async signIn({ user, account, profile }) {
        // Allow OAuth without email verification
        // Email verification will be handled separately via custom endpoints
        return true;
      },
    },
    events: {
      async signIn({ user }) {
        // Update last login time
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where((users, { eq }) => eq(users.id, user.id!));
      },
      async createUser({ user }) {
        // Send welcome email
        console.log('New user created:', user.email);
        // TODO: Implement welcome email
      },
    },
  });
}

// Type augmentation for session
declare module '@auth/core' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      plan?: string;
    };
  }

  interface User {
    plan?: string;
  }
}