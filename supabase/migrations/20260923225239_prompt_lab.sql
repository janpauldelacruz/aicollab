-- ─── Prompt Lab Migration ────────────────────────────────────────────────────
-- Tables: saved_prompts, prompt_test_runs
-- Admin lock: is_admin column already exists on user_profiles

-- ─── 1. Types ─────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.prompt_test_status CASCADE;
CREATE TYPE public.prompt_test_status AS ENUM ('pending', 'running', 'completed', 'failed');

-- ─── 2. Tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'Untitled Prompt',
  description   TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  personality   TEXT NOT NULL DEFAULT '',
  model         TEXT NOT NULL DEFAULT 'gpt-4o',
  provider      TEXT NOT NULL DEFAULT 'OPEN_AI',
  temperature   NUMERIC NOT NULL DEFAULT 0.7,
  max_tokens    INTEGER NOT NULL DEFAULT 300,
  tags          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_pinned     BOOLEAN NOT NULL DEFAULT false,
  usage_count   INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.prompt_test_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES public.saved_prompts(id) ON DELETE SET NULL,
  run_name        TEXT NOT NULL DEFAULT 'Test Run',
  test_input      TEXT NOT NULL DEFAULT '',
  agents          JSONB NOT NULL DEFAULT '[]'::JSONB,
  results         JSONB NOT NULL DEFAULT '[]'::JSONB,
  run_status      public.prompt_test_status NOT NULL DEFAULT 'pending',
  total_tokens    INTEGER NOT NULL DEFAULT 0,
  prompt_tokens   INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost  NUMERIC(10,6) NOT NULL DEFAULT 0,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_saved_prompts_user_id ON public.saved_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_prompts_created_at ON public.saved_prompts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_user_id ON public.prompt_test_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_prompt_id ON public.prompt_test_runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_test_runs_created_at ON public.prompt_test_runs(created_at DESC);

-- ─── 4. Updated_at trigger function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_saved_prompts_updated_at ON public.saved_prompts;
CREATE TRIGGER set_saved_prompts_updated_at
  BEFORE UPDATE ON public.saved_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_prompt_test_runs_updated_at ON public.prompt_test_runs;
CREATE TRIGGER set_prompt_test_runs_updated_at
  BEFORE UPDATE ON public.prompt_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 5. Admin check function (uses auth metadata to avoid recursion) ──────────

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE up.id = auth.uid() AND up.is_admin = true
)
$$;

-- ─── 6. Enable RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_test_runs ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS Policies ─────────────────────────────────────────────────────────

-- saved_prompts: users manage their own
DROP POLICY IF EXISTS "users_manage_own_saved_prompts" ON public.saved_prompts;
CREATE POLICY "users_manage_own_saved_prompts"
ON public.saved_prompts
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- saved_prompts: admin can read all
DROP POLICY IF EXISTS "admin_read_all_saved_prompts" ON public.saved_prompts;
CREATE POLICY "admin_read_all_saved_prompts"
ON public.saved_prompts
FOR SELECT
TO authenticated
USING (public.is_app_admin());

-- prompt_test_runs: users manage their own
DROP POLICY IF EXISTS "users_manage_own_prompt_test_runs" ON public.prompt_test_runs;
CREATE POLICY "users_manage_own_prompt_test_runs"
ON public.prompt_test_runs
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- prompt_test_runs: admin can read all
DROP POLICY IF EXISTS "admin_read_all_prompt_test_runs" ON public.prompt_test_runs;
CREATE POLICY "admin_read_all_prompt_test_runs"
ON public.prompt_test_runs
FOR SELECT
TO authenticated
USING (public.is_app_admin());

-- ─── 8. Admin lock: ensure only the first registered user is admin ────────────
-- This function is called once to promote the earliest user to admin.
-- Run manually or via the app's admin bootstrap route.

CREATE OR REPLACE FUNCTION public.bootstrap_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_user_id UUID;
BEGIN
  -- Get the earliest created user
  SELECT id INTO first_user_id
  FROM public.user_profiles
  ORDER BY created_at ASC
  LIMIT 1;

  IF first_user_id IS NOT NULL THEN
    -- Set only that user as admin, demote all others
    UPDATE public.user_profiles SET is_admin = true  WHERE id = first_user_id;
    UPDATE public.user_profiles SET is_admin = false WHERE id != first_user_id;
  END IF;
END;
$$;

-- Auto-run bootstrap on migration
DO $$
BEGIN
  PERFORM public.bootstrap_admin();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'bootstrap_admin skipped: %', SQLERRM;
END $$;
