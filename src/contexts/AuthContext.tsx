'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // createBrowserClient throws without credentials, which crashes every page
  // (and the production build) on a local install that has no Supabase.
  const [supabase] = useState(() => (isSupabaseConfigured ? createClient() : null));

  useEffect(() => {
    // Without real credentials every call 400s; the app runs fine signed out.
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const requireClient = () => {
    if (!supabase) {
      throw new Error('Accounts are disabled: Supabase is not configured in .env.');
    }
    return supabase;
  };

  // Email/Password Sign Up
  const signUp = async (
    email: string,
    password: string,
    metadata: { fullName?: string; avatarUrl?: string } = {}
  ) => {
    const { data, error } = await requireClient().auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        // Confirmation link signs the user in via /auth/callback.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/sessions-dashboard')}`,
      },
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In
  const signIn = async (email: string, password: string) => {
    const { data, error } = await requireClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  // Forgot password: emails a one-time link. The link lands on /auth/callback,
  // which signs the user in and continues to /reset-password.
  const requestPasswordReset = async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}`;
    const { error } = await requireClient().auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  };

  // Sets a new password for the signed-in user (used by /reset-password).
  const updatePassword = async (password: string) => {
    const { error } = await requireClient().auth.updateUser({ password });
    if (error) throw error;
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await requireClient().auth.signOut();
    if (!error && typeof window !== 'undefined') {
      window.location.href = '/sign-up-login';
    }
    if (error) throw error;
  };

  // Get Current User
  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await requireClient().auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await requireClient()
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    requestPasswordReset,
    updatePassword,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
