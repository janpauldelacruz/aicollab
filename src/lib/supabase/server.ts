import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseConfigured } from './client';

/**
 * Supabase client for route handlers and server components.
 *
 * API routes must never trust a user id sent by the browser — anyone can post
 * someone else's id. The caller is identified from their session cookie here,
 * and RLS then scopes every query to that user.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options as never);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Session refresh is handled by middleware instead.
          }
        },
      },
    }
  );
}

export interface AuthedUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user for this request, or null. Returns null rather than
 * throwing when Supabase is not configured, so a self-hosted local install
 * keeps working without an account.
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}
