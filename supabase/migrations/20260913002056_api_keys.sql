-- API Keys management table (encrypted at rest via pgcrypto)
-- Users can store, rotate, and manage API keys for custom models/providers

CREATE TABLE IF NOT EXISTS public.user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  encrypted_key TEXT NOT NULL,
  key_hint TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON public.user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_provider ON public.user_api_keys(provider);

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_api_keys" ON public.user_api_keys;
CREATE POLICY "users_manage_own_api_keys"
ON public.user_api_keys
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_user_api_keys_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_api_keys_updated_at ON public.user_api_keys;
CREATE TRIGGER trg_user_api_keys_updated_at
BEFORE UPDATE ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.update_user_api_keys_updated_at();
