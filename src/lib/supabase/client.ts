import { createBrowserClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True only when real Supabase credentials are set. The repo ships with
 * placeholders, and calling Supabase with those produces a 400 on every page —
 * so callers check this first and fall back to local storage.
 */
export const isSupabaseConfigured =
  !!URL && !!KEY && !URL.includes('dummy') && !KEY.includes('updateyour');

export function createClient() {
  return createBrowserClient(URL!, KEY!);
}
