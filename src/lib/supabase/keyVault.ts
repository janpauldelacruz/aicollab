import { createServerSupabase } from './server';
import { decryptSecret, encryptSecret, keyHint } from '@/lib/crypto/secretBox';

/**
 * Server-side storage for the API keys users bring with them.
 *
 * Every function here runs on the server and relies on RLS to scope rows to the
 * caller. Plaintext exists only inside these functions — it is never returned
 * to the browser and never written to the database.
 */

export interface StoredKeyRow {
  id: string;
  provider: string;
  label: string;
  key_hint: string;
  is_active: boolean;
  last_used_at: string | null;
  rotated_at: string | null;
  created_at: string;
}

/** Columns that are safe to send to the browser — never `encrypted_key`. */
const SAFE_COLUMNS =
  'id, provider, label, key_hint, is_active, last_used_at, rotated_at, created_at';

export async function listUserKeys(userId: string): Promise<StoredKeyRow[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('user_api_keys')
    .select(SAFE_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as StoredKeyRow[];
}

export async function saveUserKey(args: {
  userId: string;
  provider: string;
  label: string;
  rawKey: string;
}): Promise<StoredKeyRow> {
  const { userId, provider, label, rawKey } = args;
  const trimmed = rawKey.trim();
  if (!trimmed) throw new Error('The key is empty');

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('user_api_keys')
    .insert({
      user_id: userId,
      provider,
      label,
      encrypted_key: encryptSecret(trimmed),
      key_hint: keyHint(trimmed),
    })
    .select(SAFE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as StoredKeyRow;
}

export async function rotateUserKey(args: {
  userId: string;
  keyId: string;
  rawKey: string;
}): Promise<StoredKeyRow> {
  const { userId, keyId, rawKey } = args;
  const trimmed = rawKey.trim();
  if (!trimmed) throw new Error('The key is empty');

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('user_api_keys')
    .update({
      encrypted_key: encryptSecret(trimmed),
      key_hint: keyHint(trimmed),
      rotated_at: new Date().toISOString(),
    })
    .eq('id', keyId)
    .eq('user_id', userId)
    .select(SAFE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return data as StoredKeyRow;
}

export async function setKeyActive(userId: string, keyId: string, active: boolean): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('user_api_keys')
    .update({ is_active: active })
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

export async function deleteUserKey(userId: string, keyId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('id', keyId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * The decrypted key for a provider, for use inside a server request only.
 * Returns null when the user has not added one, so the caller can say so
 * instead of falling back to someone else's credentials.
 */
export async function getProviderKey(userId: string, provider: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('id, encrypted_key')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Best-effort usage stamp; never let it break the actual request.
  void supabase
    .from('user_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined);

  try {
    return decryptSecret((data as any).encrypted_key);
  } catch {
    return null;
  }
}
