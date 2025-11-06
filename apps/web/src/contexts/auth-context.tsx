'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/lib/api-client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string, skipRedirect?: boolean) => Promise<void>;
  signUp: (email: string, password: string, name: string, skipRedirect?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    refreshSession();
  }, []);

  const refreshSession = async () => {
    try {
      setLoading(true);
      const { user } = await apiClient.getSession();
      setUser(user);
    } catch (err) {
      // No session or invalid token
      setUser(null);
      apiClient.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string, skipRedirect?: boolean) => {
    try {
      setError(null);
      setLoading(true);
      const response = await apiClient.signIn({ email, password });
      setUser(response.user);
      if (!skipRedirect) {
        router.push('/forms');  // Changed to /forms for consistency
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, skipRedirect?: boolean) => {
    try {
      setError(null);
      setLoading(true);
      const response = await apiClient.signUp({ email, password, name });
      setUser(response.user);
      if (!skipRedirect) {
        router.push('/forms');  // Changed from /onboarding to /forms
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign up');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await apiClient.signOut();
      setUser(null);
      router.push('/');
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      refreshSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}