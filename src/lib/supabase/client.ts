import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * True when the app has real Supabase credentials. When false the app runs as
 * a single-user local install and every Supabase call is skipped.
 */
export const isSupabaseConfigured =
  !!url && !!key && !url?.includes('dummy') && !key?.includes('updateyour');

export function createClient() {
  return createBrowserClient(url, key);
}
