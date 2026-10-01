-- Profiles for every signed-in user, including Google / GitHub sign-ups.
--
-- aicollab_sessions and user_api_keys reference public.user_profiles(id), but
-- nothing created that table or populated it. Without a row here, a new user's
-- first saved session or API key fails its foreign key. This creates the table
-- if missing, fills it automatically on sign-up (email or OAuth), and backfills
-- users who signed up before this migration.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_profile" ON public.user_profiles;
CREATE POLICY "users_read_own_profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Google sends full_name/name and picture; GitHub sends name/user_name and
-- avatar_url; email sign-up sends the full_name the form collected.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'user_name', ''),
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
      NULLIF(NEW.raw_user_meta_data->>'picture', ''),
      ''
    ),
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Users who already exist.
INSERT INTO public.user_profiles (id, email, full_name, avatar_url, provider)
SELECT
  u.id,
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    split_part(COALESCE(u.email, ''), '@', 1)
  ),
  COALESCE(NULLIF(u.raw_user_meta_data->>'avatar_url', ''), ''),
  COALESCE(u.raw_app_meta_data->>'provider', 'email')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
